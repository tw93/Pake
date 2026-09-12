# syntax=docker/dockerfile:1.4
# Cargo build stage - Updated to latest Rust for edition2024 support
FROM rust:latest AS base

# Update Rust to ensure we have the latest version with edition2024 support
RUN rustup update stable && rustup default stable

# Verify Rust version supports edition2024
RUN rustc --version && cargo --version

# Install Rust dependencies
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    rm -f /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/cache/apt/archives/lock && \
    apt-get update && apt-get install -y --no-install-recommends \
    libdbus-1-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev \
    libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev \
    libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
    gnome-video-effects && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set PKG_CONFIG_PATH for GLib detection
ENV PKG_CONFIG_PATH=/usr/lib/pkgconfig:/usr/share/pkgconfig:/usr/lib/x86_64-linux-gnu/pkgconfig

# Verify Rust version
RUN rustc --version && echo "Rust version verified"

# Share the system toolchain layer between compilation and the final image.
FROM base AS cargo-builder
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
FROM node:22-bookworm AS node-runtime

FROM base AS builder
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && \
    npm install -g pnpm@10.26.2

# Install Node dependencies before copying frequently changing app sources.
WORKDIR /pake
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm \
    pnpm install --frozen-lockfile

# Copy project files
COPY . /pake
WORKDIR /pake

# Copy Rust build artifacts
COPY --from=cargo-builder /pake/src-tauri /pake/src-tauri
COPY --from=cargo-builder /cargo-cache/git /usr/local/cargo/git
COPY --from=cargo-builder /cargo-cache/registry /usr/local/cargo/registry

# Install dependencies and build pake-cli
RUN pnpm run cli:build

# Set up the entrypoint
WORKDIR /output
ENTRYPOINT ["node", "/pake/dist/cli.js"]
