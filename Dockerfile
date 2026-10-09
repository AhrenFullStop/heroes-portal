# Stage 1: build SPA
FROM node:20-alpine AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
COPY shared/ /app/shared/
RUN npm run build

# Stage 2: build server
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install
COPY server/ ./
COPY shared/ ../shared/
COPY db/ ../db/
RUN npm run build

# Stage 3: runtime
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=server-build /app/server/node_modules ./node_modules
COPY --from=server-build /app/server/dist ./dist
COPY --from=server-build /app/shared ./shared
COPY --from=server-build /app/db ./db
COPY --from=web-build /app/web/dist ./web/dist

EXPOSE 8080
CMD ["node", "dist/server/src/index.js"]
