@echo off
setlocal

cd /d "%~dp0"

echo.
echo SyllabesToon - lancement local
echo URL jeu : http://localhost:8000/index.html
echo URL espace enseignant : http://localhost:8000/teacher-manager.html
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable.
  echo Installe Node.js sur ce PC de developpement, ou utilise la future version portable sans Node.
  echo.
  pause
  exit /b 1
)

node scripts\serve.js
if errorlevel 1 (
  echo.
  echo Le serveur SyllabesToon s'est arrete avec une erreur.
  echo Verifie que le port 8000 n'est pas deja utilise.
  echo.
  pause
  exit /b 1
)

endlocal
