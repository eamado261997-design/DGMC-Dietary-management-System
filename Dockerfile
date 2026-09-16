FROM node:22-bookworm-slim

WORKDIR /app

# 1. Install required build tools for native modules (bcrypt, better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# 2. Copy dependency definitions
COPY package.json package-lock.json* ./

# 3. Install production dependencies (build tools allow this to succeed quickly)
RUN npm install --omit=dev --no-audit

# 4. Copy built application (assuming you ran `npm run build` locally)
COPY dist ./dist
COPY public ./public

EXPOSE 3000
EXPOSE 3001

# Start the built server
CMD ["npm", "run", "start"]
