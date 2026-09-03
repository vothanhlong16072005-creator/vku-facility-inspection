# VKU Facility Inspection PWA

A Progressive Web Application (PWA) built for the **Mobile Cross-Platform** coursework. It is designed to assist staff in inspecting and evaluating campus facilities. The architecture is **Offline-First**, ensuring seamless data collection even without internet connectivity.

##  Key Features

*   **Offline-First & Sub-second Boot:** Utilizes a Service Worker with a Cache-First strategy for the App Shell. It works flawlessly in Airplane mode or dead zones.
*   **PWA Installable:** Full `manifest.json` configuration for "Add to Home Screen" capability on iOS and Android. Runs as a standalone application.
*   **Local Persistence:** Employs `IndexedDB` for robust, structured local data storage (including high-resolution Base64 photos).
*   **Live Drafting:** Auto-saves form input every 500ms. No data is lost if the app is accidentally closed.
*   **Background Auto-Sync:** A dedicated sync engine uses a FIFO queue to automatically push pending inspections to the cloud immediately when network connectivity is restored (`window.ononline`).
*   **Industrial Mobile-first UI:** Single-page scrollable form optimized for touch interactions.

##  Modular Architecture

The project is structured into clear, decoupled modules:

```text
├── css/
│   └── styles.css       # Mobile-first industrial styling
├── js/
│   ├── app.js           # Main UI Controller & form state management
│   ├── db.js            # IndexedDB abstraction layer
│   ├── sync.js          # Auto-sync queue and network retry logic
│   └── api.js           # Network requests (fetch API with no-cors)
├── apps-script/
│   └── Code.gs          # Google Apps Script backend logic
├── icons/               # PWA App Icons
├── index.html           # Main App Shell
├── sw.js                # Service Worker for offline caching
└── manifest.json        # PWA configuration
```

##  Setup Instructions

### 1. Local Development (Frontend)
No build step is required. The app is built with Vanilla JS.
To run the app locally, you need a local HTTP server to allow Service Worker registration:
```bash
npx serve . -p 5500
```
Open `http://localhost:5500` in your browser.

### 2. Cloud Backend Setup (Google Sheets)
The application syncs data to Google Sheets via Google Apps Script.

> [!IMPORTANT]  
> **Pre-configured API (No setup required):** The app is already configured out-of-the-box to use the following API link:  
> `https://script.google.com/macros/s/AKfycbx7AKzzNtT19bm0-Q2beYb9RPAf3IldoLxy3np9XDun4TijAT9hJMk5515XC1f_iNG6/exec`  
> You must use this endpoint for the app to run and sync correctly if you don't deploy your own.

If you wish to deploy your own database, follow these steps:
1. Create a new Google Spreadsheet.
2. Open `Extensions -> Apps Script`.
3. Copy the contents of `apps-script/Code.gs` and paste it into the editor.
4. Replace `const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';` with your actual Spreadsheet ID.
5. Click **Deploy -> New Deployment**.
   * Type: **Web app**
   * Execute as: **Me**
   * Who has access: **Anyone**
6. Copy the **Web App URL**.
7. In the PWA frontend, click the **Settings** icon and paste the Web App URL into the Endpoint Configuration field.

### 3. Production Deployment (Cloudflare Pages)
To deploy the application live so it can be installed on mobile devices:
```bash
npx wrangler login
npx wrangler pages deploy .
```
Follow the CLI prompts to create a new project. Access the provided `.pages.dev` link on your mobile device.

##  Grading Requirements Checklist
- [x] PWA Installable (manifest.json & icons)
- [x] Offline-ready (Service Worker & Cache-First App Shell)
- [x] Local Storage (IndexedDB)
- [x] Clean architecture & Modular JS
- [x] Comprehensive Setup Instructions
