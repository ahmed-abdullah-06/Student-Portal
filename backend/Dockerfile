# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma7.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/generated ./generated
COPY --chown=app:app . .
USER app
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
