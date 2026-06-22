
This work is large, so it's split into 4 phases. Each phase is shippable on its own — I'll do them in order and check in after each.

## Phase 1 — Quick wins (data cleanup + CTA copy)

- Delete books added after the Cherukad seed so the catalogue is exactly 4,650 again. Done via a one-off `DELETE FROM books WHERE id NOT IN (<seeded ids>)` scoped by `created_at > <seed timestamp>`. Cherukad library row preserved.
- Remove the rupee figure from the "Rent now" button on `books.$id.tsx` and `BookCard.tsx` — button reads "Rent now" only; price still shown elsewhere on the page.

## Phase 2 — Waitlist + Notifications + Tracking

Waitlist (book page)
- When a book is currently rented (any open `rentals` row), show "Join waitlist" instead of disabled Rent. If the signed-in user is already on the waitlist for it, show "Cancel waitlist request" instead.
- The existing `assign_next_waitlist` trigger already auto-assigns to the next user on return and inserts a `waitlist_assigned` notification — confirm it's attached to `rentals` AFTER UPDATE and add it if missing.

Notifications (bell inbox)
- One bell button in the header opens a popover listing all `notifications` for the user, grouped by unread/read, with mark-as-read and mark-all-read. Covers booking, tracking, return, rating/review, and waitlist alerts (all already use the `notifications` table).
- Unread badge count on the bell.

Tracking page (`/tracking`)
- Authenticated route listing each active rental + waitlist entry for the user with: book cover/title, current `tracking_status`, admin notes, timeline (rented_at → due_at → returned_at, plus notification history filtered to that book).

## Phase 3 — Admin tooling

- **Spreadsheet-style books table**: replace the current admin books list with an inline-editable grid (title, author, year, pages, shelf, rent_price, library). Uses TanStack Table + editable cells, debounced save per row via `useUpdateBook`.
- **Per-library scoping**: filter dropdown by library; "Total books: N" badge per library. CSV upload form already exists — wire it to a library selector so uploads land under the chosen library.
- **Member management tab**: list profiles, show active rentals count, "Approve" toggle (adds an `approved` boolean to `profiles` and a sign-in gate that blocks unapproved users with a friendly message).
- **Mark rentals returned**: button per active rental in admin → sets `returned_at = now()`, which triggers waitlist auto-assignment.
- **Per-book "Fetch from Google Books"** button in the admin editor → server function calls `https://www.googleapis.com/books/v1/volumes` and patches missing `pages`, `year`, `description`. No bulk job.

## Phase 4 — Security, perf, auth

- **RLS audit**: confirm `profiles.phone`/`address` have no `TO anon` SELECT; restrict to `auth.uid() = id` + staff. Replace any public reviews query that exposes `user_id` with the existing `profile_cards` view (display_name + tag only, no UUID leaked to UI).
- **Perf**: add DB indexes on `books(library_id, created_at)`, `books(slug)`, `rentals(book_id, returned_at)`, `waitlist(book_id, created_at)`. Paginate the books list (50/page) instead of loading all 4,650; use `useInfiniteQuery`. Memoize `BookCard`.
- **Auth finalize**: ensure `/auth` page handles email/password + Google, with `emailRedirectTo: window.location.origin`. Add `/reset-password` route. Verify Google provider is enabled.

## Technical notes

- All schema changes go through migrations: `profiles.approved bool`, indexes, ensuring `assign_next_waitlist` trigger exists, and any RLS tightening.
- New server functions in `src/lib/admin.functions.ts`: `googleBooksLookup`, `setMemberApproved`, `markRentalReturned`.
- Bell uses existing `notifications` table; add `read_at` column if missing.
- Tracking page is under `_authenticated/`.

Reply "go" to start with Phase 1, or tell me to reorder.
