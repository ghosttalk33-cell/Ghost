#!/usr/bin/env bash
# Gebruikers beheren.  Gebruik: sudo /opt/ghost/deploy/user.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Start dit script met sudo."; exit 1; }
cd /opt/ghost
echo "Huidige gebruikers:"; sudo -u ghost node server.js user list; echo
read -r -p "Wat wil je doen? (1 = toevoegen/wachtwoord wijzigen, 2 = verwijderen): " c < /dev/tty
read -r -p "Gebruikersnaam: " name < /dev/tty
if [ "$c" = "2" ]; then sudo -u ghost node server.js user del "$name"; exit; fi
read -r -p "Toegang (admin = alles, nl = alleen prijzen NL, us = alleen prijzen US): " role < /dev/tty
read -r -s -p "Wachtwoord: " pw < /dev/tty; echo
sudo -u ghost env GHOST_PASSWORD="$pw" node server.js user add "$name" "$role"
