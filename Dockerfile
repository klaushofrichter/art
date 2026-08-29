FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
WORKDIR /app
# Stamped by the deploy so the running container can report which build it is.
# Defaults to "dev" for local builds, which is what you want to see locally.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# The client stylesheet, script and favicon. The pictures are deliberately not
# here: content lives on a volume (ASSETS_DIR), so it is neither in this image
# nor in the public repo, and a content change is a sync rather than a deploy.
COPY public ./public
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
