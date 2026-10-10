# QR Attendance

A small web app for taking attendance: the organizer creates a session and shows a QR code; attendees scan it with their phone camera, type their name, and they're checked in. The organizer sees the list update live and can download it as a CSV.

## Features

- **No accounts.** Creating a session gives you a private admin link. The browser that created it remembers it.
- **QR code check-in.** Attendees scan, enter their name, and tap "Check in". No app or login is needed.
- **Live attendee list.** It refreshes every 3 seconds and shows a running count.
- **Present mode.** Shows the QR code fullscreen for a projector.
- **Duplicate protection.** A name can't be entered twice per session (ignoring case), and a phone that already checked in sees its confirmation again.
- **Close or reopen check-in.** Use this when the session ends or to stop late entries.
- **Remove entries.** Delete typos or prank entries.
- **CSV export.** Opens in Excel or Google Sheets, with protection against formula injection.

## Running it

Requires Node.js 18 or newer.

```bash
npm install
npm start          # http://localhost:3000
npm test           # API tests
```

Open `http://localhost:3000`, enter a session name (e.g. "Biology 101 — Oct 10"), and you'll land on the admin page with the QR code.

### Letting phones reach it

The QR code encodes the address the admin page was opened with. A phone can't reach `localhost`, so you need one of these:

- **Same Wi-Fi:** open the admin page via your computer's LAN IP, e.g. `http://192.168.1.20:3000`.
- **Set the public URL explicitly:** `PUBLIC_URL=https://attendance.example.com npm start`.
- **Deploy it** to any Node host (Render, Railway, Fly.io, a VPS, …). Attach a persistent disk or volume for the data directory.

### Configuration

| Variable     | Default     | Purpose                                       |
|--------------|-------------|-----------------------------------------------|
| `PORT`       | `3000`      | HTTP port                                     |
| `PUBLIC_URL` | request host| Base URL encoded in the QR codes              |
| `DATA_DIR`   | `./data`    | Where session JSON files are stored           |

## How it works

- `server.js` is the Express API plus page routes (`/s/:id` for check-in, `/admin/:id` for the organizer).
- `store.js` saves each session as a JSON file in `DATA_DIR`, written atomically.
- `public/` holds the plain HTML/CSS/JS frontend. It has no build step.

The admin key travels in the URL fragment (`#key=…`), so it never shows up in server logs. The page removes it from the address bar once loaded. Use **Copy admin link** to open the admin view on another device or to share it with a co-organizer.

Anyone with the check-in link can type any name, so this tracks attendance on trust. That suits classes, meetings, and events, but not anything high-stakes. Closing check-in when the session ends stops people from sending the link to friends who aren't there.
