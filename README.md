# Name Swipe

A small progressive web app for picking a name together. Two profiles, one deck,
swipe right on what you like, and the app shows you where you agree.

## Running it

Service workers and installation need a real origin, so open it over http, not
as a `file://` path.

```bash
cd Core
python3 -m http.server 8080
```

Then open `http://localhost:8080` on the laptop, or
`http://<laptop-ip>:8080` on a phone on the same wifi.

For a shared, installable version, push the contents of `Core/` to a GitHub
repo and turn on GitHub Pages. Once it is on https, Chrome offers "Install app"
and iOS Safari offers "Add to Home Screen".

## What is in here

| File | What it does |
| --- | --- |
| `index.html` | Markup for all four views |
| `styles.css` | Everything visual, including the blue and pink themes |
| `app.js` | State, swipe gestures, matching, CSV export |
| `data/names.js` | The name list, generated from the source sheet |
| `sync.js` | Supabase sync: queue, push, pull, live updates |
| `config.js` | Your Supabase URL and anon key |
| `supabase-setup.sql` | Run once in Supabase to create the tables |
| `SETUP-SYNC.md` | Step by step guide to turning sync on |
| `vendor/supabase.js` | The Supabase client, kept local so the app works offline |
| `manifest.webmanifest` | PWA metadata |
| `sw.js` | Service worker, offline cache |
| `icons/` | App icons, including a maskable one |
| `Chosen list 1.xlsx` | The original sheet the list was built from |

## How the data is organised

Every name carries a `tag`:

- `shortlist` — came off your sheet, shown with a gold "Already on our list" badge
- `new` — added in this build
- `blend` — made from Sachin, Nishil, Menaka, Sukumar, Thulasi, Ranjit and Amudha
- `custom` — added from inside the app

Boys render blue, girls render pink, everywhere in the app.

## Storage and sync

Local storage is the source of truth for the screen, so the app never waits on
the network. Everything sits under the key `nameswipe.v1`: profile names, the
active profile, both sets of swipes, deck options and any names added.

With `config.js` filled in, every change is also queued and pushed to Supabase,
and the app subscribes to live updates from the other phone. If a push fails it
stays in the queue under `nameswipe.queue.v1` and retries when the connection
returns. Pulls are skipped while the queue is non-empty, so a local change is
never overwritten before it has been sent.

Leave `config.js` blank and the app runs exactly as before, on one device only.

See `SETUP-SYNC.md` to turn sync on.

## Keyboard

Right arrow likes, left arrow passes, down arrow undoes the last swipe.

## Bumping a version

Change `CACHE` in `sw.js` and the version string at the bottom of
`index.html` whenever you ship, or browsers will keep serving the cached build.
