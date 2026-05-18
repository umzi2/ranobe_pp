# ──────────────────────────────────────────────
# Stage 1: сборка
# ──────────────────────────────────────────────
FROM rust:1.94-slim-bookworm AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        protobuf-compiler \
        pkg-config \
        libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN cargo build --release

# ──────────────────────────────────────────────
# Stage 2: финальный образ
# ──────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        libssl3 \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/ranobe_pp_backend /app/ranobe_pp_backend

RUN mkdir -p /app/data2 /app/backups

EXPOSE 8080

ENV RUST_LOG=info,ranobe_pp_backend=debug

CMD ["/app/ranobe_pp_backend"]
