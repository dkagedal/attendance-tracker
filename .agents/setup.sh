#!/usr/bin/env bash
set -euo pipefail

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64)
    NODE_ARCH="x64"
    JAVA_ARCH="x64"
    ;;
  aarch64 | arm64)
    NODE_ARCH="arm64"
    JAVA_ARCH="aarch64"
    ;;
  *)
    NODE_ARCH=""
    JAVA_ARCH=""
    ;;
esac

mkdir -p "$HOME/.local"

# Ensure Node.js 22 (matches .nvmrc and packages/backend/package.json engines)
NODE_DIR="$HOME/.local/node-v22"
CURRENT_NODE_MAJOR="$(node -v 2>/dev/null | sed -n 's/^v\([0-9]*\).*/\1/p' || true)"
if [ "$CURRENT_NODE_MAJOR" != "22" ]; then
  if [ -x "$NODE_DIR/bin/node" ] && [[ "$("$NODE_DIR/bin/node" -v)" == v22.* ]]; then
    export PATH="$NODE_DIR/bin:$PATH"
  elif [ "$OS" = "Linux" ] && [ -n "$NODE_ARCH" ]; then
    NODE_TARBALL="$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt \
      | awk -v arch="$NODE_ARCH" '$2 ~ ("^node-v22\\.[0-9]+\\.[0-9]+-linux-" arch "\\.tar\\.gz$") { print $2; exit }')"
    if [ -z "$NODE_TARBALL" ]; then
      echo "Failed to resolve Node.js 22 tarball for linux-${NODE_ARCH}" >&2
      exit 1
    fi
    echo "Installing ${NODE_TARBALL}..."
    TMP_DIR="$(mktemp -d)"
    trap 'rm -rf "$TMP_DIR"' EXIT
    curl -fsSL "https://nodejs.org/dist/latest-v22.x/${NODE_TARBALL}" | tar -xz -C "$TMP_DIR"
    rm -rf "$NODE_DIR"
    mv "$TMP_DIR"/node-v22.* "$NODE_DIR"
    rm -rf "$TMP_DIR"
    trap - EXIT
    export PATH="$NODE_DIR/bin:$PATH"
  fi
fi

# Ensure Java 21+ (required by firebase-tools 15+ emulators)
JDK_DIR="$HOME/.local/jdk-21"
CURRENT_JAVA_MAJOR="$(java -version 2>&1 | sed -n 's/.*version "\([0-9]*\).*/\1/p' | head -n 1 || true)"
if [ -z "$CURRENT_JAVA_MAJOR" ] || [ "$CURRENT_JAVA_MAJOR" -lt 21 ]; then
  if [ -x "$JDK_DIR/bin/java" ]; then
    export JAVA_HOME="$JDK_DIR"
    export PATH="$JDK_DIR/bin:$PATH"
  elif [ "$OS" = "Linux" ] && [ -n "$JAVA_ARCH" ]; then
    echo "Installing Eclipse Temurin JDK 21..."
    TMP_DIR="$(mktemp -d)"
    trap 'rm -rf "$TMP_DIR"' EXIT
    curl -fsSL "https://api.adoptium.net/v3/binary/latest/21/ga/linux/${JAVA_ARCH}/jdk/hotspot/normal/eclipse" \
      | tar -xz -C "$TMP_DIR"
    rm -rf "$JDK_DIR"
    mv "$TMP_DIR"/jdk-21* "$JDK_DIR"
    rm -rf "$TMP_DIR"
    trap - EXIT
    export JAVA_HOME="$JDK_DIR"
    export PATH="$JDK_DIR/bin:$PATH"
  fi
fi

# Persist local toolchain paths in ~/.bashrc idempotently for non-interactive shells
if [ "$OS" = "Linux" ] && { [ -d "$NODE_DIR/bin" ] || [ -d "$JDK_DIR/bin" ]; }; then
  touch "$HOME/.bashrc"
  sed -i '/case \$- in/,/esac/d' "$HOME/.bashrc" 2>/dev/null || true
  if [ -d "$JDK_DIR/bin" ]; then
    JAVA_HOME_LINE='export JAVA_HOME="$HOME/.local/jdk-21"'
    grep -qxF "$JAVA_HOME_LINE" "$HOME/.bashrc" || echo "$JAVA_HOME_LINE" >> "$HOME/.bashrc"
  fi
  PATH_LINE='export PATH="$HOME/.local/node-v22/bin:$HOME/.local/jdk-21/bin:$PATH"'
  grep -qxF "$PATH_LINE" "$HOME/.bashrc" || echo "$PATH_LINE" >> "$HOME/.bashrc"
fi

# Install workspace dependencies if package-lock.json changed or node_modules is missing
LOCK_HASH="$(sha256sum package-lock.json 2>/dev/null | awk '{print $1}' || shasum -a 256 package-lock.json | awk '{print $1}')"
STAMP_FILE="node_modules/.package-lock.sha256"
if [ -d "node_modules" ] && [ -f "$STAMP_FILE" ] && [ "$(cat "$STAMP_FILE")" = "$LOCK_HASH" ]; then
  node scripts/select-config.js
else
  npm ci --no-audit --no-fund
  printf '%s\n' "$LOCK_HASH" > "$STAMP_FILE"
fi

# Pre-cache Firestore emulator binary if not already downloaded
if ! compgen -G "$HOME/.cache/firebase/emulators/cloud-firestore-emulator-*.jar" >/dev/null; then
  npx --no-install firebase setup:emulators:firestore
fi
