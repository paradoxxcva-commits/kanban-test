FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.json ./

RUN bun install

COPY . .

RUN bun run build

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0

COPY --from=build /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
