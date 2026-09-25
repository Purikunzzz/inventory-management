import csv, os
from app.database import SessionLocal
from app.models.item import Item

import pathlib
CSV_PATH = str(pathlib.Path(__file__).resolve().parent.parent / "equipment.csv")

def seed_if_empty() -> None:
    db = SessionLocal()
    try:
        if db.query(Item).count() > 0:
            print("Database already seeded, skipping")
            return
        path = CSV_PATH
        if not os.path.exists(path):
            print(f"Seed CSV not found at {path}")
            return
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                name = row["Name"].strip().replace("\t", " ")
                if not name:
                    continue
                def parse_qty(val):
                    import re
                    m = re.search(r'\d+', str(val))
                    return int(m.group(0)) if m else 0

                db.add(Item(
                    name=name,
                    description=row.get("Description", "").strip(),
                    total_quantity=parse_qty(row["Total Quantity"]),
                    available_quantity=parse_qty(row["Quantity Available"]),
                    low_stock_threshold=1,
                    is_active=True,
                ))
                count += 1
        db.commit()
        print(f"Seeded {count} items from CSV")
    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
    finally:
        db.close()


IMAGES_PATH = str(pathlib.Path(__file__).resolve().parent.parent / "images.csv")


def apply_images() -> None:
    """Fill image_url from images.csv for items that don't have one yet.

    Idempotent and never overwrites an image set through the app, so a fresh
    database recovers its photos without anyone re-adding them.
    """
    if not os.path.exists(IMAGES_PATH):
        return
    db = SessionLocal()
    try:
        with open(IMAGES_PATH, newline="", encoding="utf-8") as f:
            urls = {r["Name"].strip(): r["Image URL"].strip() for r in csv.DictReader(f) if r.get("Image URL")}
        updated = 0
        for item in db.query(Item).filter(Item.image_url.is_(None)).all():
            if item.name in urls:
                item.image_url = urls[item.name]
                updated += 1
        db.commit()
        print(f"Applied {updated} image URLs from images.csv")
    except Exception as e:
        db.rollback()
        print(f"Image restore failed: {e}")
    finally:
        db.close()
