FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.json ./

RUN bun install

COPY . .

# Прописываем урл для всех возможных типов сборщиков (Vite, Next, Nuxt, Node)
ENV SUPABASE_URL=https://khsnbbogaemvgirqdljj.supabase.co
ENV SUPABASE_ANON_KEY=sb_publishable_UbT2C-GpV5Fo-rLLk7yO_Q_LHYeHUzi

ENV VITE_SUPABASE_URL=https://khsnbbogaemvgirqdljj.supabase.co
ENV VITE_SUPABASE_ANON_KEY=sb_publishable_UbT2C-GpV5Fo-rLLk7yO_Q_LHYeHUzi

ENV NEXT_PUBLIC_SUPABASE_URL=https://khsnbbogaemvgirqdljj.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_UbT2C-GpV5Fo-rLLk7yO_Q_LHYeHUzi

RUN bun run build

# --- СТАДИЯ ЗАПУСКА (РАНТАЙМ) ---
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache curl

ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0

COPY --from=build /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
