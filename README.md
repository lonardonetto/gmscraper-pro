# GMScraper Pro

A professional Google Maps scraping desktop application built with Electron.js.

## Features

- Playwright-based Google Maps scraper (no API key needed)
- Real-time progress + log console
- Results table with search/filter
- Export to CSV and Excel
- License key system with remote validation server
- Proxy support with optional rotation
- Auto-update via electron-updater
- Dark modern UI

---

## Project Structure

```
gpmscraper/
├── src/
│   ├── main/
│   │   ├── main.js              # Electron main process
│   │   ├── license-manager.js   # License validation logic
│   │   ├── scraper-engine.js    # Playwright scraper
│   │   ├── db-manager.js        # SQLite storage
│   │   ├── export-manager.js    # CSV + Excel export
│   │   └── proxy-manager.js     # Proxy handling
│   ├── preload/
│   │   └── preload.js           # Context bridge
│   └── renderer/
│       ├── index.html           # Main app
│       ├── license.html         # License activation screen
│       ├── styles/main.css
│       └── scripts/
│           ├── renderer.js
│           └── license.js
├── license-server/
│   ├── server.js                # Express license API
│   ├── seed-license.js          # Create test key
│   └── package.json
├── build/                       # Icons for packaging
│   ├── icon.ico
│   └── icon.png
├── scripts/
│   └── obfuscate.js             # Code obfuscation
└── package.json
```

---

## Setup & Development

### 1. Install Dependencies

```powershell
# Main app
cd E:\gpmscraper
npm install

# Install Playwright browsers
npx playwright install chromium

# License server
cd license-server
npm install
```

### 2. Add App Icons

Place the following in `build/`:
- `icon.ico` — Windows icon (256×256 ICO)
- `icon.png` — PNG version (256×256)

Free icon resources: https://www.flaticon.com, https://convertio.co/png-ico/

### 3. Configure Environment

```powershell
# Main app
Copy-Item .env.example .env
# Edit .env: set LICENSE_SERVER_URL to your server URL

# License server
cd license-server
Copy-Item .env.example .env
# Edit .env: set a strong ADMIN_SECRET
```

### 4. Start License Server

```powershell
cd license-server
node seed-license.js    # Creates test key: TEST-1234-ABCD-5678
node server.js
```

### 5. Run in Development

```powershell
cd E:\gpmscraper
npm run dev
```

---

## Cross-Platform Builds (Windows + macOS)

### Option 1: GitHub Actions (Recommended)
1. Push your code to GitHub
2. GitHub Actions will automatically build:
   - Windows: `.exe` installer
   - macOS: `.dmg` installer (Intel + Apple Silicon)
3. Download artifacts from the Actions tab or create a Release

### Option 2: Local Builds

**Windows:**
```powershell
cd E:\gpmscraper
npm run build:win
```

**macOS (requires a Mac):**
```bash
cd /path/to/project
npm run build:mac
```

**Keygen GUI builds:**
```bash
# Windows
cd keygen-gui && npm run build:win

# macOS
cd keygen-gui && npm run build:mac
```

### Outputs
- Main scraper: `dist/GMScraper Pro Setup 1.0.0.exe` (Windows) or `GMScraper Pro-1.0.0.dmg` (macOS)
- Keygen: `keygen-gui/dist/GMScraper Keygen Setup 1.0.0.exe` (Windows) or `GMScraper Keygen-1.0.0.dmg` (macOS)

---

## License Server API

### Validate License
```
POST /api/license/validate
{ "licenseKey": "XXXX-XXXX-XXXX-XXXX", "machineId": "..." }
```

### Deactivate License
```
POST /api/license/deactivate
{ "licenseKey": "...", "machineId": "..." }
```

### Admin — Create License Key
```
POST /api/admin/create-license
Headers: x-admin-secret: <ADMIN_SECRET>
Body: { "plan": "pro", "maxActivations": 1, "expiresAt": "2025-12-31" }
```

### Admin — List All Licenses
```
GET /api/admin/licenses
Headers: x-admin-secret: <ADMIN_SECRET>
```

### Admin — Revoke License
```
DELETE /api/admin/licenses/:key
Headers: x-admin-secret: <ADMIN_SECRET>
```

---

## Code Obfuscation

Before building for production:
```powershell
node scripts/obfuscate.js
```

Then update `src/main/main.js` to require the `.obf.js` files instead.

---

## Auto-Update

1. Set your GitHub repo in `package.json` → `build.publish`
2. Create a GitHub release with tag `v1.0.0`
3. Attach the built `.exe` to the release
4. Electron will auto-detect and prompt users on next launch

---

## Test License Key

After running `node license-server/seed-license.js`:
```
TEST-1234-ABCD-5678
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Desktop shell | Electron 29 |
| Scraper | Playwright (Chromium) |
| Database | better-sqlite3 |
| Export | csv-writer, ExcelJS |
| License server | Express + SQLite |
| Packaging | electron-builder |
| Security | crypto-js, javascript-obfuscator |
