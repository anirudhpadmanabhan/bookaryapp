# Bookary overhaul — batch plan

I'll ship this in 5 batches. Approve and I'll start at batch 1.

## Batch 1 — Home + Book cards

- New "Newly arrived" row at the very top of `/`, above "All books".
  - Pinned 5 books by shelf code: `4556, 4586, 4616, 4615, 4499` (decoded from your fonted text). I'll fetch them by `shelf_code` and render in that order. If any code is missing in DB I'll log it and skip.
- Remove rental amount from home book tiles → replace with a "Rent now" button on each card.
- BookCover: bake the title onto every thumbnail and never pick a cover color equal to the page background (filter the bg token out of the palette).

## Batch 2 — Search, genres, writers

- Header search input becomes live: typing routes to `/search?q=...`; pressing Enter focuses full search page. Results scroll the full page.
- Move the Sort control on `/genres` and `/writers` to the right of the search box.
- "CSVG writer" tile pinned to the bottom of writers list.
- `/writers/$slug` and `/genres/$slug`: list every book by that writer/genre, show writer/genre profile card (name en+ml, book count, bio if available — bio empty for now, placeholder block). Writers page list itself shows en + ml names like genres does.
- Tabs on `/writers` and `/genres` no longer auto-open search.

## Batch 3 — Book detail page

- Remove rental amount line; add "Rent now" primary button.
- Remove `pages` field everywhere it shows (CSV doesn't have reliable page counts).
- Reviews + rating section:
  - Rating input renders as 5 empty outlines until the user hovers/clicks (no pre-filled stars).
  - Submitting a review or rating writes a `reading_diary` entry automatically tagged `review`.
- Loving a book (heart) creates a `favorites` row → reflected on `/loved`.

## Batch 4 — Auth redirect, diary, loved

- `/auth` accepts `?redirect=/some/path` and `_authenticated` layout passes the original URL through; after sign-in the user lands back on the page they came from.
- `/diary`:
  - Allow manual entries without a rental (book picker + free-text + optional rating).
  - Auto-include entries created from reviews/ratings.
  - Edit/Delete already exists from previous batch — keep.
- `/loved`: dedupe + heart toggle wired to favorites.

## Batch 5 — Profile + notifications

- Rebuild `/profile`:
  - Avatar, display name, email, member since.
  - Ledger: rentals with due date, status, total paid.
  - Books panel: currently rented, history, loved count, diary count.
  - Insights: total books read, favorite genre, favorite author, reading streak (consecutive days with a diary entry).
- Top-right bell icon in header:
  - Shows count of rentals whose `due_at` is within 20 days.
  - Dropdown lists each book + days remaining.

## Technical notes

- Newly arrived: `select * from books where shelf_code in (…) order by array_position(array[…], shelf_code)`.
- Color picker: extend `colorAt` to accept a `forbidden` token (page bg) and skip it.
- Streak: SQL `with days as (select distinct date(created_at) d from reading_diary where user_id = auth.uid()) …` computed in a server fn.
- Notifications: client-side query on `rentals` filtering `due_at between now() and now()+20d`.
- Auth redirect: `_authenticated/route.tsx` throws `redirect({ to: '/auth', search: { redirect: location.href } })`; `auth.tsx` reads `search.redirect` and navigates there on success.
- No new tables required. Profile bio for writers can come later — for now show name + counts.

## What I need from you

Nothing — the 5 shelf codes are enough. I'll start at batch 1 on approval.
