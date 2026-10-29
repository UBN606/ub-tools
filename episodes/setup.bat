@echo off
rem One-time setup for make_episode.py. Double-click it, or run it from the ub-tools folder.
cd /d "%~dp0\.."
py -3.12 -m venv .venv-episodes
if errorlevel 1 (
  echo.
  echo Python 3.12 was not found. Install it from https://www.python.org/downloads/ and run this again.
  pause
  exit /b 1
)
.venv-episodes\Scripts\python -m pip install --upgrade pip
.venv-episodes\Scripts\python -m pip install -r episodes\requirements.txt
if errorlevel 1 (
  echo.
  echo Installing the Python packages failed. Scroll up for the first red error.
  pause
  exit /b 1
)
node fetch-data.js
echo.
echo Setup finished.
pause
