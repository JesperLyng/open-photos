FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY packages/types/package.json packages/types/package.json

RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm --workspace server run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist

EXPOSE 3000
CMD ["node", "server/dist/index.js"]
