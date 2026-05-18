#!/usr/bin/env bash
# Genera el keystore de firma para releases de ISP Operaciones.
#
# USO:
#   bash scripts/generate-keystore.sh
#
# El archivo `keystore.jks` queda en la raíz del artefacto (NO se commitea —
# está en .gitignore). Guardalo en lugar seguro y subilo a GitHub Secrets:
#
#   KEYSTORE_BASE64        ← base64 -w0 keystore.jks
#   KEYSTORE_PASSWORD      ← contraseña del store
#   KEY_ALIAS              ← alias (default: ispsa)
#   KEY_PASSWORD           ← contraseña de la key
#
# IMPORTANTE: si perdés el keystore, los usuarios deben DESINSTALAR la app
# antes de poder instalar una APK nueva (Android no permite reemplazar APKs
# firmadas con otra key). Guardá respaldo offline.
set -euo pipefail

KEYSTORE="${KEYSTORE:-keystore.jks}"
ALIAS="${KEY_ALIAS:-ispsa}"
VALIDITY="${VALIDITY:-10000}"

if [[ -f "$KEYSTORE" ]]; then
  echo "Ya existe $KEYSTORE — abortando para no sobrescribir." >&2
  exit 1
fi

read -rsp "Contraseña del store: " STOREPASS; echo
read -rsp "Contraseña de la key (Enter = misma que store): " KEYPASS; echo
KEYPASS="${KEYPASS:-$STOREPASS}"

keytool -genkey -v \
  -keystore "$KEYSTORE" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 \
  -validity "$VALIDITY" \
  -storepass "$STOREPASS" \
  -keypass "$KEYPASS" \
  -dname "CN=ISP Operaciones, OU=ISP, O=ISP S.A., L=Guatemala, ST=Guatemala, C=GT"

echo
echo "✔ Keystore generado: $KEYSTORE"
echo "  Subí estos secrets a GitHub:"
echo "    KEYSTORE_BASE64    = $(base64 -w0 \"$KEYSTORE\" 2>/dev/null | head -c 60)…"
echo "    KEYSTORE_PASSWORD  = (el que pusiste)"
echo "    KEY_ALIAS          = $ALIAS"
echo "    KEY_PASSWORD       = (el que pusiste)"
