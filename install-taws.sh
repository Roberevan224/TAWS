#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="$HOME/.local/opt/taws"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/scalable/apps"
REPO="Roberevan224/TAWS"
mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$DESKTOP_DIR" "$ICON_DIR"
API="https://api.github.com/repos/$REPO/releases/latest"
URL="$(curl -fsSL "$API" | grep -o 'https://[^\"]*TAWS-[^\"]*-x64\.AppImage' | head -n 1)"
if [ -z "$URL" ]; then echo "Could not find the latest TAWS AppImage on GitHub."; exit 1; fi
curl -fL "$URL" -o "$INSTALL_DIR/TAWS.AppImage.tmp"
chmod +x "$INSTALL_DIR/TAWS.AppImage.tmp"
mv -f "$INSTALL_DIR/TAWS.AppImage.tmp" "$INSTALL_DIR/TAWS.AppImage"
curl -fsSL "https://raw.githubusercontent.com/$REPO/main/assets/taws.svg" -o "$ICON_DIR/taws.svg"
cat > "$DESKTOP_DIR/taws.desktop" <<EOF
[Desktop Entry]
Name=TAWS
GenericName=Web Browser
Comment=Tech Axel Web Surfer
Exec=$INSTALL_DIR/TAWS.AppImage %U
Icon=taws
Terminal=false
Type=Application
Categories=Network;WebBrowser;
MimeType=text/html;x-scheme-handler/http;x-scheme-handler/https;
StartupWMClass=TAWS
EOF
cat > "$BIN_DIR/taws" <<EOF
#!/usr/bin/env bash
exec "$INSTALL_DIR/TAWS.AppImage" "\$@"
EOF
chmod +x "$BIN_DIR/taws"
if command -v apt-get >/dev/null 2>&1; then
  missing=()
  for pkg in libpulse0 libasound2 libnspr4 libnss3 libgbm1 libgtk-3-0; do dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg"); done
  if [ ${#missing[@]} -gt 0 ]; then sudo apt-get update; sudo apt-get install -y "${missing[@]}"; fi
fi
update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
echo "TAWS is installed as a Linux application. Launch it from the Linux apps folder or run: $BIN_DIR/taws"
