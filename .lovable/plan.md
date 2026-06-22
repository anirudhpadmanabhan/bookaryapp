## Scope (in priority order)

### 1. Diary — 3 new views (UI only, no data writes)
Add a view switcher on `/diary` with four tabs: **Calendar** (current), **Posters**, **Timeline**, **Reviews**.
- **Posters**: 4-col responsive grid of book covers with stars + small heart/note icons beneath (ref: screenshot 1).
- **Timeline**: dense row list — day number on the left, cover thumb, title, stars (ref: screenshot 2). Grouped by month with a "You've logged N entries in YYYY" header.
- **Reviews**: feed-style — cover thumb left, title + year, stars + "Watched <date>", full review text, like count (ref: screenshot 3).
- All three read from the existing `reading_diary` + `reviews` tables; no schema change.

### 2. Admin — library-scoped books + rack-code ordering + CSV modes
- Books table default-sorts by `shelf_code` ASC (rack code first, true asc collation).
- Add a **Library filter** dropdown at the top of the Books tab; books are listed under the selected library only. "All libraries" remains an option.
- Add/Edit book dialog gains a required **Library** field (defaults to current filter).
- CSV import dialog gets a radio: **Append** (insert new only) vs **Overwrite by shelf_code** (upsert: rows in CSV with existing `shelf_code` in that library are updated; untouched racks are preserved). Existing library selection stays.
- Spreadsheet edit row already exists from last turn — keep it; just respect the new library scope.

### 3. Admin — userbase + transaction log
- New tab **Users**: lists every profile (display_name, email, role badges, wallet, signup date, active-rental count) via a new admin RPC `admin_list_users()`.
- New tab **Activity log** backed by a new `transaction_log` table:
  - columns: `actor_id`, `actor_name`, `subject_user_id`, `subject_user_name`, `book_id`, `book_title`, `library_id`, `action` (enum: `rental_created`, `rental_returned`, `waitlist_joined`, `waitlist_cancelled`, `waitlist_assigned`, `role_granted`, `role_revoked`, `book_created`, `book_updated`, `book_deleted`), `metadata jsonb`, `created_at`.
  - Triggers on `rentals`, `waitlist`, `user_roles`, `books` write rows automatically with names captured at write time.
  - Admin-only SELECT; service_role for triggers.

### 4. Realtime fan-out across user / library / admin
- Enable Realtime on `rentals`, `waitlist`, `notifications`, `transaction_log`.
- The existing `assign_next_waitlist` trigger already inserts a notification — keep. Add notification inserts for: rental created (notifies user + every staff member of that library), rental returned (notifies admin + librarians).
- Client: subscribe in `AppLayout` to `notifications` for the signed-in user (already wired) and additionally to `transaction_log` when the user has admin/librarian role, surfacing a toast.

## Technical notes

- New migration:
  - `CREATE TABLE public.transaction_log` + GRANTs + RLS (admin/librarian SELECT; service_role ALL).
  - Trigger functions: `log_rental_change()`, `log_waitlist_change()`, `log_role_change()`, `log_book_change()` — all `SECURITY DEFINER`, capture `auth.uid()` as actor.
  - `admin_list_users()` SECURITY DEFINER RPC returning profile + email + roles + active rental count; admin-only.
  - Notification inserts inside the rental/waitlist triggers, fanned to all `librarian` users of the book's `library_id` + every `admin`.
  - `ALTER PUBLICATION supabase_realtime ADD TABLE` for the 4 tables.
- Frontend:
  - `src/routes/diary.tsx`: add Tabs (Calendar / Posters / Timeline / Reviews) — pure presentation.
  - `src/routes/admin.tsx`: library filter state, CSV mode radio, new Users + Activity tabs.
  - `src/lib/admin.ts`: `useAdminUsers()`, `useTransactionLog()`, CSV importer accepts `mode: 'append' | 'overwrite'`.
  - `src/components/AppLayout.tsx`: extra Realtime channel for staff toast.

## Out of scope this turn
- Google Books enrichment, member-approval flow, tracking page redesign (already shipped), payment changes.

Ready to ship — reply "go" and I'll execute as a single batch.