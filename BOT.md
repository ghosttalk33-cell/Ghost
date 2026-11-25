# 🤖 Ghost-bot: je eigen alles-in-1 assistent in Telegram

Een bot zoals Grok, maar van jou en gekoppeld aan je eigen spullen. Hij draait op je telefoon (Termux) of op je server.

## Wat hij kan

| Grok | Ghost-bot |
|---|---|
| Chatten met geheugen | ✅ onthoudt het gesprek; `/nieuw` begint opnieuw |
| Think-modus | ✅ `/denk` (grondiger nadenken) |
| DeepSearch | ✅ `/deepsearch <vraag>`: zoekt meerdere keren, leest bronnen, rapport met links |
| Actuele info van internet | ✅ zoekt en leest webpagina's zelf als dat nodig is |
| Foto's / camera begrijpen | ✅ stuur een foto of screenshot (bijv. een COA of productpagina) |
| Bestanden lezen | ✅ PDF's en tekstbestanden |
| Modi / companions | ✅ `/persona`: standaard, grappig, zakelijk, docent, coach, marketeer |
| Tasks (geplande opdrachten) | ✅ "elke ochtend om 8 uur …", "herinner me morgen om 9 uur …" (`/taken`) |
| Geheugen over jou | ✅ "onthoud dat …" (`/geheugen`) |
| Afbeeldingen maken | ✅ optioneel met een xAI-sleutel (`/afbeelding …`) |
| Spraakgesprek | ❌ nog niet: gebruik de microfoon op je toetsenbord |
| **Extra: Gmail** | ✅ mails lezen, samenvatten en beantwoorden, **alleen na jouw ✅-knop** |
| **Extra: prijsvolger** | ✅ `/prijs`, `/scan`, "wat is er goedkoper geworden?" |

Alleen jij kunt hem gebruiken: hij reageert alleen op jouw Telegram-ID.

## Instellen (± 10 minuten)

1. **Telegram-bot maken:** open Telegram, zoek **@BotFather**, stuur `/newbot`, kies een naam. Je krijgt een **token** (lange code).
2. **Claude-sleutel:** ga naar **console.anthropic.com** → API Keys → Create Key. Zet er een klein tegoed op (bijv. €5–10).
3. **Gmail (optioneel):** zet 2-stapsverificatie aan en maak een app-wachtwoord op **myaccount.google.com/apppasswords**.
4. In Termux:
   ```
   cd ~/Ghost && git pull
   cd bot && npm install && cp .env.voorbeeld .env && nano .env
   ```
   Vul het token, de Claude-sleutel en eventueel je mail in. Opslaan: **CTRL+O, Enter, CTRL+X**.
5. Start: `node bot.js`. Stuur je bot in Telegram een bericht: hij antwoordt met **jouw ID**. Zet dat in `.env` bij `OWNER_ID=`, stop de bot (**CTRL+C**) en start opnieuw.
6. Werkt het? Laat hem dan voortaan vanzelf draaien met de rest:
   ```
   sh ~/Ghost/scripts/termux-start.sh stop && sh ~/Ghost/scripts/termux-start.sh
   ```
   Het startscript (en dus ook Termux:Boot) start de bot automatisch zodra `bot/.env` bestaat.

## Kosten
Het brein is Claude Opus 5.5 ($4 per miljoen woorden-stukjes in, $20 uit). Normaal chatten kost meestal enkele centen per gesprek; een DeepSearch iets meer. Zet een maandlimiet in de Anthropic-console, dan kan het nooit uit de hand lopen.

## Veilig
* `bot/.env` bevat je sleutels: deel het met niemand, het gaat nooit naar GitHub.
* Mails worden **nooit** zonder jouw tik op ✅ verstuurd.
* Logboek: `tail -30 ~/Ghost/data/bot.log`.
