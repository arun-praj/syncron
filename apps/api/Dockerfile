FROM node:24.19.0-bookworm-slim
RUN npm install --global pnpm@11.19.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm typecheck && mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["pnpm", "start"]
