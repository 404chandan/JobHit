# JobHit: AI-Powered Job Search & Outreach Suite

**JobHit** is a production-grade full-stack job application suite designed for software engineers. It consists of two main parts:
1. **Web Portal (`web-portal/`)**: A cloud-hosted marketing website, auth system, mock UPI QR payment gateway, and secure desktop zip distributor.
2. **Desktop App (`desktop-app/`)**: The isolated local application containing the job dashboard, scraper, auto-applier, settings, and bulk campaign modules running 100% locally on your machine with complete data privacy.

---

## Directory Architecture

```
JobHit/
├── desktop-app/              # 100% Private local application
│   ├── backend/              # Local Express server (auth-free, serving /jobhit)
│   ├── frontend/             # Local Vite React app (direct dashboard, base: /jobhit/)
│   └── HOW_TO_USE.md         # Instructions for local setup and DB connection
│
├── web-portal/               # Cloud-hosted marketing and download portal
│   ├── backend/              # Express auth, payment status, and ZIP downloader
│   └── frontend/             # Vite React landing page, mock payment modal
│
├── package-desktop.js        # Root packaging script (builds + zips desktop build)
└── README.md
```

---

## Technical Specifications

### 1. Web Portal (`web-portal/`)
- **Marketing Page**: Interactive showcase displaying product features and dashboard capacities.
- **₹1 Mock UPI payment**: Premium interactive modal simulating UPI payment checkouts (Google Pay, PhonePe, Paytm, BHIM) using a QR Code.
- **Secure Download**: Limits zip downloads to users who have completed the payment flow.
- **Deployment**: Ready for single-click deployment to **Render** using the root-level `render.yaml`.

### 2. Desktop Application (`desktop-app/`)
- **Login-Free Dashboard**: Bypasses authentication requirements locally, mapping all queries to `req.userId = 'local_user'`.
- **`/jobhit` Subpath Routing**: Accessible via `http://localhost:5000/jobhit` (assets compile relative to `/jobhit/` and APIs run under `/jobhit/api`).
- **Data Privacy**: Stored locally on your own MongoDB database (e.g. running locally or on a personal Atlas cluster). No credentials leave your computer.
- **Playwright Scraper**: Automates scrolls/checks. Conservative 8-hour scheduling intervals and 5-12s randomized human delays protect your LinkedIn ID from restrictions.
- **AI Matching Engine**: Uses Gemini 1.5 Flash to automatically score roles, filter mismatches, and draft personalized outreach.
- **Self-Learning Auto-Applier**: Screenshots unknown Easy Apply questions and prompts you to answer them. Once resolved, it remembers them for future runs.

---

## Zipping & Packaging the Desktop App

To compile the desktop frontend and generate the clean `desktop-app.zip` ready for download via the web portal, run the root packaging utility:

```bash
node package-desktop.js
```

This script:
1. Compiles the React assets in `desktop-app/frontend/`.
2. Places the bundle inside the Express static directory `desktop-app/backend/public`.
3. Runs Prisma client generations.
4. Packages the desktop files (excluding `node_modules`, `.env`, and git caches) into a compressed ZIP file at **`web-portal/backend/downloads/desktop-app.zip`** ready to be downloaded.

---

## Deployment (Render Web Portal)

The Web Portal is configured for single-click deployment to Render using the root `render.yaml`. Ensure you configure:
- `DATABASE_URL`: MongoDB Atlas connection URI for portal credentials.
- `JWT_SECRET`: Your portal JSON Web Token signature key.
