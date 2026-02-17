@echo off
setlocal
cd /d "%~dp0"

rem Force UTF-8 console to avoid garbled Chinese logs.
chcp 65001 >nul

rem Use plain, non-colored output for better readability.
set "FORCE_COLOR=0"
set "NPM_CONFIG_COLOR=false"
set "ELECTRON_RUN_AS_NODE="
set "DOTENV_CONFIG_QUIET=true"

title OpenClaw Assistant Backend
npm start
