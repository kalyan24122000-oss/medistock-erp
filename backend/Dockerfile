# Dockerfile for MediStock Licensing Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++ gcc

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Production image
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache libstdc++

COPY --from=builder /app ./

ENV NODE_ENV=production
ENV PORT=5000

# Mount persistent volume at /app/data if needed
VOLUME ["/app/data"]

EXPOSE 5000

CMD ["node", "server.js"]
