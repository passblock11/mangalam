#!/usr/bin/env sh
# Debug keystore SHA-1 for Google Cloud → Android OAuth client (Supabase Flutter mobile doc).
set -e
KEYSTORE="${HOME}/.android/debug.keystore"
if [ ! -f "$KEYSTORE" ]; then
  echo "No debug keystore at $KEYSTORE — run the app once from Android Studio."
  exit 1
fi
keytool -list -v -keystore "$KEYSTORE" -alias androiddebugkey -storepass android -keypass android 2>/dev/null | awk '/SHA1:/{print $2}'
