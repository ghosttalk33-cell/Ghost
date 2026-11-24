# 👻 Ghost Crawler

Een volledige websitescan die op je computer of telefoon draait. Je vult een website in en krijgt:

- een **score van 0 tot 100**, plus deelscores voor SEO, snelheid, techniek, toegankelijkheid, inhoud en beveiliging
- **SEO**: titels, omschrijvingen, koppen, dubbele inhoud, canonical, noindex, Open Graph, gestructureerde data, URL-structuur, sitemapcontrole en soft-404
- **snelheid**: reactietijd van de server, laadtijd, zware afbeeldingen, scripts die het laden blokkeren, compressie, met concrete tips
- **kapotte links en afbeeldingen**: intern en extern
- **beveiliging**: HTTPS, SSL-certificaat met vervaldatum, www-/https-doorverwijzing, beveiligingsheaders, veilige cookies en gelekte bestanden (.env, .git, back-ups, debug.log, phpinfo, WordPress-gebruikers)
- **privacy (AVG)**: trackers zonder cookiebanner, privacyverklaring en algemene voorwaarden (bij webshops)
- **toegankelijkheid**: alt-teksten, links en knoppen zonder tekst, formuliervelden zonder label, kopvolgorde en taal
- **inhoud**: leesbaarheid (Flesch-Douma), meest gebruikte woorden, contactgegevens en social-media-profielen
- **technologie**: CMS, plugins, analytics en betaalmodules
- **slim overslaan** van winkelwagen-, afreken- en inlogpagina's
- **zoeken op woorden** over de hele site
- **geschiedenis**: elke scan wordt bewaard, zodat je kunt vergelijken (▲ +6)
- **export**: PDF-rapport, CSV (Excel), JSON, sitemap.xml en contactgegevens

De scan loopt op de server, dus hij gaat door als je tussendoor van app wisselt of de pagina herlaadt.

<img src="screenshot.png" width="320" alt="screenshot">

## 💰 Prijsvolger (🇳🇱 Nederland en 🇺🇸 USA)

Twee versies van de prijsvolger voor peptidewebshops:

| | Adres | Taal | Valuta | Zoekt shops in |
|---|---|---|---|---|
| 🇳🇱 | http://localhost:3000/prijzen.html | Nederlands | EUR | Nederland, België en Europa |
| 🇺🇸 | http://localhost:3000/prices.html | English | USD | USA ([installatiegids in het Engels](INSTALL-US.md)) |

- **🔎 Shops zoeken**: zoekt via zoekmachines alle peptideshops in het land, controleert of elke website echt een peptideshop is en bij het land past, en voegt ze automatisch toe
- **Beste deals**: de goedkoopste prijs per mg per peptide
- **Vergelijken**: per peptide en dosering, met prijs per mg (kits en blends meegerekend), COA-status, zuiverheid, prijsverloop en shopinfo (betaalmethodes, gratis verzending, land van verzending)
- **COA-check**: certificaat, lab, zuiverheid, Janoshik-verificatie, plus een COA-score per shop
- **Prijsalarm**: een melding als een peptide onder jouw prijs per mg of prijs komt
- **Wijzigingen**: prijsdalingen, prijsstijgingen, nieuwe producten en producten die weer op voorraad zijn
- **Automatisch** prijzen bijwerken en opnieuw naar nieuwe shops zoeken
- export naar **CSV**

## ☁️ Online zetten (gratis)

Zie **[GOOGLE.md](GOOGLE.md)** (Google Cloud) of **[ORACLE.md](ORACLE.md)** (Oracle Cloud): stap voor stap op een gratis server, met inloggen (jij ziet alles, je vriend alleen de 🇺🇸 prijzen), automatisch herstarten en optioneel je eigen domein met https.

## Op je Android-telefoon (Termux)

1. Installeer **Termux** via F-Droid: https://f-droid.org/packages/com.termux/
2. Plak dit in Termux:
   ```
   yes | pkg upgrade && pkg install -y nodejs git && git clone -b claude/wat-kan-je-nog-maken-2vgrv8 https://github.com/ghosttalk33-cell/Ghost.git && cd Ghost && node server.js
   ```
3. Open in je browser: **http://localhost:3000**

De volgende keer:
```
cd Ghost && git pull && node server.js
```

## Op een computer

Je hebt [Node.js](https://nodejs.org) 18 of nieuwer nodig.

```bash
node server.js
```

Open daarna **http://localhost:3000**.

## Waarom een server en geen los HTML-bestand?

Browsers blokkeren het ophalen van andere websites vanuit een HTML-pagina (CORS). Daarom haalt `server.js` de pagina's op en is `public/index.html` de bediening.

Crawl netjes en alleen sites waarvoor je toestemming hebt.
