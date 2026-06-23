## Scope

Single batch implementing every item from your message. Grouped by area below.

## 1. Languages, Genres, Writers, Home

- New `languages.$slug.tsx` listing books of that language (mirror of `genres.$slug.tsx`). `/languages` index shows language tiles like Genres/Writers.
- Fix current behavior: clicking a language no longer routes to search.
- Home (`index.tsx`): add a "Browse by language" rail next to Genres/Writers.

## 2. Diary

- Remove the "All" filter from the poster view (keep status filters Read/Reading/Want).
- Rename remaining "Watched" references to "Read" (audit pass).

## 3. Rentals (member side)

- Rent-now form: optional `phone` field. On submit, save to `profiles.phone` (private) if user has none, prefill next time.
- Show rented date + due date + return date on the rental card and in profile.
- Status changes (confirmed → packed → shipped → delivered → returned) trigger a notification to both member and the library's librarians.
- Column header in tracking/admin table renamed from "Rent" to "Price".

## 4. Fines

- ₹1/day after day 20. Computed as `GREATEST(0, days_between(returned_at, due_at)) * 1`.
- On librarian "Mark returned" RPC: compute fine, debit `profiles.wallet_balance`, write a `transaction_log` row, send notification to member with breakdown.

## 5. Admin / Library Admin dashboard

- Rename role label: `librarian` → "Library Admin" everywhere in UI (DB enum stays `librarian`). `admin` stays "Admin".
- Hide role switcher for non-staff; only Admin can grant via email (existing RPC).
- Rentals table columns: Member (name + email prominent) · Book · Library · Rented · Due · Returned · Price · Fine · Status · Actions.
- Sortable headers on every admin/library-admin table (books, rentals, users, suggestions, activity).
- Library Admin sees only their library's books/rentals/users/suggestions. Admin sees all + per-library filter.
- "Users who rented from this library" tab for Library Admin.
- Suggestions panel: Approve / Reject / Mark Available buttons; each writes status + notifies the suggester.
- Editable books table: inline edit (title, author, shelf_code, rent_price, available, language, genre). Saves per-row.
- CSV import shows the parsed rows as an editable preview table before commit.
- Export buttons: CSV (existing) + PDF (new) for Books, Rentals, Users, Activity Log.

## 6. Activity log

- Rename "Actor" column to "User" (display actor name).
- Remove "Subject" column (merge subject into the action sentence).
- Add columns: Return time, Amount (price_paid or fine).

## 7. Profile (public `u.$id`)

- Reading insights card: total read, currently reading, want-to-read, favorite genre, reading streak (consecutive days with diary activity).

## 8. Notifications

- Librarian + member get notified on: rental created, status update, return + fine, suggestion decision, waitlist assignment (existing).
- Real-time via existing notifications channel.

## Technical notes

- **Migration**: add `profiles.phone text`; add `rentals.fine_amount numeric default 0`; extend `transaction_log` action enum-by-text with `fine_charged`, `suggestion_decided`; new RPCs: `member_set_phone(text)`, `librarian_mark_returned(rental_id)` (computes fine, debits wallet, logs), `librarian_decide_suggestion(id, decision)`, `library_admin_list_members(library_id)`, `reading_insights(user_id)`.
- **RLS**: phone column readable only by self + staff; fine_amount staff-write.
- **Frontend libs**: use `jspdf` + `jspdf-autotable` for PDF export, `@tanstack/react-table` already implied — if absent, add minimal sortable wrapper.
- **No DB role rename** — only UI label changes; `has_role(..., 'librarian')` unchanged.
- **Routes added**: `languages.$slug.tsx`, possibly `admin.suggestions.tsx`, `admin.users.tsx` sections; reuse existing `admin.tsx` tabs where possible.

## Out of scope

- No design overhaul; reuse existing tokens/components.
- No payment integration for fines beyond wallet debit.
- No SMS — phone is stored for librarian contact only.
