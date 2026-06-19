FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.json ./

RUN bun install

COPY . .

# Жестко прописываем правильный URL инстанса на этапе компиляции
ENV SUPABASE_URL=https://khsnbbogaemvgirqdljj.supabase.co
ENV SUPABASE_ANON_KEY=sb_publishable_UbT2C-GpV5Fo-rLLk7yO_Q_LHYeHUzi

RUN bun run build

FROM node:22-alpine
