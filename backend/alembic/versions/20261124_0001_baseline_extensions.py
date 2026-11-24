"""Baseline: enable PostgreSQL extensions required by the agreed data design.

- citext: case-insensitive unique emails (users, Phase 1b; decision 0006)
- btree_gist: exclusion constraints preventing overlapping bookings (Phase 2; decision 0005)

Both are available on Neon and standard PostgreSQL 16 builds. No tables yet.

Revision ID: 0001
Revises:
Create Date: 2026-11-24
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS btree_gist")
    op.execute("DROP EXTENSION IF EXISTS citext")
