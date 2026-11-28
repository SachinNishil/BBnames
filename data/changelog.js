/* Version history, newest first. Add an entry here whenever you ship.
   The app reads version[0] as the current version, so bump this and the
   CACHE string in sw.js together. */
window.CHANGELOG = [
{
  "version": "1.9.0",
  "date": "2026-11-28",
  "title": "Repeat bug fixed, every filter, 100 more names",
  "changes": [
    "Fixed names coming back round again. A swipe made while an earlier upload was still in flight was being dropped from the outgoing queue, and the next sync then handed that name back to the deck. Reproduced it: thirty swipes, only ten saved, four names cycling round. Anything queued mid-upload now survives.",
    "Added a second layer underneath that. Every vote is held as unconfirmed until it comes back from the database. If a sync arrives without it, the app keeps its own answer and pushes it again rather than putting the name back in the deck. Tested with one write in three silently lost: nothing repeats and nothing is dropped.",
    "Thirteen filters in Matches instead of seven, covering every combination the two of you can produce: both starred, each person's stars, each person's yes, liked by both without stars, one yes and one no, passed by both, waiting on each of you, neither has seen, and has comments.",
    "A filter on one person now shows everything they marked, not just the ones that became matches. Results are grouped by what the other person said: starred at the top, then liked, then passed, then not yet seen.",
    "100 more names, 50 per gender, under a new Middle ground tag. Contemporary and international with Indian roots, leaning on Buddhist virtues, Indonesian, Thai, Khmer, Burmese, Sinhala and Tibetan, and chosen to sit on neither side of a faith."
  ]
},
{
  "version": "1.8.0",
  "date": "2026-11-27",
  "title": "Version history",
  "changes": [
    "This screen. Every version and what changed in it, back to the first build.",
    "All database files moved into a supabase folder, with an APPLIED.md recording which migrations have actually been run.",
    "The upload batch now separates files to push to GitHub from files to push to Supabase, so the two are never confused."
  ]
},
{
  "version": "1.7.0",
  "date": "2026-11-27",
  "title": "Malayalam names, search, every star case",
  "changes": [
    "100 Malayalam rooted names, 50 per gender. Everyday Kerala names, Mappila names and Christian Kerala names. 805 names in total now.",
    "Search box in Matches. Searches name, origin and meaning, inside whichever filter is on.",
    "New grouped star view. Every name either of you starred, split four ways: starred by both, starred by one and liked by the other, starred by one and passed by the other, and starred but not yet seen.",
    "That third group was previously invisible. A star against a pass is not a match, so it was sitting unnoticed."
  ]
},
{
  "version": "1.6.0",
  "date": "2026-11-27",
  "title": "200 names from outside India",
  "changes": [
    "100 per gender with roots elsewhere but easy on an Indian tongue. Italian, Greek, Latin, Persian, Turkish, Armenian, Slavic, Nordic, Finnish, Irish, Welsh, Hebrew, Arabic, Swahili, Yoruba, Japanese, Vietnamese.",
    "Clipped place names in the same vein: Milan, Cairo, Siena, Capri, Neva, Vienne, Caspian, Lisan.",
    "New World roots filter and badge."
  ]
},
{
  "version": "1.5.0",
  "date": "2026-11-27",
  "title": "300 more Indian names",
  "changes": [
    "150 per gender, drawing on Malayalam, Kannada, Telugu, Bengali, Odia, Marathi, Gujarati, Punjabi, Kashmiri, Assamese, Naga, Ladakhi and Himachali as well as Sanskrit and Tamil.",
    "55 place names: rivers, valleys, hill towns and forts. Jhelum, Teesta, Narmada, Spiti, Hampi, Konark, Rann.",
    "15 names taken from ragas. Bhairav, Malhar, Kalyani, Bageshri."
  ]
},
{
  "version": "1.4.0",
  "date": "2026-11-27",
  "title": "Blind swiping, and speed",
  "changes": [
    "The swipe card no longer shows what the other person did. You find that out in Matches, not while deciding.",
    "Removed the hide what they passed option for the same reason.",
    "Match filters are about choices now, not gender. Gender moved to the top bar control, which filters the deck and the matches list.",
    "Swiping is much faster. The leaving card animates on its own layer so the next card is live immediately, storage writes are batched, matches redraw only when visible, the deck order is cached, and changes go up to the database in one batch rather than one request per swipe."
  ]
},
{
  "version": "1.3.0",
  "date": "2026-11-27",
  "title": "Dark mode, comments, changing your mind",
  "changes": [
    "Dark mode. Auto, light or dark, in Settings. Auto follows the phone.",
    "The profile circle opens Settings and tapping it again goes back. Settings dropped out of the bottom bar, leaving two tabs.",
    "The back gesture steps through what you did instead of closing the app.",
    "Two verdict slots per row, one per person, captioned with the initial. Tick for a like, cross for a pass, star for a super like, dashed for not seen. All the same size.",
    "Tap any name to change your own vote, or clear it entirely.",
    "Comments on any name, shared between both phones.",
    "Double starred filter."
  ]
},
{
  "version": "1.2.0",
  "date": "2026-11-27",
  "title": "Warm redesign, super likes, shared shuffle",
  "changes": [
    "New look. Cream paper, dusty blue and dusty rose, ochre and sage and terracotta, soft brown instead of black. Serif for the names.",
    "The top bar is just the profile circle now. No labels.",
    "Super likes. A star counts as a like and marks the name as a shortlist pick.",
    "Shuffle is shared. The order comes from one seed in the database so both phones deal the same deck.",
    "Three tabs, with the full name list moved into Settings.",
    "Update banner. When a new version is live, a bar drops from the top and one tap reloads onto it."
  ]
},
{
  "version": "1.1.0",
  "date": "2026-11-27",
  "title": "Two phones, one list",
  "changes": [
    "Supabase sync. Swipes, profile names and added names stay in step across both phones, live.",
    "Local first. Everything saves on the phone immediately and queues if the connection drops, so swiping offline works and catches up later.",
    "Sync status in Settings."
  ]
},
{
  "version": "1.0.0",
  "date": "2026-11-27",
  "title": "First build",
  "changes": [
    "205 names: 78 off your sheet with a gold badge, 105 new ones, and 22 blends of Sachin, Nishil, Menaka, Sukumar, Thulasi, Ranjit and Amudha.",
    "Swipe deck with drag, buttons, arrow keys and undo.",
    "Two profiles, switched by radio button in Settings, both renameable.",
    "Matches view, full searchable list, and a form to add your own names.",
    "Installable from the browser, works offline.",
    "Boys in blue, girls in pink."
  ]
}
];
