@echo off
REM ── ISP Print Agent — Build script para Windows ──
REM Ejecutar en la PC Windows o via cross-compilation en Mac/Linux
REM Requiere Node.js instalado

echo Instalando dependencias...
call npm install

echo.
echo Compilando ISP-PrintAgent.exe para Windows x64...
call npx pkg agent.js --targets node18-win-x64 --output dist/ISP-PrintAgent.exe --compress GZip

echo.
if exist dist\ISP-PrintAgent.exe (
    echo ✓ Compilado exitosamente: dist\ISP-PrintAgent.exe
    echo.
    echo Instrucciones de instalacion:
    echo 1. Copia ISP-PrintAgent.exe a la PC con la Canon TS702a
    echo 2. Ejecuta el .exe ^(doble clic^)
    echo 3. Minimiza la ventana negra que aparece, NO la cierres
    echo 4. El sistema ISP lo detectara automaticamente
) else (
    echo ✗ Error en la compilacion
)
pause
