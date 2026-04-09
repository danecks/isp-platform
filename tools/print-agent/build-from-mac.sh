#!/bin/bash
# ── ISP Print Agent — Cross-compile desde Mac hacia Windows .exe ──
# Ejecutar en Mac: bash build-from-mac.sh

set -e

echo "Instalando dependencias..."
npm install

echo ""
echo "Compilando ISP-PrintAgent.exe para Windows x64..."
npx pkg agent.js --targets node18-win-x64 --output dist/ISP-PrintAgent.exe --compress GZip

echo ""
if [ -f "dist/ISP-PrintAgent.exe" ]; then
    SIZE=$(du -sh dist/ISP-PrintAgent.exe | cut -f1)
    echo "✓ Compilado: dist/ISP-PrintAgent.exe ($SIZE)"
    echo ""
    echo "Envía el .exe al usuario Windows por WhatsApp, Drive o correo."
    echo "Instrucciones para el usuario:"
    echo "  1. Ejecutar ISP-PrintAgent.exe (doble clic)"
    echo "  2. Minimizar la ventana negra (NO cerrar)"
    echo "  3. El sistema ISP detecta el agente automáticamente"
else
    echo "✗ Error en la compilación"
    exit 1
fi
