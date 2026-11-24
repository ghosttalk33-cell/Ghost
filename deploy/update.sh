#!/usr/bin/env bash
# Ghost Crawler bijwerken naar de nieuwste versie.  Gebruik: sudo /opt/ghost/deploy/update.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Start dit script met sudo."; exit 1; }
sudo -u ghost git -C /opt/ghost pull
systemctl restart ghost
echo "✅ Bijgewerkt en herstart."
