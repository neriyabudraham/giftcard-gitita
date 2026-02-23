FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/vouchers

EXPOSE 3001

CMD ["node", "src/index.js"]
