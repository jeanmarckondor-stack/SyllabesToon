@echo off
setlocal

cd /d "%~dp0"

echo.
echo SyllabesToon
echo Jeu : http://localhost:8000/index.html
echo Espace enseignant : http://localhost:8000/teacher-manager.html
echo.

if not exist "server.exe" (
  echo server.exe est manquant. Contactez Jean-Marc.
  echo.
  pause
  exit /b 1
)

echo Demarrage de SyllabesToon...
echo Ne fermez pas cette fenetre pendant l'utilisation.
echo.

start "" "http://localhost:8000/index.html"
server.exe --port 8000 --root "%cd%"

echo.
echo SyllabesToon est arrete.
pause
