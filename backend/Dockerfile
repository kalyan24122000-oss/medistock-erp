# PharmaDesk Licensing Backend Dockerfile
# Uses Node 22 (Debian Bookworm Slim) with full glibc support for better-sqlite3 native bindings
FROM node:22-slim AS builder

WORKDIR /app

# Install build essentials for native C++ compilation (if prebuilt binary is needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Production runtime image
FROM node:22-slim

WORKDIR /app

# Ensure SQLite runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app ./

ENV NODE_ENV=production
ENV PORT=10000

# Persistent directory for license_master.db
VOLUME ["/app/data"]

EXPOSE 10000

CMD ["node", "server.js"]
