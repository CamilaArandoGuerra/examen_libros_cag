FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js db.sql ./

ENV NODE_ENV=production
ENV PORT=3000
ENV APP_VERSION=1.0.0

EXPOSE 3000

CMD ["node", "server.js"]