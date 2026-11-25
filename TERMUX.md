# 📱 Termux: meldingen, automatisch starten en handige extra's

Dit is voor de prijsvolger op je Android-telefoon. Je hebt Termux al; je installeert er twee kleine apps bij.

## 1. Eenmalig installeren

1. Installeer uit **F-Droid** (dezelfde plek als Termux, anders werken ze niet samen):
   - **Termux:API**: https://f-droid.org/packages/com.termux.api/
   - **Termux:Boot**: https://f-droid.org/packages/com.termux.boot/
2. Open **Termux:Boot** één keer (gewoon openen en weer sluiten). Daarmee mag hij starten na een herstart.
3. Zet bij Android-instellingen → Apps → **Termux** → Batterij op **Onbeperkt** (niet optimaliseren). Anders sluit Android de server af.
4. Plak dit in Termux:
   ```
   pkg install -y termux-api
   cd ~/Ghost && git fetch origin claude/nlpeptideshop-promo-video-w7vqj1 && git checkout FETCH_HEAD -- scripts/termux-melding.js scripts/termux-start.sh TERMUX.md
   ```
5. Test of meldingen werken. Er moet een melding op je telefoon verschijnen:
   ```
   termux-notification --title "Test" --content "Meldingen werken 👍"
   ```
   Komt er niets? Geef Termux:API toestemming voor meldingen (Android-instellingen → Apps → Termux:API → Meldingen).

## 2. Prijsmelding op je telefoon 🔔

Start alles met:
```
sh ~/Ghost/scripts/termux-start.sh
```

Je krijgt nu een melding:
- **🔔 Prijsalarm**: een product komt onder de prijs die je in de prijsvolger bij **Prijsalarm** hebt ingesteld.
- **📉 Prijsdaling**: een prijs is minstens **5%** gezakt.

Tik op de melding om de productpagina te openen. Wat al gemeld is, komt niet nog een keer. Na een grote scan krijg je maximaal 5 meldingen plus één samenvatting.

Liever alleen grote dalingen? Stop en start met een hogere drempel:
```
sh ~/Ghost/scripts/termux-start.sh stop
MIN_DROP=10 sh ~/Ghost/scripts/termux-start.sh
```

## 3. Vanzelf starten en scannen ⏰

**Na een herstart van je telefoon vanzelf starten:**
```
mkdir -p ~/.termux/boot && printf '#!/data/data/com.termux/files/usr/bin/sh\nsh ~/Ghost/scripts/termux-start.sh\n' > ~/.termux/boot/start-ghost && chmod +x ~/.termux/boot/start-ghost
```

**Elke paar uur prijzen bijwerken:** open http://localhost:3000/prijzen.html → **⏰ Prijzen automatisch bijwerken** → kies bijvoorbeeld *Elke 6 uur*. Daaronder kun je ook instellen dat hij af en toe naar nieuwe shops zoekt.

**Handige commando's:**
| Wat | Commando |
|---|---|
| Kijken wat er draait | `sh ~/Ghost/scripts/termux-start.sh status` |
| Alles stoppen | `sh ~/Ghost/scripts/termux-start.sh stop` |
| Laatste meldingen zien | `tail -20 ~/Ghost/data/melding.log` |
| Serverlog zien | `tail -20 ~/Ghost/data/server.log` |

## 4. Wat is nog meer handig?

**Bestanden van je telefoon gebruiken**
```
termux-setup-storage
```
Daarna staan je Downloads in `~/storage/downloads` en je foto's/video's in `~/storage/dcim`.

**Video's klein maken voor WhatsApp of knippen** (`pkg install -y ffmpeg`):
```
cd ~/storage/downloads
ffmpeg -i video.mp4 -vf scale=720:-2 -crf 28 klein.mp4         # kleiner bestand
ffmpeg -i video.mp4 -ss 0 -t 10 -c copy eerste10sec.mp4       # stuk knippen
ffmpeg -i video.mp4 -vf "fps=12,scale=480:-1" animatie.gif     # GIF maken
```

**De prijsvolger op je laptop of andere telefoon openen** (zelfde wifi):
```
termux-wifi-connectioninfo | grep ip
```
Open dan `http://<dat-adres>:3000` op je laptop (bijvoorbeeld `http://192.168.1.23:3000`).

**Melding als je telefoon bijna leeg is** (de server stopt dan):
```
termux-battery-status
```

**Bijwerken naar de nieuwste versie:**
```
cd ~/Ghost && git pull && sh scripts/termux-start.sh stop && sh scripts/termux-start.sh
```

**Altijd online, ook als je telefoon uit staat?** Zet het op een gratis server: zie [ORACLE.md](ORACLE.md). De meldingen werken dan niet via Termux:API, maar de prijsvolger blijft 24/7 scannen.
