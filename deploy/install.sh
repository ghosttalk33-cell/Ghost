#!/usr/bin/env bash
# Ghost Crawler: installatie op een Ubuntu-server (bijv. Oracle Cloud Always Free).
# Gebruik:  curl -fsSL https://raw.githubusercontent.com/ghosttalk33-cell/Ghost/refs/heads/claude/wat-kan-je-nog-maken-2vgrv8/deploy/install.sh | sudo bash
set -euo pipefail

REPO="https://github.com/ghosttalk33-cell/Ghost.git"
BRANCH="claude/wat-kan-je-nog-maken-2vgrv8"
DIR="/opt/ghost"

[ "$(id -u)" = 0 ] || { echo "Start dit script met sudo."; exit 1; }
ask()   { local v; read -r -p "$1" v < /dev/tty; printf '%s' "$v"; }
askpw() {
  local a b
  while true; do
    read -r -s -p "$1" a < /dev/tty; echo > /dev/tty
    read -r -s -p "   Nog een keer: " b < /dev/tty; echo > /dev/tty
    if [ "$a" != "$b" ]; then echo "   ✖ Niet hetzelfde, probeer opnieuw." > /dev/tty
    elif [ ${#a} -lt 6 ]; then echo "   ✖ Minimaal 6 tekens." > /dev/tty
    else printf '%s' "$a"; return; fi
  done
}

echo
echo "👻  Ghost Crawler installeren"
echo "──────────────────────────────"
echo "Heb je een eigen domeinnaam (bijv. prijzen.jouwnaam.nl) die al naar dit IP-adres wijst?"
DOMAIN=$(ask "Domeinnaam (Enter = geen): ")
echo
ADMIN_USER=$(ask "Kies JOUW gebruikersnaam: ")
ADMIN_PW=$(askpw "Kies JOUW wachtwoord: ")
echo
FRIEND_USER=$(ask "Gebruikersnaam voor je Amerikaanse vriend (Enter = overslaan): ")
FRIEND_PW=""
if [ -n "$FRIEND_USER" ]; then FRIEND_PW=$(askpw "Wachtwoord voor $FRIEND_USER: "); fi

if [ "$(awk '/MemTotal/{print $2}' /proc/meminfo)" -lt 1600000 ] && [ -z "$(swapon --show 2> /dev/null)" ]; then
  echo; echo "▶ Weinig geheugen: 1 GB reservegeheugen (swap) aanmaken…"
  fallocate -l 1G /swapfile 2> /dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024 status=none
  chmod 600 /swapfile && mkswap /swapfile > /dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo; echo "▶ Systeem bijwerken en programma's installeren (dit duurt een paar minuten)…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq git curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https > /dev/null

if ! command -v node > /dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  echo "▶ Node.js 22 installeren…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null
  apt-get install -y -qq nodejs > /dev/null
fi

if ! command -v caddy > /dev/null; then
  echo "▶ Caddy (webserver met automatische https) installeren…"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y -qq
  apt-get install -y -qq caddy > /dev/null
fi

echo "▶ Ghost Crawler downloaden…"
id ghost > /dev/null 2>&1 || useradd --system --create-home --home-dir "$DIR" --shell /usr/sbin/nologin ghost
if [ -d "$DIR/.git" ]; then
  sudo -u ghost git -C "$DIR" pull -q
else
  rm -rf "$DIR"; git clone -q -b "$BRANCH" "$REPO" "$DIR"; chown -R ghost:ghost "$DIR"
fi

echo "▶ Gebruikers aanmaken…"
cd "$DIR"
sudo -u ghost env GHOST_PASSWORD="$ADMIN_PW" node server.js user add "$ADMIN_USER" admin
if [ -n "$FRIEND_USER" ]; then sudo -u ghost env GHOST_PASSWORD="$FRIEND_PW" node server.js user add "$FRIEND_USER" us; fi

echo "▶ Automatisch starten instellen…"
cat > /etc/systemd/system/ghost.service <<UNIT
[Unit]
Description=Ghost Crawler
After=network-online.target
Wants=network-online.target

[Service]
User=ghost
WorkingDirectory=$DIR
Environment=PORT=3000
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable -q --now ghost
systemctl restart ghost

if [ -n "$DOMAIN" ]; then SITE="$DOMAIN"; else SITE=":80"; fi
cat > /etc/caddy/Caddyfile <<CADDY
$SITE {
	encode gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
systemctl enable -q caddy
systemctl restart caddy

echo "▶ Firewall openzetten voor de website (poort 80 en 443)…"
for p in 80 443; do
  iptables -C INPUT -p tcp --dport $p -j ACCEPT 2> /dev/null || iptables -I INPUT -p tcp --dport $p -j ACCEPT
done
if command -v netfilter-persistent > /dev/null; then netfilter-persistent save > /dev/null 2>&1 || true; fi

IP=$(curl -fsS --max-time 5 https://ifconfig.me 2> /dev/null || hostname -I | awk '{print $1}')
if [ -n "$DOMAIN" ]; then BASE="https://$DOMAIN"; else BASE="http://$IP"; fi

sleep 2
echo
echo "✅  Klaar!"
echo "──────────────────────────────"
echo "🇳🇱  Jouw prijsvolger:   $BASE/prijzen.html"
echo "👻  Website-scanner:    $BASE/"
echo "🇺🇸  Voor je vriend:     $BASE/prices.html"
echo
echo "Werkt de link niet? Zet dan poort 80 en 443 open (Oracle: ORACLE.md stap 5 · Google: GOOGLE.md stap 3)."
echo "Bijwerken naar de nieuwste versie:  sudo $DIR/deploy/update.sh"
echo "Gebruiker toevoegen/wijzigen:       sudo $DIR/deploy/user.sh"
