# Root Dockerfile for PharmaDesk Licensing Backend deployment
FROM node:22-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/ ./
COPY admin-panel/ ./admin-panel/

# Production runtime image
FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app ./

ENV NODE_ENV=production
ENV PORT=10000

VOLUME ["/app/data"]

EXPOSE 10000

CMD ["node", "server.js"]
