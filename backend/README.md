# MediStock ERP — Central Licensing & SuperAdmin Cloud Backend

This is the central licensing server and REST API for **MediStock ERP**. It manages software activations, hardware machine bindings (HWID), validity durations, and SuperAdmin telemetry.

---

## 🔒 Crucial Architecture & Data Privacy Guarantee

* 🏥 **Medicine Store Database (`medistock.db`) — Local Only:**  
  All medicine masters, batch inventory, purchase bills, retail sales, Schedule H registers, patient details, and accounting ledgers stay **100% on the consumer's local computer** in an offline-first SQLite database. No client pharmacy business data is ever transmitted to the cloud.

* 🔑 **License Master Database (`license_master.db`) — Server Only:**  
  The remote cloud server stores **only** the license keys, customer registration info (Pharmacy Name, Contact), bound machine Hardware ID (HWID), and subscription expiry dates.

---

## 🚀 Quick Cloud Deployment (Choose Any Option)

### Option 1: Render.com (Recommended — 2 Minutes, Free)
1. Push this repository to your GitHub account (see Git instructions below).
2. Go to [https://render.com](https://render.com) and click **"New +" &rarr; "Web Service"**.
3. Connect your GitHub repository.
4. Configure these fields:
   * **Root Directory:** `backend`
   * **Runtime:** `Node`
   * **Build Command:** `npm install`
   * **Start Command:** `node server.js`
   * **Instance Type:** `Free`
5. Click **"Deploy Web Service"**.
6. Render will assign you a live HTTPS URL (e.g. `https://medistock-license-backend.onrender.com`).
7. **Copy this URL** and share it with the assistant to integrate it into the desktop apps!

---

### Option 2: Railway.app
1. Go to [https://railway.app](https://railway.app) and select **"Deploy from GitHub repo"**.
2. Select your repository.
3. In the Settings, set **Root Directory** to `/backend`.
4. Railway will automatically detect Node.js, run `npm install`, and start `node server.js`.
5. Under Settings &rarr; Networking, generate a public domain (e.g. `https://medistock-production.up.railway.app`).

---

### Option 3: Any VPS / Linux Server (Ubuntu / Debian / Docker)
If you have a VPS (DigitalOcean, AWS, Linode, Hostinger):

```bash
# Clone the repository
git clone <your-github-repo-url>
cd proud-bose/backend

# Install dependencies
npm install

# Run with PM2 for 24/7 background uptime
npm install -g pm2
pm2 start server.js --name "medistock-license-backend"
pm2 save
pm2 startup
```

Or run via Docker:
```bash
docker build -t medistock-backend .
docker run -d -p 5000:5000 -v /var/data:/app/data --name medistock-backend medistock-backend
```

---

## 💻 How to Push to GitHub

In your terminal in the root project folder:

```powershell
# 1. Add your GitHub remote repository (replace with your actual GitHub URL):
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git

# 2. Rename branch to main if preferred:
git branch -M main

# 3. Push all code to GitHub:
git push -u origin main
```

---

## 👑 SuperAdmin Initial Credentials on Cloud
* **URL:** `https://YOUR-DEPLOYED-URL/admin`
* **Username:** `superadmin`
* **Password:** `masteradmin123`
