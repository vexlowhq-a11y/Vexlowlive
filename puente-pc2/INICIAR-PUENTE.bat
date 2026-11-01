@echo off
title Puente Vexlow Live (PC del live) - no cerrar durante el directo
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0puente.ps1" %*
pause
