#!/usr/bin/env bash
# Zips the ZeroDash project (source only) so it can be shared as context.
# Usage: run from the project root:  bash zip-project.sh
set -euo pipefail

PROJECT_NAME="$(basename "$PWD")"
OUT="./${PROJECT_NAME}-context.zip"

rm -f "$OUT"

zip -r "$OUT" . \
  -x ".git/*" \
  -x "*/.git/*" \
  -x "node_modules/*" \
  -x "*/node_modules/*" \
  -x "*.DS_Store" \
  -x "LICENSE" \
  -x "*.png" "*.jpg" "*.jpeg" "*.gif" "*.ico" "*.woff" "*.woff2" "*.ttf" \
  -x "*.zip"

echo
echo "Created: $(cd .. && pwd)/${PROJECT_NAME}-context.zip"
echo "Contents:"
unzip -l "$OUT" | tail -n +4 | head -n 2
echo
echo "Reminder: check user/ for API keys, tokens or personal data before sharing."