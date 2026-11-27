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
| `MIGRATE-v1.2.sql` | Run once in Supabase when moving to v1.2 |
| `MIGRATE-v1.3.sql` | Run once in Supabase when moving to v1.3 |

v1.4 and v1.5 need no migration.
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

As of v1.5 the deck holds 505 names: 251 boys and 254 girls. Beyond Sanskrit and
Tamil it draws on Malayalam, Kannada, Telugu, Bengali, Odia, Marathi, Gujarati,
Punjabi, Kashmiri, Assamese, Naga, Ladakhi and Himachali, plus Persian and
Arabic as they are used in India. 55 of them are place names, rivers, valleys,
hill towns and forts, and 15 come from ragas.

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

Right arrow likes, left arrow passes, up arrow super likes, down arrow undoes.

## Navigation

Two tabs, Swipe and Matches. The avatar in the top left opens Settings and
tapping it again comes back. The gender filter hides while Settings is open.

Every view change and overlay pushes a history entry, so the phone's back
gesture steps back through what you did rather than closing the app. At the
root it re-anchors instead of exiting.

## Theme

Auto, Light or Dark, set in Settings. Auto follows the phone. Dark is the same
warm palette at low light, not a cold grey. The colours all come from CSS
variables on `:root` and `html[data-theme="dark"]`.

## The swipe screen shows nothing about the other person

By design. The card carries the name, origin and meaning and that is all. You
find out where you agree in Matches, not while you are deciding. The old
"hide names the other one passed" option was removed for the same reason.

## Filtering matches

Gender comes from the Boys / Girls / Both control in the top bar, which now
filters the deck and the matches list. The chips under the Matches heading are
about the choices instead: both starred, each person's own stars, liked but not
starred, and names that have comments. The chip labels carry the live profile
names.

## Why swiping is fast

Three things, all local first.

A leaving card is reparented into `#deckFx` and animates there, and the deck
redraws in the same frame. The next card is interactive immediately, so a run
of quick swipes never queues behind an animation.

`saveSoon()` keeps state in memory and writes to `localStorage` 400ms later, so
a burst of swipes serialises once rather than once per card. A forced `save()`
runs on `pagehide` and when the tab is hidden.

Matches redraw only when you are looking at them. Every vote updates the cheap
badge count and sets a dirty flag; the full list is built when you open the tab.
The ordered name list is cached and rebuilt only when the seed, the shuffle
setting or the custom names change.

On the network side, `sync.js` queues each change and pushes on a 500ms debounce,
so twenty fast swipes go up as one batch.

## Verdict slots

Every row in Matches and in the list shows two slots, the first for profile 1
and the second for profile 2, each captioned with that person's initial. The
icon is a tick on sage for a like, a cross on terracotta for a pass, a star on
gold for a super like, and a dashed outline when they have not seen it. All
four are the same size.

## Comments and changing your vote

Tapping any row opens the name. From there you can change your own vote between
Pass, Like and Star, or tap the current one again to clear it, and you can leave
comments. Comments are shared through the `comments` table and show who wrote
them. A row with comments carries a small count.

## Super likes

A vote is `like`, `pass` or `super`. A super counts as a like for matching, and
marks the name as starred. Either person starring is enough. Starred names sort
to the top of Matches and have their own filter. Tapping the star in Matches
flips your own vote between `like` and `super`.

## Shared shuffle

Shuffle is not a local setting. The order comes from a seed held in the
`settings` table, so both phones deal the same deck and you meet the same names
at roughly the same time. "Shuffle into a new order" picks a new seed and pushes
it to both. Names are ordered by a hash of their id and the seed, so adding a
name slots it in without disturbing the rest of the order.

## Update banner

`sw.js` deliberately does not call `skipWaiting()` on install. A new version
installs and waits. The app notices, drops a bar down from the top, and the tap
is what promotes it. So shipping a change is: edit the files, bump `CACHE` in
`sw.js` and the version in `index.html`, push. Both phones see the bar on their
next open.

## Bumping a version

Change `CACHE` in `sw.js` and the version string at the bottom of `index.html`
whenever you ship. Skipping this means browsers keep serving the cached build
and the update bar never appears.
