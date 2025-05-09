FROM node:20-alpine

WORKDIR /app

COPY app/package*.json ./
RUN npm install

COPY app/src ./src

CMD ["node", "src/index.js"]