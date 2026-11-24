"""Export the OpenAPI contract to `backend/openapi.json`.

This file is the only thing the mobile app consumes from the backend (decision
0001): mobile generates its TypeScript API types from it. A test fails if the
committed file is out of date.

Usage:  uv run python -m app.openapi_export          # write
        uv run python -m app.openapi_export --check  # exit 1 if stale
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from app.core.config import Environment, Settings

OPENAPI_PATH = Path(__file__).resolve().parent.parent / "openapi.json"


def build_openapi() -> dict[str, Any]:
    from app.main import create_app

    # A placeholder URL is enough: building the schema never connects to the DB.
    settings = Settings(
        _env_file=None,
        app_env=Environment.TEST,
        database_url="postgresql+psycopg://openapi:openapi@localhost:5432/openapi",
        enable_api_docs=True,
    )
    return create_app(settings).openapi()


def render() -> str:
    return json.dumps(build_openapi(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main(argv: list[str]) -> int:
    content = render()
    if "--check" in argv:
        current = OPENAPI_PATH.read_text() if OPENAPI_PATH.exists() else ""
        if current != content:
            print("openapi.json is out of date. Run: uv run python -m app.openapi_export")
            return 1
        print("openapi.json is up to date.")
        return 0
    OPENAPI_PATH.write_text(content)
    print(f"Wrote {OPENAPI_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
