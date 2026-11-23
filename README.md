# 👻 Ghost Crawler

Een website-crawler met een webinterface. Geef een URL op en de crawler volgt alle links op die site. Per pagina zie je de status, titel, meta description, H1, aantal links en woorden, laadtijd, kapotte links en gevonden e-mailadressen.

![screenshot](screenshot.png)

## Starten

Je hebt alleen [Node.js](https://nodejs.org) 18 of nieuwer nodig. Er hoeft niets geïnstalleerd te worden.

```bash
node server.js
```

Open daarna **http://localhost:3000** in je browser.

## Functies

- Live resultaten tijdens het crawlen
- Instellingen voor het maximale aantal pagina's, de diepte, het aantal gelijktijdige verzoeken en de pauze tussen verzoeken
- Filteren met regex: alleen bepaalde URL's crawlen of juist uitsluiten
- Houdt zich standaard aan `robots.txt` en blijft op hetzelfde domein
- Fouten zoals 404, 500 en time-outs vallen direct op
- Klik op een rij voor details
- Sorteren en filteren in de tabel
- Exporteren naar **CSV**, **JSON** of een lijst met **e-mailadressen**

## Waarom een server en geen los HTML-bestand?

Browsers blokkeren het ophalen van andere websites vanuit een HTML-pagina (CORS). Daarom haalt `server.js` de pagina's op en is `public/index.html` de bediening.

## Achter een proxy

```bash
NODE_USE_ENV_PROXY=1 node server.js
```

Crawl netjes en alleen sites waarvoor je toestemming hebt.
