#!/bin/bash
set -e

echo "Building wa-sqlite with Multiple Ciphers support..."

docker build -t wa-sqlite-mc-builder .

if [ ! -f "extra/mc_exported_functions.json" ]; then
    mkdir -p extra
    cat > extra/mc_exported_functions.json << 'EOF'
[
  "_sqlite3mc_vfs_create",
  "_sqlite3mc_config",
  "_sqlite3mc_cipher_index",
  "_sqlite3mc_config_cipher",
  "_sqlite3mc_cipher_count",
  "_sqlite3mc_cipher_name",
  "_sqlite3_key",
  "_sqlite3_key_v2",
  "_sqlite3_rekey",
  "_sqlite3_rekey_v2"
]
EOF
fi

docker run --rm \
    -v "$(pwd)":/build \
    -e MAKE_TARGET="${1:-all}" \
    wa-sqlite-mc-builder \
    bash -c "source /opt/emsdk/emsdk_env.sh && \
             emcc --version && \
             yarn install && \
             make \${MAKE_TARGET}"

echo "Build complete! Check dist/ directory"
ls -la dist/mc-* 2>/dev/null || echo "No MC builds found. Try: ./build.sh dist/mc-wa-sqlite.mjs"
