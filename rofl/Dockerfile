FROM node:20-alpine

WORKDIR /app

COPY app/package.json .
RUN npm install

COPY app/ .

EXPOSE 8080

CMD ["npm", "start"]