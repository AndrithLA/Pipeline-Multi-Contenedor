FROM node:18-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src/ ./src/

EXPOSE 3002

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:3002/health || exit 1

CMD ["node", "src/app.js"]