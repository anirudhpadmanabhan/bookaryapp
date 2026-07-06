## Scope

You picked all four groups, so I'll ship them in order across several turns. This is intentionally sequenced so each slice lands working before the next starts.

### Turn 1 — Rental workflow + Hide money & Browse (this turn)

Rental workflow (librarian)
- When status = `delivered`, action becomes **Mark Rented** (transitions to `rented` state — treated as an active checkout).
- New action **Waiting for Return** (`awaiting_return`) — yellow chip.
- **Return** action → row turns green, status becomes `returned`, `returned_at` set.
- Librarian can **edit `returned_at`** inline on the row.
- Librarian can **log a manual rental entry** (member + book + dates, no wallet charge).
- Rent Now flow becomes **free** (`price_paid = 0`, no wallet debit) — server RPC `rent_book` updated.
- Admin/library-admin rentals page: **grouped by month** (collapsible sections, newest first).

Hide money + browse
- Hide `price_paid`, `fine_amount`, `wallet_balance` UI on member and admin surfaces (columns, cards, badges). DB columns stay; just no rendering.
- Left tab "Browse" gets a hide toggle stored in `localStorage` (per-user preference), togglable from a small gear in the sidebar.
- Cover URL bug: fix `book #4012 AADUJEEVITHAM` — audit `BookCover` `cover_url` handling + verify the row's `cover_url` value is present and reachable.

### Turn 2 — Librarian dashboard polish

- Prominent search bar; library name shrinks to a compact horizontal chip (responsive).
- Prefix-priority search ranking: exact-prefix > word-start > substring; e.g. "aad" ranks "Aadujeevitham" above "Kaadu".
- Suggestion click → navigate straight to book page (no intermediate search results).
- Hide "Orig. Author" column in admin book tables.
- Availability dot: small round indicator — green (available), red (rented/out).
- Status setter dropdown: available / out_of_stock / rented (writes to `books.availability`).
- Waitlist rows show reader `display_name` + email.
- Suggestions list shows suggester's member details (name, email, active rentals count).
- Suggestions form: publisher name input under existing publisher details.

### Turn 3 — New surfaces

- **Reports tab** (admin + library admin): builders for Members, Books, Rentals, Memberships with sortable columns + filters (date range, library, status). CSV + PDF export.
- **Add Member** flow for librarian: create/invite user, attach to library.
- **Library picker on first screen** (onboarding) + retain top switcher.
- Library data scoping: a library only sees its own data from the point a member first rents there (already enforced by `books.library_id` + `has_role_in_library` — verify).
- **Total user data** aggregated view → Admin only (already gated by `admin_list_users`).
- **Library profile page** (`/libraries/$slug`): library posts activities with photos; members can like + comment. New tables: `library_posts`, `library_post_likes`, `library_post_comments`.

## Technical notes

Migration (turn 1):
- `alter type rental_status add value 'rented'` and `'awaiting_return'` (or reuse `tracking_status` text — check current values).
- `books.availability text default 'available'` with check-in enum ('available','out_of_stock','rented').
- New RPC `librarian_log_rental(_user_id, _book_id, _rented_at, _due_at, _returned_at)` — staff-only, no wallet.
- Update `rent_book`: `price := 0`, skip wallet debit + transaction_log wallet_debit row.
- New RPC `librarian_set_return(_rental_id, _returned_at)` — staff-only edit of return date.

Migration (turn 3):
- `library_posts(library_id, author_id, body, image_url, created_at)` + likes + comments tables with proper GRANTs + RLS.

UI locations:
- Rentals table lives in `src/routes/admin.tsx` and `src/routes/tracking.tsx`.
- Left tab hide → `src/components/AppLayout.tsx`.
- Cover audit → `src/components/BookCover.tsx` + DB row for book 4012.

## Out of scope

- No design overhaul.
- No SMS/email; notifications keep using existing `notifications` table.
- No payment provider; "free" just means price=0.

---

Reply **"go"** and I'll start Turn 1. If you want me to reorder or drop items, tell me which.
