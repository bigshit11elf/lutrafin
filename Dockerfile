FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run check && npm test && npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    APP_PORT=3000 \
    DATABASE_PATH=/data/app.db
WORKDIR /app

RUN addgroup --system --gid 10001 lutrafin \
  && adduser --system --uid 10001 --ingroup lutrafin --home /app lutrafin \
  && mkdir -p /data \
  && chown -R lutrafin:lutrafin /data /app

COPY --from=build --chown=lutrafin:lutrafin /app/build ./build
COPY --from=build --chown=lutrafin:lutrafin /app/package.json /app/package-lock.json ./
COPY --from=build --chown=lutrafin:lutrafin /app/LICENSE /app/THIRD_PARTY_NOTICES.md ./
COPY --from=build --chown=lutrafin:lutrafin /app/src/lib/server/infrastructure/database/migrations ./src/lib/server/infrastructure/database/migrations
RUN npm ci --omit=dev && npm cache clean --force

USER lutrafin
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "build"]
