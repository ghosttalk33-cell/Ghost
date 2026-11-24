# 💰 Peptide Price Tracker (USA): setup guide

This app finds peptide shops in the USA, compares their prices **per mg** and checks their **COAs** (certificates of analysis). It runs on your own phone or computer. No account or subscription is needed.

## Android phone (Termux)

1. Install **Termux** from F-Droid: https://f-droid.org/packages/com.termux/
   (the Google Play version is outdated)
2. Open Termux, paste this line and press Enter. Answer `y` if it asks anything:
   ```
   yes | pkg upgrade && pkg install -y nodejs git && git clone -b claude/wat-kan-je-nog-maken-2vgrv8 https://github.com/ghosttalk33-cell/Ghost.git && cd Ghost && node server.js
   ```
3. When you see `Ghost Crawler v3 draait op http://localhost:3000`, open Chrome and go to:
   **http://localhost:3000/prices.html**
4. Leave Termux running in the background. To keep it running with the screen off, pull down the notification bar and tap **Acquire wakelock** in the Termux notification.

**Next time:** open Termux and type
```
cd Ghost && git pull && node server.js
```

## Windows / Mac computer

1. Install **Node.js** (LTS) from https://nodejs.org
2. Download the code: https://github.com/ghosttalk33-cell/Ghost/archive/refs/heads/claude/wat-kan-je-nog-maken-2vgrv8.zip and unzip it
3. Open a terminal (Windows: *Command Prompt*, Mac: *Terminal*) in that folder and run:
   ```
   node server.js
   ```
4. Open **http://localhost:3000/prices.html** in your browser

## iPhone

iPhones can't run the server. Run it on a computer, then open `http://<computer-ip>:3000/prices.html` on your iPhone while both are on the same Wi-Fi.

## How to use it

1. **🔎 Find shops**: tap **Find shops**. The app runs about 25 searches, checks every website it finds, and adds the US peptide shops automatically. This takes a few minutes.
   - Tip: get a free **Brave Search API key** (api.search.brave.com, 2,000 searches/month) and paste it under *Find shops → Advanced*. Without a key the app uses Bing/DuckDuckGo, which sometimes block automated searches.
2. **Best deals**: the cheapest price per mg for each peptide.
3. **Compare**: all offers for a peptide and dose, sorted by price per mg, with COA status, purity, price history and vendor info (payment methods, free shipping threshold, ships from).
4. **Price alerts**: get notified when, for example, BPC-157 drops below $5/mg.
5. **COAs**: a COA score for each vendor, showing how many products have a (verifiable) lab report.
6. **Changes**: price drops, price increases, new products and restocks.
7. **Shops**: add shops by hand, rescan, and turn on automatic updates (every 3–24 hours).

⚠️ COAs can be faked or come from a different batch. Janoshik reports can be verified on janoshik.com. Prices exclude shipping. Always check vendor reputation yourself and what is legal where you live.
