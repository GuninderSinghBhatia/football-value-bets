@echo off
rem Daily NBA prop-line logger (run by Windows Task Scheduler: "BetMind NBA prop logger")
set PYTHONIOENCODING=utf-8
cd /d "%~dp0\..\.."
echo ==== %date% %time% ==== >> nba\data\logs\prop_logger.log
".venv\Scripts\python.exe" nba\scripts\log_prop_lines.py >> nba\data\logs\prop_logger.log 2>&1
