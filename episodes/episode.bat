@echo off
rem Runs make_episode.py with the Python that setup.bat installed, from any folder.
cd /d "%~dp0\.."
.venv-episodes\Scripts\python episodes\make_episode.py %*
