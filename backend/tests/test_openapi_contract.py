import json

from app.openapi_export import OPENAPI_PATH, build_openapi, render


def test_committed_openapi_is_up_to_date() -> None:
    assert OPENAPI_PATH.exists(), "Run: uv run python -m app.openapi_export"
    assert OPENAPI_PATH.read_text() == render(), (
        "backend/openapi.json is stale. Run: uv run python -m app.openapi_export "
        "then regenerate mobile types (cd mobile && npm run api:types)."
    )


def test_contract_documents_health_and_error_envelope() -> None:
    schema = build_openapi()

    assert "/api/v1/health" in schema["paths"]
    assert "/api/v1/health/ready" in schema["paths"]
    ready_responses = schema["paths"]["/api/v1/health/ready"]["get"]["responses"]
    assert "503" in ready_responses
    assert "ErrorResponse" in json.dumps(ready_responses)
    assert {"ErrorResponse", "ErrorBody", "HealthResponse"} <= set(schema["components"]["schemas"])
