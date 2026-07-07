
## Scope
Deliver every item you selected. Grouped for review; I'll ship them in one working pass.

## 1. Library Profile as admin tab + sidebar eye-toggles
- Add a **"Library"** tab inside `src/routes/admin.tsx` (visible to admins + librarians). Content: name/location editor, activity feed (reuses `library_posts` + `NewPostForm` from `libraries.$slug.tsx`), likes/comments preview. Admin sees a library picker; librarian is auto-scoped to their library.
- Keep the public `/libraries/$slug` route unchanged so members can still browse it.
- Extend `src/lib/ui-prefs.ts` with toggles for each sidebar area: Browse, Shelves, Genres/Writers/Languages, and view-mode (tile/list). Add an eye icon next to every collapsible header in `AppLayout.tsx` that persists via localStorage.

## 2. Per-user rentals + insights + report export
- New "Members" drill-down inside the admin **Users** tab: click a member → drawer showing rentals list, most-read genre, review count, books read (uses existing `user_rental_history` + `reading_insights` RPCs).
- Reports tab: add **Top Readers** export (CSV + PDF) already wired via `library_top_readers`; add a second **Per-User Rental History** export that takes the selected user.
- Fix the "top readers not reflected" gap now that `has_role_in_library` EXECUTE is restored — verify the query invalidates on library switch.

## 3. Fix Log-a-Rental + DD/MM/YYYY everywhere
- **Log a Rental** dialog: switch from free-text email to strict picker using `staff_search_members`. Disable the Log button until an existing member row is selected. Remove any fallback path that inserts a new profile/user.
- Add a **date formatting util** `formatDMY(date)` in `src/lib/utils.ts`. Replace every `toLocaleDateString()` / `new Date(...).toDateString()` call across admin, profile, rentals, posts, notifications, and reports with `formatDMY`.
- Rental "Returned date" input becomes a `<Input type="date">` displayed as DD/MM/YYYY via the util; staff can edit and clear.

## 4. Rack 4012 cover + verify data flow
- The Aadujeevitham (#4012) `cover_url` is a Drive `/file/d/…/view` link; the normalizer in `BookCover.tsx` already rewrites it to `drive.google.com/thumbnail?id=…&sz=w800`. I'll add a fallback: if the thumbnail 403s, retry with `lh3.googleusercontent.com/d/<id>=w800`.
- Verify against `/books/8323af89-…` after deploy; if Drive still blocks, mark the book with a static uploaded cover under `library-posts` bucket.
- Confirm Top-Readers card populates now that the SQL EXECUTE grant is back.

## Technical notes
- No new tables. Reuses `library_posts`, `library_post_likes`, `library_post_comments`, `user_rental_history`, `library_top_readers`, `staff_search_members`.
- Client-only changes for date formatting and sidebar toggles; no schema migration required for those.
- One tiny migration only if needed: ensure `staff_search_members` returns only rows with existing `profiles.id` (already the case via `LEFT JOIN` — no change).

Approve to proceed and I'll implement in a single build pass.
