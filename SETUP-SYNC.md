# Turning on sync

Ten minutes, once. After this, both phones stay in step.

## 1. Make a Supabase project

Go to supabase.com and sign up. It is free.

Click "New project". Give it a name. Pick a region near India, like Mumbai or
Singapore. Set a database password and save it somewhere.

Wait about two minutes while it builds.

## 2. Create the tables

In the left sidebar, click "SQL Editor".

Click "New query".

Open `supabase/schema.sql` from this folder. Copy everything in it. Paste it in.

Click "Run".

You should see "Success". That is the database done.

## 3. Copy your two keys

In the left sidebar, click "Project Settings", then "API Keys".

Supabase has two versions of this screen. Check which one you are on.

**New style.** It says "Publishable key" and "Secret keys".
Take the publishable key. It starts with `sb_publishable_`.

**Older style.** It says "Project API keys" with anon and service_role.
Take the anon public key. It is a long string starting with `eyJ`.

Either works. They go in the same place.

The rule is the same on both screens. Take the one marked public or
publishable. Never the one marked secret or service_role. That key can read and
write everything, and it would be sitting in your public repo.

You also need the Project URL. Same page, or under Project Settings, General.
It looks like `https://abcdxyz.supabase.co`.

## 4. Paste them into the app

Open `config.js` in this folder. Put the two values in the quotes.

```js
window.SUPABASE_CONFIG = {
  url: 'https://abcdxyz.supabase.co',
  anonKey: 'sb_publishable_...'   // or the eyJ... anon key on older projects
};
```

Save the file.

## 5. Push to GitHub

Upload the contents of `Core/` to your repo. Turn on GitHub Pages.

Open the Pages URL on both phones. Add to Home Screen on each.

## 6. Check it worked

Open Settings in the app. Look at the Sync line.

A green dot and "Synced" means you are done.

Now swipe something on your phone. Open Matches on her phone. It should show up
within a second or two.

## What syncs

Both sets of swipes. Both profile names. Any name either of you adds.

## If you lose signal

Keep swiping. Everything is saved on the phone. The Sync line turns amber and
says it will catch up. It pushes the moment you are back online.

## A note on the key

The publishable key, and the old anon key, are both built to sit in public app
code. So having it in GitHub is fine.
What it does mean is that anyone who finds your Pages URL could in theory write
to the database. For a baby name app that is a fair trade for not having logins.
If you want it locked down later, tell me and I will add a passcode screen.
