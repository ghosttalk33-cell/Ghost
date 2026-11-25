#!/data/data/com.termux/files/usr/bin/sh
# Start de Ghost-server en de telefoonmeldingen op de achtergrond (Termux).
# Veilig om vaker te draaien: wat al draait, wordt niet nog eens gestart.
#
#   sh ~/Ghost/scripts/termux-start.sh          starten
#   sh ~/Ghost/scripts/termux-start.sh stop     alles stoppen
#   sh ~/Ghost/scripts/termux-start.sh status   kijken wat er draait
#
# Logbestanden: ~/Ghost/data/server.log en ~/Ghost/data/melding.log

DIR="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$DIR/data"
cd "$DIR" || exit 1

running() { pgrep -f "$1" >/dev/null 2>&1; }

case "$1" in
  stop)
    pkill -f "node server.js" ; pkill -f "termux-melding.js" ; pkill -f "node bot.js"
    command -v termux-wake-unlock >/dev/null && termux-wake-unlock
    echo "⏹  Gestopt."; exit 0 ;;
  status)
    running "node server.js" && echo "✅ Server draait  → http://localhost:3000" || echo "❌ Server draait niet"
    running "termux-melding.js" && echo "✅ Meldingen draaien" || echo "❌ Meldingen draaien niet"
    [ -f bot/.env ] && { running "node bot.js" && echo "✅ Ghost-bot draait" || echo "❌ Ghost-bot draait niet"; }
    exit 0 ;;
esac

# telefoon niet laten slapen, anders stopt Android de server
command -v termux-wake-lock >/dev/null && termux-wake-lock

if running "node server.js"; then
  echo "✅ Server draaide al"
else
  nohup node server.js >> data/server.log 2>&1 &
  echo "▶️  Server gestart → http://localhost:3000"
fi

if running "termux-melding.js"; then
  echo "✅ Meldingen draaiden al"
else
  nohup node scripts/termux-melding.js >> data/melding.log 2>&1 &
  echo "🔔 Meldingen gestart"
fi

# Ghost-bot (Telegram) alleen als hij is ingesteld (bot/.env)
if [ -f bot/.env ]; then
  if running "node bot.js"; then
    echo "✅ Ghost-bot draaide al"
  else
    [ -d bot/node_modules ] || (cd bot && npm install --no-audit --no-fund >/dev/null 2>&1)
    (cd bot && nohup node bot.js >> ../data/bot.log 2>&1 &)
    echo "🤖 Ghost-bot gestart"
  fi
fi
