FROM node:18-alpine as base

ENV NODE_ENV production

WORKDIR /app/sanime

COPY .yarn .yarn
COPY .yarnrc.yml package.json yarn.lock ./
RUN yarn install --immutable
COPY tsconfig.json ./
COPY src ./src

FROM base as builder-backend

RUN yarn tsc

FROM base as builder-frontend

COPY webpack.config.cjs ./
COPY public ./public
RUN yarn webpack

FROM base

RUN apk --no-cache add tini

ENTRYPOINT ["/sbin/tini", "--"]

COPY --from=builder-backend /app/sanime/dist ./dist
COPY --from=builder-frontend /app/sanime/public ./public

EXPOSE 3000

CMD ["yarn", "node", "/app/sanime/dist/backend"]
