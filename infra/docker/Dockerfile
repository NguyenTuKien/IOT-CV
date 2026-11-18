# Existing application sources and lockfiles are build inputs, not modified.
# Base-image index digests verified on 18/11/2026.
ARG NODE_IMAGE=node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54
ARG PYTHON_IMAGE=python:3.13-slim-bookworm@sha256:a5a7017efc5969e00ae2b91c8eb0631049a569652aa4ffc4501769049ae45c72
ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.13.6@sha256:af22a52f5eafef3d78e551599d405c02df61919d18028f0cea8eda93bc9986d0

FROM ${NODE_IMAGE} AS frontend-builder
WORKDIR /build/frontend
RUN npm install --global pnpm@11.10.0
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
# Frontend protocol validation imports this file outside frontend/.
COPY backend/ws-contract.schema.json /build/backend/ws-contract.schema.json
COPY frontend/ ./
RUN pnpm build

FROM frontend-builder AS frontend-checks
COPY backend/config.py backend/schemas.py /build/backend/
RUN pnpm lint && pnpm test && pnpm typecheck

FROM ${UV_IMAGE} AS uv
FROM ${PYTHON_IMAGE} AS python-dependencies
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1 UV_NO_CACHE=1
WORKDIR /app
COPY pyproject.toml uv.lock ./
# The existing vision extra supplies OpenCV for the fake-camera demo.
RUN uv sync --locked --no-build --no-dev --extra vision

FROM python-dependencies AS backend-checks
RUN uv sync --locked --no-build --extra dev --extra vision
COPY backend/ /app/backend/
COPY scripts/ /app/scripts/
COPY docs/hop-dong-mjpeg.md /app/docs/hop-dong-mjpeg.md
COPY --from=frontend-builder /build/frontend/dist/ /app/frontend/dist/
RUN uv run --no-sync --no-build ruff check backend \
    && uv run --no-sync --no-build pytest

FROM ${PYTHON_IMAGE} AS runtime
ENV PATH=/app/.venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    BACKEND_HOST=0.0.0.0 \
    BACKEND_PORT=8000 \
    TELEMETRY_AUTOSTART=0 \
    MAVLINK_UDP_HELLO="" \
    CAMERA_FAKE=1 \
    VISION_ENABLED=1 \
    RECORD_VIDEO=0 \
    MQTT_BROKER=mosquitto
RUN groupadd --gid 10001 iotcv \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin iotcv \
    && mkdir -p /app/logs /app/models \
    && chown 10001:10001 /app/logs /app/models
WORKDIR /app
COPY --from=python-dependencies /app/.venv/ /app/.venv/
COPY backend/ /app/backend/
COPY --from=frontend-builder /build/frontend/dist/ /app/frontend/dist/
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; r=urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3); raise SystemExit(0 if r.status == 200 else 1)"]
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-graceful-shutdown", "20"]
