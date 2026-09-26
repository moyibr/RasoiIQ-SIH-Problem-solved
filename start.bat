@echo off
REM RasoiIQ - starts both dev servers.
REM Backend: http://localhost:8080  |  Frontend: http://localhost:3000
REM The frontend expects the API on 8080 (see frontend/src/lib/api.ts).

echo Starting RasoiIQ Backend on port 8080...
start "RasoiIQ Backend" cmd /k "cd /d "%~dp0backend" && .\venv\Scripts\activate && python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload"

echo Starting RasoiIQ Frontend...
start "RasoiIQ Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both servers starting.
echo   Frontend      : http://localhost:3000
echo   Backend API   : http://localhost:8080/docs
echo   Health check  : http://localhost:8080/health
