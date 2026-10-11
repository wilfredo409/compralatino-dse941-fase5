FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev
WORKDIR /app
COPY backend/src ./backend/src
COPY backend/db ./backend/db
COPY openapi.yaml ./openapi.yaml
WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.js"]
