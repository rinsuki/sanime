FROM node:18-alpine as base

ENV NODE_ENV production

WORKDIR /app/sanime

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src

FROM base as builder-backend

RUN pnpm tsc

FROM base as builder-frontend

COPY webpack.config.cjs ./
COPY public ./public
RUN pnpm webpack

FROM base

RUN apk --no-cache add tini

ENTRYPOINT ["/sbin/tini", "--"]

COPY --from=builder-backend /app/sanime/dist ./dist
COPY --from=builder-frontend /app/sanime/public ./public

EXPOSE 3000

CMD ["node", "/app/sanime/dist/backend"]
