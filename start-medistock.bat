@echo off
title Launching MediStock ERP...
cd /d "%~dp0"
start "" "node_modules\electron\dist\electron.exe" .
exit
