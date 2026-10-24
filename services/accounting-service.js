// services/accounting-service.js
// Double-Entry Accounting Engine, Financial Statements, and General Ledgers

const { getDatabase } = require('../database/db');
const { getNextVoucherNumber } = require('./numbering-service');

/**
 * Creates and posts a balanced manual Journal, Receipt, Payment, or Contra voucher.
 * Enforces fundamental accounting equation: Total Debits === Total Credits.
 *
 * @param {object} voucherData
 */
function createJournalVoucher(voucherData) {
  const db = getDatabase();

  const {
    voucherType = 'JOURNAL', // 'JOURNAL', 'RECEIPT', 'PAYMENT', 'CONTRA', 'EXPENSE'
    entryDate = new Date().toISOString().split('T')[0],
    narration = '',
    referenceId = null,
    lines = [], // [{ accountId, debitAmount, creditAmount, narration }]
    userId = null,
    branchId = null,
    financialYearId = null,
  } = voucherData;

  if (!lines || lines.length < 2) {
    throw new Error('A voucher must contain at least two line items (Debit and Credit)');
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    const d = Number(line.debitAmount) || 0;
    const c = Number(line.creditAmount) || 0;
    if (d < 0 || c < 0) {
      throw new Error('Debit and Credit amounts must be non-negative');
    }
    if (d > 0 && c > 0) {
      throw new Error('A line cannot have both Debit and Credit amounts');
    }
    totalDebit += d;
    totalCredit += c;
  }

  // ENFORCE EQUILIBRIUM
  if (totalDebit !== totalCredit) {
    throw new Error(
      `Unbalanced voucher! Total Debits (${totalDebit / 100}) does not equal Total Credits (${totalCredit / 100}). Difference: ${Math.abs(totalDebit - totalCredit) / 100}`
    );
  }

  return db.transaction(() => {
    const voucherNumber = getNextVoucherNumber(db, voucherType, branchId, financialYearId);

    const jRes = db.prepare(`
      INSERT INTO journal_entries (
        voucher_number, voucher_type, entry_date, reference_id, narration,
        branch_id, financial_year_id, total_amount, user_id
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      voucherNumber, voucherType, entryDate, referenceId, narration.trim(),
      branchId, financialYearId, totalDebit, userId
    );
    const journalId = jRes.lastInsertRowid;

    const insertLine = db.prepare(`
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, narration)
      VALUES (?, ?, ?, ?, ?)
    `);

    const updateAccBal = db.prepare(`
      UPDATE accounts
      SET current_balance = current_balance + ? - ?
      WHERE id = ?
    `);

    for (const line of lines) {
      const d = Number(line.debitAmount) || 0;
      const c = Number(line.creditAmount) || 0;
      insertLine.run(journalId, line.accountId, d, c, line.narration || narration);
      // For Assets & Expenses: Debit increases balance. For Liabilities, Equity & Income: Credit increases balance.
      // We store signed effect or net
      updateAccBal.run(d, c, line.accountId);
    }

    return {
      success: true,
      journalId,
      voucherNumber,
      totalAmount: totalDebit,
    };
  })();
}

/**
 * Get Chart of Accounts grouped by category.
 */
function getChartOfAccounts() {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, code, name, group_name, opening_balance, current_balance, is_system
    FROM accounts
    ORDER BY code ASC
  `).all();
}

/**
 * Get general ledger for a specific account with running balance.
 */
function getAccountLedger(accountId, fromDate = null, toDate = null) {
  const db = getDatabase();

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  if (!account) throw new Error('Account not found');

  let where = 'WHERE jel.account_id = ?';
  const params = [accountId];

  if (fromDate) {
    where += ' AND je.entry_date >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    where += ' AND je.entry_date <= ?';
    params.push(toDate);
  }

  const lines = db.prepare(`
    SELECT jel.id, jel.debit_amount, jel.credit_amount, jel.narration,
           je.voucher_number, je.voucher_type, je.entry_date, je.reference_id
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    ${where}
    ORDER BY je.entry_date ASC, jel.id ASC
  `).all(...params);

  let runningBalance = account.opening_balance;
  const isDebitNormal = account.group_name === 'ASSET' || account.group_name === 'EXPENSE';

  const rows = lines.map((l) => {
    if (isDebitNormal) {
      runningBalance += l.debit_amount - l.credit_amount;
    } else {
      runningBalance += l.credit_amount - l.debit_amount;
    }
    return {
      ...l,
      runningBalance,
    };
  });

  return {
    account,
    openingBalance: account.opening_balance,
    closingBalance: runningBalance,
    rows,
  };
}

/**
 * Generate Trial Balance verifying total debits == total credits across the system.
 */
function getTrialBalance(asOfDate = null) {
  const db = getDatabase();
  const dateLimit = asOfDate || new Date().toISOString().split('T')[0];

  const accounts = db.prepare(`
    SELECT a.id, a.code, a.name, a.group_name, a.opening_balance,
           COALESCE(j.debit_amount, 0) as period_debit,
           COALESCE(j.credit_amount, 0) as period_credit
    FROM accounts a
    LEFT JOIN (
      SELECT jel.account_id,
             SUM(jel.debit_amount) as debit_amount,
             SUM(jel.credit_amount) as credit_amount
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.journal_entry_id = je.id
      WHERE ? IS NULL OR je.entry_date <= ?
      GROUP BY jel.account_id
    ) j ON a.id = j.account_id
    ORDER BY a.code ASC
  `).all(dateLimit, dateLimit);

  let totalTrialDebit = 0;
  let totalTrialCredit = 0;

  const resultRows = accounts.map((acc) => {
    let debitBal = 0;
    let creditBal = 0;

    const netDebit = acc.period_debit - acc.period_credit;
    if (acc.group_name === 'ASSET' || acc.group_name === 'EXPENSE') {
      const bal = acc.opening_balance + netDebit;
      if (bal >= 0) debitBal = bal;
      else creditBal = Math.abs(bal);
    } else {
      const bal = acc.opening_balance - netDebit;
      if (bal >= 0) creditBal = bal;
      else debitBal = Math.abs(bal);
    }

    totalTrialDebit += debitBal;
    totalTrialCredit += creditBal;

    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      group: acc.group_name,
      debit: debitBal,
      credit: creditBal,
    };
  });

  return {
    asOfDate: dateLimit,
    rows: resultRows,
    totalDebit: totalTrialDebit,
    totalCredit: totalTrialCredit,
    isBalanced: totalTrialDebit === totalTrialCredit,
    difference: Math.abs(totalTrialDebit - totalTrialCredit),
  };
}

/**
 * Generate Profit & Loss Statement (Income vs Expenses).
 */
function getProfitAndLoss(fromDate, toDate) {
  const db = getDatabase();

  const lines = db.prepare(`
    SELECT a.id, a.code, a.name, a.group_name,
           SUM(jel.debit_amount) as total_debit,
           SUM(jel.credit_amount) as total_credit
    FROM accounts a
    JOIN journal_entry_lines jel ON a.id = jel.account_id
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    WHERE a.group_name IN ('INCOME', 'EXPENSE')
      AND (? IS NULL OR je.entry_date >= ?)
      AND (? IS NULL OR je.entry_date <= ?)
    GROUP BY a.id
    ORDER BY a.code ASC
  `).all(fromDate, fromDate, toDate, toDate);

  const income = [];
  const expenses = [];
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const l of lines) {
    if (l.group_name === 'INCOME') {
      const amount = (l.total_credit || 0) - (l.total_debit || 0);
      income.push({ code: l.code, name: l.name, amount });
      totalIncome += amount;
    } else if (l.group_name === 'EXPENSE') {
      const amount = (l.total_debit || 0) - (l.total_credit || 0);
      expenses.push({ code: l.code, name: l.name, amount });
      totalExpenses += amount;
    }
  }

  const netProfit = totalIncome - totalExpenses;

  return {
    fromDate,
    toDate,
    income,
    expenses,
    totalIncome,
    totalExpenses,
    netProfit,
  };
}

/**
 * Generate Balance Sheet (Assets = Liabilities + Equity).
 */
function getBalanceSheet(asOfDate) {
  const trial = getTrialBalance(asOfDate);
  const assets = [];
  const liabilities = [];
  const equity = [];

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  for (const row of trial.rows) {
    if (row.group === 'ASSET') {
      const val = row.debit - row.credit;
      assets.push({ code: row.code, name: row.name, amount: val });
      totalAssets += val;
    } else if (row.group === 'LIABILITY') {
      const val = row.credit - row.debit;
      liabilities.push({ code: row.code, name: row.name, amount: val });
      totalLiabilities += val;
    } else if (row.group === 'EQUITY') {
      const val = row.credit - row.debit;
      equity.push({ code: row.code, name: row.name, amount: val });
      totalEquity += val;
    }
  }

  // Calculate Net Profit up to asOfDate to fold into Retained Earnings
  const pl = getProfitAndLoss(null, asOfDate);
  totalEquity += pl.netProfit;
  equity.push({ code: '3020-CURR', name: 'Current Period Net Profit / Loss', amount: pl.netProfit });

  return {
    asOfDate: trial.asOfDate,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    isBalanced: totalAssets === (totalLiabilities + totalEquity),
    difference: Math.abs(totalAssets - (totalLiabilities + totalEquity)),
  };
}

module.exports = {
  createJournalVoucher,
  getChartOfAccounts,
  getAccountLedger,
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
};
