from pydantic import BaseModel
from datetime import date


class SummaryOut(BaseModel):
    """High-level dashboard counts."""
    total_items: int
    total_users: int
    active_borrows: int
    low_stock_items: int


class ItemUsageOut(BaseModel):
    """One row of the most-borrowed-items report."""
    item_id: int
    name: str
    borrow_count: int
    total_quantity_borrowed: int
    image_url: str | None = None


class StockMovementOut(BaseModel):
    """Per-day count of borrow vs. return events."""
    date: date
    borrowed: int
    returned: int


class LowStockOut(BaseModel):
    """Item at or below its low-stock threshold."""
    item_id: int
    name: str
    available_quantity: int
    low_stock_threshold: int
