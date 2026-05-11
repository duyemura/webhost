FROM node:22-alpine
WORKDIR /app

RUN npm install -g pnpm@9

# Copy package manifests first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/

# Auth for GitHub Packages registry
ARG NPM_GITHUB_TOKEN
RUN echo "//npm.pkg.github.com/:_authToken=${NPM_GITHUB_TOKEN}" > /root/.npmrc \
 && echo "@pushpress:registry=https://npm.pkg.github.com" >> /root/.npmrc \
 && pnpm install --frozen-lockfile -r

# Copy source and build
COPY . .
RUN pnpm build && pnpm build:web && cp -r src/templates dist/templates

EXPOSE 3000
CMD ["node", "dist/server.js"]
