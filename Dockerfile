FROM node:22-bookworm-slim

WORKDIR /app

# Copy essentials
COPY dist ./dist
COPY public ./public
COPY package.json ./

EXPOSE 3000

# Start app - Docker compose will handle MySQL startup ordering via depends_on
CMD ["node", "--no-warnings", "dist/server.cjs"]
