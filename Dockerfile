FROM risingstack/alpine:3.4-v8.5.0-4.7.0

ENV PORT 3001

EXPOSE 3001

COPY package.json package.json
RUN npm install

COPY . .
RUN npm run build

CMD ["node", "dist/"]
