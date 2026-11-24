# ☁️ Ghost online zetten op Google Cloud (gratis)

Google heeft een server die **altijd gratis** is (de "e2-micro"), zolang je de juiste instellingen kiest. Die staan hieronder **vetgedrukt**. Wijk daar niet van af, anders kan het geld kosten.

Tijd: ± 25 minuten. Je hebt alleen je telefoon (of een computer) nodig.

---

## Stap 1: account aanmaken

1. Ga naar **https://cloud.google.com/free** en tik op **"Aan de slag"** / **"Get started for free"**.
2. Log in met je Google-account (Gmail).
3. Kies land **Nederland**, accepteer de voorwaarden en vul je betaalgegevens in.
   Je krijgt **$300 tegoed voor 90 dagen** en daarnaast de **altijd-gratis server**. Er wordt niets afgeschreven.

## Stap 2: server aanmaken

1. Ga naar **https://console.cloud.google.com/compute/instances**.
   Vraagt Google om de **Compute Engine API** in te schakelen? Tik op **Inschakelen** en wacht een minuutje.
2. Tik op **"Instantie maken"** / **"Create instance"**.
3. Vul het volgende in:

| Instelling | Kies dit |
|---|---|
| **Naam** | `ghost` |
| **Regio** | **us-central1 (Iowa)**, **us-west1 (Oregon)** of **us-east1 (South Carolina)**. ⚠️ Alleen deze drie zijn gratis! |
| **Zone** | maakt niet uit |
| **Machineconfiguratie** | Serie **E2**, machinetype **e2-micro** |

Rechts zie je een prijsschatting. Daar hoort te staan dat de e2-micro **gratis** is ("free tier" of "Your first 744 hours of e2-micro usage are free").

4. Ga naar **Besturingssysteem en opslag** / **OS and storage** → **Wijzigen** / **Change**:

| Instelling | Kies dit |
|---|---|
| **Besturingssysteem** | **Ubuntu** |
| **Versie** | **Ubuntu 24.04 LTS** (x86/64, **niet** "Minimal" en **niet** "Arm64") |
| **Type opslagschijf** | **Standaard persistente schijf** / **Standard persistent disk** ⚠️ niet "Balanced" of "SSD", die kosten geld |
| **Grootte** | **30 GB** (maximaal gratis) |

Tik op **Selecteren**.

5. Ga naar **Gegevensbescherming** / **Data protection** (als je dat ziet) → kies **Geen back-ups** / **No backups**. Back-ups kosten geld.

6. Ga naar **Netwerken** / **Networking** → **Firewall** en vink **beide** aan:
   - ✅ **HTTP-verkeer toestaan** / **Allow HTTP traffic**
   - ✅ **HTTPS-verkeer toestaan** / **Allow HTTPS traffic**

7. Tik onderaan op **Maken** / **Create**.

Na een minuut staat er een groen vinkje ✅. Noteer het **externe IP-adres** / **External IP**, bijvoorbeeld `34.123.45.67`.

## Stap 3: inloggen op de server (in je browser)

Hiervoor heb je geen sleutel of Termux nodig:

1. Tik in de lijst met servers achter `ghost` op **SSH**.
2. Er opent een zwart venster. Tik op **Authorize** / **Autoriseren** als dat gevraagd wordt.
3. Na een paar seconden zie je iets als `jouwnaam@ghost:~$`. Je zit op de server.

> Werkt het venster slecht op je telefoon? Gebruik dan een computer, of zet Chrome in de **desktopversie** (⋮ → *Desktopsite*).

## Stap 4: alles installeren (één commando)

Kopieer deze regel en plak hem in het SSH-venster. Op een telefoon: lang drukken en dan **Plakken**, of het plakicoon op je toetsenbord. Druk daarna op **Enter**:

```
curl -fsSL https://raw.githubusercontent.com/ghosttalk33-cell/Ghost/refs/heads/claude/wat-kan-je-nog-maken-2vgrv8/deploy/install.sh | sudo bash
```

Het script vraagt:
- **Domeinnaam**: druk gewoon op **Enter** (kan later, zie stap 6)
- **Jouw gebruikersnaam en wachtwoord**: hiermee kun je overal bij. Tijdens het typen van het wachtwoord zie je niets; dat is normaal.
- **Gebruikersnaam en wachtwoord voor je vriend**: die ziet alleen de 🇺🇸 prijzen

Na ± 5 minuten zie je:
```
✅  Klaar!
🇳🇱  Jouw prijsvolger:   http://34.123.45.67/prijzen.html
🇺🇸  Voor je vriend:     http://34.123.45.67/prices.html
```

Open de link in Brave. Je ziet het inlogscherm. 🎉

## Stap 5: delen met je vriend

Stuur je vriend:
> Here's the peptide price tracker: **http://34.123.45.67/prices.html**
> Username: *…* · Password: *…*
> Tap **🔎 Find shops** the first time to find all US shops.

## Stap 6 (optioneel): eigen domein met slotje 🔒 via Strato

Dan wordt je link bijvoorbeeld **https://prijzen.jouwnaam.nl**:

1. **Strato** → **Domeinen** → **Domeinbeheer** → maak een **subdomein** aan (bijv. `prijzen`).
2. Zet bij dat subdomein in de **DNS-instellingen** een **A-record** naar het **IP-adres van je Google-server**.
3. Wacht 15–60 minuten.
4. Open opnieuw het SSH-venster (stap 3) en plak het installatiecommando (stap 4) **nog een keer**. Vul nu bij *Domeinnaam* `prijzen.jouwnaam.nl` in.

Je WordPress-site bij Strato blijft gewoon werken.

## Stap 7: belangrijk om het gratis te houden

1. **Budgetwaarschuwing instellen**: ga naar **https://console.cloud.google.com/billing** → **Budgetten en meldingen** / **Budgets & alerts** → **Budget maken** → bedrag **€ 1**. Dan krijg je een mail als er ooit iets kost.
2. **Na 90 dagen** vraagt Google om je account te **upgraden** naar een betaald account. Doe dat, anders wordt je server gestopt. De e2-micro **blijft gratis**, je betaalt alleen als je meer gebruikt dan het gratis pakket.
3. **Zet de server niet uit.** Bij opnieuw aanzetten kan het IP-adres veranderen. Heb je een eigen domein, pas dan het A-record aan.

---

## Later nodig

Inloggen op de server: console.cloud.google.com → **Compute Engine** → **VM-instanties** → **SSH** achter `ghost`.

| Wat | Commando (op de server) |
|---|---|
| Nieuwste versie installeren | `sudo /opt/ghost/deploy/update.sh` |
| Gebruiker toevoegen, wachtwoord wijzigen of gebruiker verwijderen | `sudo /opt/ghost/deploy/user.sh` |
| Kijken of alles draait | `sudo systemctl status ghost` |
| Logboek bekijken | `sudo journalctl -u ghost -n 50` |
| Herstarten | `sudo systemctl restart ghost` |

**Rollen:** `admin` = alles · `nl` = alleen de Nederlandse prijsvolger · `us` = alleen de Amerikaanse prijsvolger
