#!/usr/bin/env bash
set -e
cd "$(dirname "$(readlink -f "$0")")"
if [ ! -d node_modules ]; then
  echo "TAWS: installing dependencies..."
  npm install
fi
echo "Starting Tech Axel Web Surfer..."
npm start
