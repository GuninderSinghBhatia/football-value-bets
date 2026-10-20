@echo off
rem NBA paper-trading cycle (run by Windows Task Scheduler: "BetMind NBA pipeline", every 30 min)
set PYTHONIOENCODING=utf-8
cd /d "%~dp0\..\.."
if not exist nba\data\logs mkdir nba\data\logs
echo ==== %date% %time% ==== >> nba\data\logs\pipeline.log
".venv\Scripts\python.exe" nba\scripts\run_pipeline.py >> nba\data\logs\pipeline.log 2>&1
