# Upload batch 2026-11-28

## To push to GitHub

Copy these into the repo, keeping the same paths:

- `README.md`
- `SETUP-SYNC.md`
- `app.js`
- `data/changelog.js`
- `data/names.js`
- `index.html`
- `styles.css`
- `supabase/APPLIED.md`
- `sw.js`
- `sync.js`

## To push to GitHub, nothing to run

Already applied to the live database, or not meant to be run.
These go in the repo as a record only:

- `supabase/fix-permissions.sql`
- `supabase/migrate-v1.2.sql`
- `supabase/migrate-v1.3.sql`
- `supabase/schema.sql`

## Delete from the repo

Gone from Core/, usually because they moved:

- `FIX-PERMISSIONS.sql`
- `MIGRATE-v1.2.sql`

Once pushed, run `python3 sync-updates.py --uploaded` so the next
batch starts clean.
