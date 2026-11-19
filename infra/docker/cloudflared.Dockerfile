# Add a real readiness probe to the official cloudflared binary.
# Neither build arguments nor image layers contain a tunnel token.
ARG CLOUDFLARED_BASE=cloudflare/cloudflared:2026.11.1@sha256:e613aadbc2d9511785d2e67a86b0c8ac18dd63a3f9af0d06faf04cbfdcb35f2d
ARG PYTHON_IMAGE=python:3.13-slim-bookworm@sha256:a5a7017efc5969e00ae2b91c8eb0631049a569652aa4ffc4501769049ae45c72
FROM ${CLOUDFLARED_BASE} AS binary
FROM ${PYTHON_IMAGE}
COPY --from=binary /usr/local/bin/cloudflared /usr/local/bin/cloudflared
USER 65532:65532
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=8 \
    CMD ["python", "-c", "import urllib.request; r=urllib.request.urlopen('http://127.0.0.1:2000/ready', timeout=3); raise SystemExit(0 if r.status == 200 else 1)"]
ENTRYPOINT ["cloudflared"]
