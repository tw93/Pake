# syntax=docker/dockerfile:1.4
# Cargo build stage - Updated to Rust 1.82 for zerovec dependency compatibility
FROM rust:1.82-slim AS cargo-builder
# Install Rust dependencies
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/usr/local/cargo/registry \
    apt-get update && apt-get install -y --no-install-recommends \
    libdbus-1-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev \
    libwebkit2gtk-4.1-dev build-essential curl wget libssl-dev \
    libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
    gnome-video-effects

# Verify Rust version
RUN rustc --version && echo "Rust version verified"

COPY . /pake
WORKDIR /pake/src-tauri
# Build cargo packages and store cache
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo fetch && \
    cargo build --release && \
    mkdir -p /cargo-cache && \
    cp -R /usr/local/cargo/registry /cargo-cache/ && \
    ([ -d "/usr/local/cargo/git" ] && cp -R /usr/local/cargo/git /cargo-cache/ || mkdir -p /usr/local/cargo/git) && \
    cp -R /usr/local/cargo/git /cargo-cache/
# Verify the content of /cargo-cache && clean unnecessary files
RUN ls -la /cargo-cache/registry && ls -la /cargo-cache/git && rm -rfd /cargo-cache/registry/src

# Main build stage
FROM rust:1.82-slim AS builder
# Install Rust dependencies
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/usr/local/cargo/registry \
    apt-get update && apt-get install -y --no-install-recommends \
    libdbus-1-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev \
    libwebkit2gtk-4.1-dev build-essential curl wget libssl-dev \
    libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
    gnome-video-effects

# Verify Rust version in builder stage
RUN rustc --version && echo "Builder stage Rust version verified"

# Install Node.js 22.x and pnpm
RUN --mount=type=cache,target=/var/cache/apt \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get update && apt-get install -y nodejs && \
    npm install -g pnpm

# Copy project files
COPY . /pake
WORKDIR /pake

# Copy Rust build artifacts
COPY --from=cargo-builder /pake/src-tauri /pake/src-tauri
COPY --from=cargo-builder /cargo-cache/git /usr/local/cargo/git
COPY --from=cargo-builder /cargo-cache/registry /usr/local/cargo/registry

# Install dependencies and build pake-cli
RUN --mount=type=cache,target=/root/.local/share/pnpm \
    pnpm install --frozen-lockfile && \
    pnpm run cli:build

# Set up the entrypoint
WORKDIR /output
ENTRYPOINT ["node", "/pake/dist/cli.js"]
