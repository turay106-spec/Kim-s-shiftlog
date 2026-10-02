# ShiftLog v2.0.2

ShiftLog is a mobile-first, local-first Progressive Web App (PWA) for recording work shifts, clocking in/out, calculating hours, estimating earnings and exporting timesheet reports.

## What is included

- Persistent one-tap Clock In / Clock Out
- Live elapsed timer and live estimated earnings
- Multiple jobs with separate hourly rates
- Manual shift entry and editing
- Unpaid break deductions
- Overnight shift handling
- Dashboard filters for week, month, year and all time
- Dashboard filters by job
- Searchable shift history
- Duplicate, edit and delete actions
- Estimated earnings
- CSV export
- Word (.doc) export
- Print-ready PDF report
- Week / month / year / all-time report filtering
- Job-specific report filtering
- JSON backup and restore
- Offline-first service worker
- Installable PWA
- Online / offline indicator
- Existing `shiftlog_shifts_v1` data migration
- Existing `shiftlog_active_shift_v1` active-clock migration
- Responsive mobile navigation

## Data safety

ShiftLog v2.0.2 intentionally keeps the original storage keys:

- `shiftlog_shifts_v1`
- `shiftlog_active_shift_v1`

This allows existing completed shifts and an in-progress legacy clock-in to migrate into the new app.

Additional v2 data uses:

- `shiftlog_active_session_v2`
- `shiftlog_settings_v2`
- `shiftlog_jobs_v2`

### Important

Browser storage is local to the browser/app container. Safari and an iPhone Home Screen web app can keep separate local data even when they use the same URL.

Use **Reports → Download backup** regularly if the data matters.

## PDF export

The PDF option opens a preview inside ShiftLog. **Share / Save PDF** now creates a real PDF file directly in the browser.

On iPhone/iPad, ShiftLog opens the native Share sheet so you can choose **Save to Files**, AirDrop, Mail, Messages, and other destinations. On browsers without file sharing support, ShiftLog downloads the PDF normally. The PDF generator is built into the app, so it still works offline.

## GitHub Pages

The app is designed to work from a GitHub Pages project path such as:

`https://turay106-spec.github.io/Kim-s-shiftlog/`

The manifest and service worker use relative URLs so the project can remain under that repository path.

## Development workflow

```text
Edit in VS Code
→ Save
→ git status
→ git add .
→ git commit -m "Describe the change"
→ git push
→ GitHub Pages updates
→ Refresh the phone
```

## Run locally

For normal browser development, use VS Code Live Server or any small local HTTP server.

Service workers require HTTP/HTTPS and do not fully work when opening `index.html` directly as a `file://` URL.

## Architecture

The app remains deliberately framework-free:

- HTML: structure
- CSS: responsive interface
- JavaScript: state, calculations, reports and UI behaviour
- localStorage: local persistence
- Service Worker + Web App Manifest: PWA/offline layer

This keeps ShiftLog easy to inspect while still using production-style browser capabilities.

## Future cloud sync

The current release is local-first and fully usable without a backend.

A future cloud version can add Supabase or another backend for:

- account login
- multi-device sync
- remote backups
- server-side security rules

That should be added as a separate migration so local data remains recoverable.
