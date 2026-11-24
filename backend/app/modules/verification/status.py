"""Verification lifecycle shared by provider profiles and clinics (doc 13, decision 0006)."""

from __future__ import annotations

from enum import StrEnum


class VerificationStatus(StrEnum):
    DRAFT = "draft"  # being filled in; never public
    SUBMITTED = "submitted"  # waiting for admin review
    NEEDS_INFO = "needs_info"  # admin asked for more/better documents
    VERIFIED = "verified"  # eligible for discovery and bookings (if also active)
    REJECTED = "rejected"


class ActiveStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


EDITABLE_DOCUMENT_STATES = {
    VerificationStatus.DRAFT,
    VerificationStatus.NEEDS_INFO,
    VerificationStatus.REJECTED,
}

VERIFICATION_SQL = "'draft', 'submitted', 'needs_info', 'verified', 'rejected'"
