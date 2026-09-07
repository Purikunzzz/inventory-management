from enum import Enum


class ReportTypeEnum(str, Enum):
    """Report kinds exposed on the Reports page."""

    inventory = "inventory"
    borrowing = "borrowing"
    maintenance = "maintenance"
    damage = "damage"
    usage = "usage"
    financial = "financial"


class ReportFormatEnum(str, Enum):
    """File formats a report can be rendered to."""

    pdf = "pdf"
    csv = "csv"
    excel = "excel"
