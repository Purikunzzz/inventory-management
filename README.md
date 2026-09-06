# Laboratory Inventory Management — Backend API

FastAPI + SQLAlchemy backend for the Computer/EE lab inventory system. See
`CLAUDE.md` for architecture rules and domain vocabulary.

## Equipment Images

`Item.image_url` (`app/models/item.py`, `app/schemas/item.py`) is a plain
optional field: `POST /items` and `PATCH /items/{id}` accept it, and
`item_service` stores/returns it as-is. The backend never generates a value
for it — items seeded from `equipment.csv` (see `app/seed.py`) have no image
and no category, so `image_url` is `null` until an admin sets one.

We do **not** call any external image API for the fallback — not a stock
photo service, not Wikimedia, not a placeholder-image host. A prior version
of this fell back to Wikimedia Commons photos per category, but one of the
picks (the generic "unrecognized category" fallback) was a photo of a
person, which is unacceptable for a filler image shown across dozens of
unrelated inventory items. That approach was reverted; no network-fetched
image may be used as a fallback without explicit approval.

Instead, `getPlaceholderImage(item)` in `src/lib/utils.js` infers a category
label — from the item's `category` field if set, otherwise by matching
keywords in the item `name` (oscilloscope, multimeter, Arduino, Raspberry
Pi, soldering, sensor, etc.; see `CATEGORY_STYLES`) — and builds a small SVG
(colored box + category label text) **inline, in JS**, encoded as a
`data:image/svg+xml,...` URI. No network request happens when an item
renders. Unrecognized/custom categories get a color deterministically
hashed from the label instead of a fixed swatch.

Every page that renders item images (`Inventory`, `ItemDetail`, `Locations`,
`BorrowReturn`, `QrScanner`, `Dashboard`, and the mock-data
`Maintenance`/`Reports` pages) uses `item.image_url || getPlaceholderImage(item)`.

**To add a real equipment photo:** set `image_url` on the item via
`PATCH /items/{id}` (or the Inventory admin UI) — any item with a non-null
`image_url` renders that photo instead of the category fallback.
