# ShiftLog — Second Job Tracker

A simple mobile-first web app for logging second-job shifts and automatically calculating hours.

## MVP features
- Add date, time-in and time-out
- Handles overnight shifts automatically (e.g. 5pm–2am = 9h)
- Calculates monthly total, weekly total, shift count and average shift
- Edit and delete shifts
- Saves data in browser localStorage
- Export all shifts as CSV
- Works as a responsive web page and can be installed as a PWA on supported browsers

## Run locally
Open `index.html` in a browser. For full PWA behaviour, serve the folder through a local web server, for example with VS Code Live Server.

## Next version
- One-tap Clock In / Clock Out
- Monthly calendar
- Pay-rate and estimated earnings
- Break deductions
- Search/filter by month
- Cloud database + login so records are not tied to one device
- Backup/restore JSON
