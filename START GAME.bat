@echo off
setlocal
cd /d "%~dp0"

set PORT=8137
set URL=http://localhost:%PORT%/

echo Starting The Lost Magicbook on %URL%
start "" "%URL%"

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  py -m http.server %PORT%
) else (
  python -m http.server %PORT%
)
