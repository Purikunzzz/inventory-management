"""Dump item image URLs from the current database into images.csv.

Run against the database that already has the photos:
    DATABASE_URL=postgresql://... python -m scripts.export_images
Commit the resulting images.csv; the app re-applies it on startup, so a fresh
database gets the same photos without re-uploading them.
"""
import csv
import pathlib

from app.database import SessionLocal
from app.models.item import Item

OUT = pathlib.Path(__file__).resolve().parent.parent / "images.csv"


def main() -> None:
    db = SessionLocal()
    try:
        rows = (
            db.query(Item.name, Item.image_url)
            .filter(Item.image_url.isnot(None), Item.image_url != "")
            .order_by(Item.name)
            .all()
        )
    finally:
        db.close()
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Name", "Image URL"])
        writer.writerows(rows)
    print(f"Wrote {len(rows)} image URLs to {OUT}")


if __name__ == "__main__":
    main()
