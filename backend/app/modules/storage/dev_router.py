"""Signed PUT/GET endpoints that emulate a bucket for STORAGE_BACKEND=local (dev only)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Request, Response, status
from fastapi.responses import FileResponse

from app.core.errors import AppError
from app.modules.storage.local import LocalStorage

router = APIRouter(prefix="/dev-storage", tags=["dev-storage"], include_in_schema=False)


def _storage(request: Request) -> LocalStorage:
    storage = request.app.state.storage
    assert isinstance(storage, LocalStorage)  # noqa: S101 - router only mounted for local
    return storage


def _forbidden() -> AppError:
    return AppError("forbidden", "This link is invalid or has expired.", status_code=403)


@router.put("/{key:path}", status_code=status.HTTP_204_NO_CONTENT)
async def put_object(
    key: str,
    request: Request,
    op: Annotated[str, Query()],
    exp: Annotated[int, Query()],
    sig: Annotated[str, Query()],
    ct: Annotated[str, Query()],
    max: Annotated[int, Query()],
) -> Response:
    storage = _storage(request)
    try:
        valid = op == "put" and storage.verify(
            op="put", key=key, exp=exp, sig=sig, content_type=ct, max_bytes=max
        )
    except ValueError:
        valid = False
    if not valid:
        raise _forbidden()
    if request.headers.get("content-type", "").split(";")[0].strip() != ct:
        raise AppError("invalid_content_type", "Content-Type does not match.", status_code=400)

    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > max:
            raise AppError("file_too_large", "The file is larger than allowed.", status_code=413)
    try:
        storage.write(key, bytes(body), ct)
    except ValueError as exc:
        raise _forbidden() from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{key:path}")
def get_object(
    key: str,
    request: Request,
    op: Annotated[str, Query()],
    exp: Annotated[int, Query()],
    sig: Annotated[str, Query()],
) -> FileResponse:
    storage = _storage(request)
    try:
        valid = op == "get" and storage.verify(op="get", key=key, exp=exp, sig=sig)
        info = storage.head(key) if valid else None
    except ValueError:
        valid, info = False, None
    if not valid:
        raise _forbidden()
    if info is None:
        raise AppError("not_found", "File not found.", status_code=404)
    return FileResponse(
        storage.path_for(key),
        media_type=info.content_type or "application/octet-stream",
        headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"},
    )
