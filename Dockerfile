FROM node:24-trixie AS base

ENV NODE_ENV production

WORKDIR /app/sanime

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod true

FROM base AS build-base
RUN pnpm install --frozen-lockfile --prod false
COPY tsconfig.json ./
COPY src ./src

FROM build-base AS build-backend

RUN pnpm tsc

FROM build-base as build-frontend
COPY webpack.config.cjs ./
COPY public ./public
RUN pnpm webpack

FROM gcr.io/distroless/nodejs24-debian13:nonroot

WORKDIR /app/sanime

COPY --from=base /app/sanime/node_modules ./node_modules
COPY --from=build-backend /app/sanime/dist ./dist
COPY --from=build-frontend /app/sanime/public ./public

EXPOSE 3000

CMD ["/app/sanime/dist/backend"]
