FROM node:alpine

WORKDIR /usr/app/src

ENV NODE_ENV=test

RUN npm i yarn@1.17.3 -g
RUN yarn config set cache-folder $HOME/.yarn-cache
COPY yarn.lock package.json ./
COPY packages/cli/package.json ./packages/cli
RUN yarn --frozen-lockfile --production=false

COPY . .
RUN yarn --frozen-lockfile --production=false

RUN yarn build-ts
RUN yarn check-style
RUN yarn check-lint
RUN yarn check-unit