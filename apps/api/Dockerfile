FROM node:24-bookworm-slim AS build

WORKDIR /workspace
RUN apt-get update -y && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN npm run prisma:generate -w @hero-guesser/api
RUN npm run build -w @hero-guesser/api

FROM node:24-bookworm-slim AS runtime

WORKDIR /workspace
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev

COPY --from=build /workspace/apps/api/dist apps/api/dist
COPY --from=build /workspace/apps/api/prisma apps/api/prisma
RUN npm run prisma:generate -w @hero-guesser/api

RUN mkdir -p /workspace/codex-workspace

EXPOSE 3000

CMD ["sh", "-c", "npm run prisma:migrate -w @hero-guesser/api && npm run start -w @hero-guesser/api"]
