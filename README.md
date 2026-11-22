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
`BorrowReturn`, `QrScanner`, `Dashboard`, and the
`Maintenance`/`Reports` pages) uses `item.image_url || getPlaceholderImage(item)`.

**To add a real equipment photo:** in the Add/Edit item dialog, either
**Upload photo** (JPEG/PNG/WebP, ≤ 5 MB) or paste an image link. Any item
with a non-null `image_url` renders that photo instead of the category
fallback.

### Photo uploads (Cloudinary)

Render's disk is wiped on every deploy/restart, so uploaded files are stored
in Cloudinary, and only the resulting URL goes into `items.image_url`.

- `POST /api/items/{id}/image` (admin, multipart field `file`) →
  `item_service.set_item_image` → `app/services/image_storage.py`.
- The file type is checked from its magic bytes, not its name; > 5 MB → 413.
- Each item has a fixed Cloudinary id `lab-inventory/items/item-{id}`
  that is overwritten on re-upload, so no orphans pile up; the returned URL
  carries a new version, so browsers don't show the old cached photo.
  Cloudinary caps stored images at 1600×1600.
- Needs `CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud>` (Cloudinary
  dashboard → "API environment variable"). Without it the endpoint returns
  503 and pasting links still works.

**Backing up photo links:** run `python -m scripts.export_images` against the
production DB and commit `images.csv`; on startup `apply_images()` restores
those URLs to any item that has none (e.g. after a DB reset).
