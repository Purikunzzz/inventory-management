"""Shared Pydantic field types."""

from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator

from app.core.timeutil import as_utc, to_utc_naive

# Response fields: DB naive UTC → aware UTC, serialised with a trailing "Z".
UtcDateTime = Annotated[datetime, AfterValidator(as_utc)]

# Request fields: any offset accepted, stored as naive UTC.
UtcDateTimeIn = Annotated[datetime, AfterValidator(to_utc_naive)]
