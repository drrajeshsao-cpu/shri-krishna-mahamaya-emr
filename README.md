# SKMCIS App Version 1 — PWA Starter

## What is ready
- Mobile-friendly Progressive Web App
- Offline cache through service worker
- Search and status filter
- 22 disease-ID slots
- Clinical safety disclaimer
- JSON-based content import structure
- Installable from a supported mobile browser after HTTPS hosting

## Important content status
Only disease names visible in the available project context were inserted. Ten IDs (DIS-0006 to DIS-0015) remain marked for title/content verification. Full A–T module text for all 22 diseases must be imported from the master manuscript before production release.

## Test locally
Run a local web server inside this folder, for example:

    npx serve .

Open the shown URL in a browser.

## Upload
Upload the complete folder to any HTTPS static host such as Firebase Hosting, Netlify, Vercel, GitHub Pages, or your own server.

## Android Play Store
This PWA can later be wrapped as an Android Trusted Web Activity or Capacitor app. A signed AAB needs:
- Final app/package name
- 512×512 icon and feature graphic
- Privacy policy URL
- Play Console developer account
- Signing key
