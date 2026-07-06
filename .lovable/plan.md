Big batch of fixes grouped by area. I'll ship them all in one build pass.

## 1. Rental status flow (admin/librarian)

- On a `delivered` rental, add a "Mark as rented / out" option → sets `tracking_status = 'rented'` and keeps the book flagged out.
- Status pills in the rentals action column:
  - Green pill "Returned" (current) when returned.
  - Red pill "Waiting for return" while active (delivered/rented/confirmed) with a **Mark returned** action inline.
  - Show clear In / Out indicator per row (red dot = out with member, green = in).
- Fix returned_at not reflecting: after `librarian_mark_returned` / `librarian_set_return`, refetch admin rentals query + invalidate book availability. Show the actual `returned_at` date in the row.
- Librarian can edit the returned date (date picker → `librarian_set_return`).

## 2. "Log a rental" form

- Member field: autocomplete by **display name** (email hidden, shown as small subtitle).
- Book field: search by title, **author**, and **shelf_code**.
- Uses existing `librarian_log_rental`.

## 3. User insights & reports

- New RPC `library_user_insights(_library_id)` returning per-user rental_count, favorite genre, review_count, diary read_count.
- Admin → Users tab: filter/rentals-of-particular-user drill-in (click user → rental history modal).
- Reports tab: add "Top readers" CSV/PDF export using the new RPC.

## 4. Library picker & switcher

- Onboarding library picker already exists on `/`; ensure last selected library persists (localStorage key already there) and defaults to it on next visit.
- Add library switcher entry point to the top location tab in `AppLayout` (mobile/desktop header) so users can change library from anywhere.
- Rentals page: add search box (title/author).

## 5. Suggestions

- Add a dedicated **Publisher** input in the suggestions form, positioned below publisher details. Stored into suggestion note or new column.

## 6. Admin books tab

- Prominent full-width search input at top.
- Library name chip: small, horizontal, responsive (truncate on mobile).
- **Fix**: Safdar Hashmi library books not visible → verify admin queries filter by selected library correctly; ensure admin books query respects `library_id` from `useLibrary()` rather than a stale/default value. Fix genre_ml mislabels for Safdar's books (data patch).
- **Fix**: Availability dropdown (available / out_of_stock / rented) not saving → wire `librarian_set_availability` correctly with mutation + toast; ensure select onChange fires.

## 7. Per-library branding

- Home top banner reads the currently selected library's name/name_ml — remove hardcoded "Cherukad Smaraka Vayanasala" copy so Safdar Hashmi shows its own name.
- Distinct banner per library (library-specific title, ml name, location).

## 8. Data scoping

- Libraries only see rentals whose book belongs to them (already via `library_id` on books; audit `admin_list_users`, rentals queries, reports). New librarian-scoped rental fetcher.
- Total-users KPI: show only to `admin` role (hide from librarians).

## 9. Library profile page (`/libraries/$slug`)

- Route already exists. Add:
  - Header shows library-specific branding.
  - Staff can post activity with title/body/image (already present).
  - Public feed: readers see posts, can like + comment (already present).
- Add a Link/entry point from home banner → library profile.
- Sanity-check RLS on `library_posts`, `library_post_likes`, `library_post_comments` (public read, staff write, authed like/comment).

## 10. Book cover URL fix

- `BookCover.normalizeCoverUrl` already handles `/file/d/<id>` and `open?id=`. Extend to also handle:
  - `drive.google.com/uc?export=view&id=<id>`
  - Shared `usercontent.google.com` links
  - Trim whitespace / trailing params.
- Still fall back to text cover on img error.

## Technical notes

- **Migrations**: new `librarian_mark_rented(_rental_id)` RPC, new `library_user_insights(_library_id)` RPC, small data patch for Safdar genre_ml.
- **Frontend**: touches `src/routes/admin.tsx` (rentals table, books tab, log rental modal, reports), `src/routes/index.tsx` (banner), `src/components/AppLayout.tsx` (header switcher), `src/routes/profile.tsx` or new rentals search, `src/components/BookCover.tsx` (URL normalizer), `src/routes/libraries.$slug.tsx` (branding entry).
- No wallet/price logic re-introduced — system remains fully free.

Say **go** to implement.