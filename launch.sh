#!/usr/bin/env bash
set -e
cd "$(dirname "$(readlink -f "$0")")"

# Install the Linux libraries Electron needs on Debian/ChromeOS Linux.
if command -v apt-get >/dev/null 2>&1; then
  missing=()
  for pkg in libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 libgtk-3-0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxkbcommon0 libasound2; do
    dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
  done
  if [ ${#missing[@]} -gt 0 ]; then
    echo "TAWS: installing required Linux libraries..."
    sudo apt-get update
    sudo apt-get install -y "${missing[@]}"
  fi
fi

if [ ! -d node_modules ]; then
  echo "TAWS: installing Node dependencies..."
  npm install
fi

echo "Starting Tech Axel Web Surfer..."
npm start
