# syntax=docker/dockerfile:1.4

# Cargo build stage
FROM rust:1.80-slim AS cargo-builder

# Install Rust dependencies
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/usr/local/cargo/registry \
    apt-get update && apt-get install -y --no-install-recommends \
    libdbus-1-dev libsoup2.4-dev libjavascriptcoregtk-4.0-dev \
    libwebkit2gtk-4.0-dev build-essential curl wget libssl-dev \
    libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
    gnome-video-effects

COPY . /pake
WORKDIR /pake/src-tauri

# Build cargo packages
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo fetch && \
    cargo build --release

# Main build stage
FROM rust:1.80-slim AS builder

# Install Rust dependencies
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/usr/local/cargo/registry \
    apt-get update && apt-get install -y --no-install-recommends \
    libdbus-1-dev libsoup2.4-dev libjavascriptcoregtk-4.0-dev \
    libwebkit2gtk-4.0-dev build-essential curl wget libssl-dev \
    libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
    gnome-video-effects

# Install Node.js 19.x
RUN --mount=type=cache,target=/var/cache/apt \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get update && apt-get install -y nodejs

# Install pake-cli and its implicit runtime dependencies
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pake-cli && \
    cd /usr/lib/node_modules/pake-cli && \
    npm install

COPY --from=cargo-builder /pake/src-tauri /usr/lib/node_modules/pake-cli/src-tauri
COPY --from=cargo-builder /usr/local/cargo/git /usr/local/cargo/git
COPY --from=cargo-builder /usr/local/cargo/registry/cache /usr/local/cargo/registry/cache

WORKDIR /app
ENTRYPOINT ["pake"]
