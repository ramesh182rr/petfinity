"""Booking rules (decisions 0004 and 0012), kept in one place.

Every cancellation records which rule applied, and the parent sees the policy
before booking.
"""

from __future__ import annotations

from datetime import timedelta

# Cancellation (0012): free until this long before the start. Later owner
# cancellations are allowed but marked late, with no refund. Provider and admin
# cancellations always refund in full. Rescheduling uses the same cutoff.
FREE_CANCELLATION_BEFORE = timedelta(hours=2)

# Request mode (0004): the provider answers by the earlier of N hours after
# the request or shortly before the start.
REQUEST_RESPONSE_WINDOW = timedelta(hours=2)
REQUEST_DEADLINE_BEFORE_START = timedelta(minutes=30)
# Request-mode slots need more notice so the provider has time to answer.
REQUEST_MIN_LEAD = timedelta(minutes=60)

# Provider actions around the appointment time.
CHECK_IN_EARLY = timedelta(minutes=60)
NO_SHOW_GRACE = timedelta(minutes=15)

# Abuse limits.
MAX_ACTIVE_BOOKINGS_PER_OWNER = 20

POLICY_SNAPSHOT = {
    "version": 1,
    "free_cancellation_hours_before": int(FREE_CANCELLATION_BEFORE.total_seconds() // 3600),
    "late_cancellation": "no_refund",
    "provider_cancellation": "full_refund",
}

# Care bookings (decision 0015): free until 48 h before the start, then 50% back;
# no cancellation once care has started. Caretaker cancellations refund in full.
CARE_FREE_CANCELLATION_BEFORE = timedelta(hours=48)
CARE_POLICY_SNAPSHOT = {
    "version": 1,
    "kind": "care",
    "free_cancellation_hours_before": int(CARE_FREE_CANCELLATION_BEFORE.total_seconds() // 3600),
    "late_cancellation": "half_refund",
    "provider_cancellation": "full_refund",
}
