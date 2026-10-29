FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Comandos de migración e ingestión, ejecutados como jobs independientes.
FROM dependencies AS collector
ENV NODE_ENV=production
COPY --chown=node:node server ./server
COPY --chown=node:node src/core ./src/core
USER node
ENTRYPOINT ["node", "server/cli.mjs"]
CMD ["azure"]

FROM collector AS migrator
CMD ["init"]

FROM dependencies AS builder
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production PORT=4000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/server/migrations ./server/migrations
COPY --from=builder --chown=node:node /app/server/schema ./server/schema
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s CMD node --input-type=module -e "try { const response = await fetch('http://127.0.0.1:' + process.env.PORT + '/api/ready/'); process.exit(response.ok ? 0 : 1); } catch { process.exit(1); }"
CMD ["node", "server.js"]
