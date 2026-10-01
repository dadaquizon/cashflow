# ASAPLAB PH CashFlow

Offline-first cash-in/cash-out + finance tracker built with Next.js 15, React 19 and Tailwind CSS.

## Features

- Local login/logout (device-only)
- Opening ASAPLAB PH splash screen
- Professional blue/dark-blue gradient UI using Poppins
- Transaction dashboard with total revenue, cash and non-cash balances
- Cash In / Cash Out transaction forms
- Automatic fee calculation from customizable rate ranges
- Manual fee override per transaction
- Reference number field
- Camera capture and gallery upload for receipts on supported mobile browsers
- Receipt images stored locally in IndexedDB
- Transaction history with All / Today / This Month / Custom date filters
- Rate create/edit/delete screens
- Finance screen for Capital, Withdrawal and Transfer
- Separate Cash, GCash and Bank balances
- Success/error pop-up notifications with sound
- Cancel confirmation dialogs
- Offline service worker / installable PWA shell
- GitHub Pages workflow

## Accounting behavior used by the app

The app treats `Total Revenue` as the sum of transaction fees.

Cash In:
- Cash increases by amount + fee
- Selected digital account (GCash or Bank) decreases by amount

Cash Out:
- Cash decreases by amount
- Selected digital account (GCash or Bank) increases by amount + fee

Finance entries:
- Capital adds to the selected account
- Withdrawal subtracts from the selected account
- Transfer moves money between Cash, GCash and Bank without changing the overall total

## Fee logic

1. If the amount is inside a saved range, that range's fee is used.
2. If the amount is above the highest range, the app continues the latest fee pattern.
3. If there is only one range, the fee repeats by blocks of that range's maximum.
4. The transaction form always allows a manual fee override and has an AUTO button to restore the calculated fee.

Default example:
- 10-500 = 10
- 501-1000 = 20
- 1001-1500 will continue to 30

## Run locally

Install Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Publish to GitHub Pages

1. Create a new GitHub repository, for example `asaplab-cashflow`.
2. Upload/push all files from this project to the repository's `main` branch.
3. In GitHub, open **Settings > Pages**.
4. Under **Build and deployment > Source**, choose **GitHub Actions**.
5. Push a commit to `main` or open **Actions > Deploy Next.js app to GitHub Pages > Run workflow**.
6. After the workflow finishes, GitHub shows the public HTTPS URL.
7. Open that URL on the phone once while online. The service worker will cache the app shell so it can reopen offline later.

## Phone camera and gallery

The transaction form uses two separate file inputs:

- **Camera** uses `accept="image/*" capture="environment"` to request the rear camera when the browser/device supports it.
- **Gallery** uses `accept="image/*"` without `capture` so the user can choose an existing image.

GitHub Pages uses HTTPS, which is appropriate for mobile browser media/file features. Exact camera UI is controlled by iOS/Android and the browser, so some phones may show a chooser instead of opening the camera directly.

## Important offline-data note

This version is intentionally local/offline. Login, transactions, rates and finance data stay in the browser on that device. Receipt images stay in IndexedDB on that device.

Clearing site data, uninstalling the browser/PWA, or changing to another phone can remove or separate the records. For real business use, add an Export/Backup feature or a synced database before depending on it as the only financial record.

## October 2026 UI/Workflow Update

This build adds:
- Softer heading typography paired with Poppins supporting text
- Responsive phone, iPhone, iPad, and tablet layouts
- Total Cash In Processed and Total Cash Out Processed cards
- Transaction history filtering by date AND by Cash In / Cash Out
- BANK removed from the active app workflow; balances now focus on CASH and GCASH
- Separate Capital History and Withdrawal History sections
- Center-screen success/error notifications with green check and sound
- Direct phone camera capture using `navigator.mediaDevices.getUserMedia()` with rear-camera preference
- Gallery upload remains available for existing receipt images

### Camera requirement
Direct camera capture requires a secure context (`https://`) on phones. GitHub Pages provides HTTPS. The user must allow camera permission when prompted by the browser.

## Localhost blank/plain-text fix

This build prevents the PWA service worker from caching Next.js development chunks on localhost. During `npm run dev`, any older ASAPLAB service-worker registrations and caches are cleared automatically. In production, the service worker does not cache `/_next/` JavaScript/CSS chunks, avoiding stale-chunk 404 errors after updates.

If you tested an older build in Chrome and still see plain text once, open DevTools > Application > Service Workers > Unregister, then Application > Storage > Clear site data, close the tab, restart `npm run dev`, and reopen `http://localhost:3000`.
