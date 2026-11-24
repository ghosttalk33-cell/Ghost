# ☁️ Ghost online zetten op Oracle Cloud (gratis)

Na deze stappen draait alles 24/7 op een gratis server. Jij en je vriend openen het met een link, op elke telefoon (ook een iPhone) en met een wachtwoord.

Tijd: ± 30 minuten. Je hebt nodig: je telefoon met **Termux** (heb je al) en een **creditcard** (alleen ter controle, er wordt niets afgeschreven).

---

## Stap 1: Oracle-account aanmaken

1. Ga naar **https://www.oracle.com/cloud/free/** en tik op **"Start for free"**.
2. Vul je gegevens in en bevestig je e-mailadres.
3. **Home Region**: kies **Netherlands Northwest (Amsterdam)** of **Germany Central (Frankfurt)**.
   ⚠️ Dit kun je later **niet** meer wijzigen.
4. Vul je creditcard in. Er komt een tijdelijke controle van een paar cent die direct wordt teruggestort.
5. Wacht tot je de e-mail **"Your account is ready"** krijgt. Dat kan 5 tot 30 minuten duren.

## Stap 2: server aanmaken

1. Log in op **https://cloud.oracle.com**.
2. Tik op **☰ (menu)** → **Compute** → **Instances** → **Create instance**.
3. **Name**: bijvoorbeeld `ghost`.
4. **Image and shape** → **Edit**:
   - **Image** → *Change image* → **Ubuntu** → **Canonical Ubuntu 24.04** → *Select image*
   - **Shape** → *Change shape* → **Ampere** → **VM.Standard.A1.Flex**, met **1 OCPU** en **6 GB** geheugen → *Select shape*
   - Staat er **"Always Free-eligible"**? Dan is het gratis. ✅
5. **Networking**: laat de standaard staan (*Create new virtual cloud network* en **Assign a public IPv4 address = Yes**).
6. **Add SSH keys**: kies **Generate a key pair for me** en tik op **Save private key**.
   Het bestand (`ssh-key-….key`) komt in je **Downloads**. Bewaar het goed: dit is je sleutel tot de server.
7. Tik op **Create**.
8. Wacht tot de status **RUNNING** (groen) is. Noteer het **Public IP address**, bijvoorbeeld `141.144.200.10`.

> **"Out of capacity"?** Probeer een ander *Availability domain* (AD-2 of AD-3) bij stap 2.5, of kies als shape **VM.Standard.E2.1.Micro** (ook gratis, kleiner, maar genoeg).

## Stap 3: inloggen op de server vanuit Termux

Open **Termux** en plak deze regels één voor één (vervang het IP-adres door dat van jou):

```
pkg install -y openssh
termux-setup-storage
```
Tik op **Toestaan** als je telefoon om toegang tot bestanden vraagt. Daarna:

```
cp ~/storage/downloads/ssh-key-*.key ~/oracle.key && chmod 600 ~/oracle.key
ssh -i ~/oracle.key ubuntu@141.144.200.10
```
Vraagt hij *"Are you sure you want to continue connecting?"*, typ dan **yes** en druk op Enter.

Je zit nu op de server. Je ziet iets als `ubuntu@ghost:~$`.

## Stap 4: alles installeren (één commando)

Plak dit op de server:

```
curl -fsSL https://raw.githubusercontent.com/ghosttalk33-cell/Ghost/refs/heads/claude/wat-kan-je-nog-maken-2vgrv8/deploy/install.sh | sudo bash
```

Het script vraagt:
- **Domeinnaam**: druk gewoon op Enter (dat kan later nog, zie stap 7)
- **Jouw gebruikersnaam en wachtwoord**: hiermee kun je overal bij
- **Gebruikersnaam en wachtwoord voor je vriend**: die ziet alleen de 🇺🇸 prijzen

Na een paar minuten zie je:
```
✅  Klaar!
🇳🇱  Jouw prijsvolger:   http://141.144.200.10/prijzen.html
🇺🇸  Voor je vriend:     http://141.144.200.10/prices.html
```

## Stap 5: poorten openzetten in Oracle

Oracle blokkeert standaard al het websiteverkeer. Dat zet je zo open:

1. Ga in Oracle naar je **instance** (Compute → Instances → ghost).
2. Tik bij **Primary VNIC** op de link achter **Subnet** (iets als `subnet-2025…`).
3. Tik op **Security Lists** → **Default Security List for …**.
4. Tik op **Add Ingress Rules** en vul in:
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: `TCP`
   - **Destination Port Range**: `80,443`
5. Tik op **Add Ingress Rules**.

Open nu **http://JOUW-IP/prijzen.html** in Brave. Je ziet het inlogscherm. 🎉

## Stap 6: delen met je vriend

Stuur je vriend:
> Here's the peptide price tracker: **http://141.144.200.10/prices.html**
> Username: *…* · Password: *…*
> Tap **🔎 Find shops** the first time to find all US shops.

Je vriend ziet alleen de 🇺🇸 prijsvolger. Jouw 🇳🇱 prijzen en de website-scanner zijn voor hem afgeschermd.

## Stap 7 (optioneel): eigen domein met slotje 🔒 via Strato

Dan wordt je link bijvoorbeeld **https://prijzen.jouwnaam.nl** in plaats van een IP-adres.

1. Log in bij **Strato** → **Domeinen** → **Domeinbeheer**.
2. Maak een **subdomein** aan, bijvoorbeeld `prijzen`.
3. Ga bij dat subdomein naar **DNS-instellingen** → **A-record** en vul het **IP-adres van je Oracle-server** in. Sla op.
4. Wacht 15–60 minuten tot het actief is.
5. Log in op de server (stap 3) en voer het installatiescript (stap 4) **nog een keer** uit. Vul nu bij *Domeinnaam* `prijzen.jouwnaam.nl` in.

Caddy regelt automatisch een gratis https-certificaat.

Je WordPress-site bij Strato blijft gewoon werken.

## Stap 8 (aanbevolen): zorgen dat Oracle je server niet opruimt

Oracle kan gratis servers die weinig doen na een tijd uitzetten. Zo voorkom je dat:

1. Ga in Oracle naar **☰ → Billing & Cost Management → Upgrade and Manage Payment**.
2. Kies **Pay As You Go**.
   Je blijft **gratis** zolang je binnen de *Always Free*-grenzen blijft, en deze server valt daarbinnen.
3. Zet voor de zekerheid een **budgetwaarschuwing** van € 1: **Billing → Budgets → Create Budget**. Dan krijg je een mail als er ooit iets kost.

---

## Later nodig

Inloggen op de server (vanuit Termux):
```
ssh -i ~/oracle.key ubuntu@JOUW-IP
```

| Wat | Commando (op de server) |
|---|---|
| Nieuwste versie installeren | `sudo /opt/ghost/deploy/update.sh` |
| Gebruiker toevoegen, wachtwoord wijzigen of gebruiker verwijderen | `sudo /opt/ghost/deploy/user.sh` |
| Kijken of alles draait | `sudo systemctl status ghost` |
| Logboek bekijken | `sudo journalctl -u ghost -n 50` |
| Herstarten | `sudo systemctl restart ghost` |

**Rollen:** `admin` = alles · `nl` = alleen de Nederlandse prijsvolger · `us` = alleen de Amerikaanse prijsvolger
