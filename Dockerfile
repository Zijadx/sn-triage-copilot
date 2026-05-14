FROM node:20-alpine

WORKDIR /app

# Copy root package.json and install concurrently
COPY package.json ./
RUN npm install

# Copy all modules
COPY rag/ ./rag/
COPY ai-chain/ ./ai-chain/
COPY observability/ ./observability/
COPY sn-client/ ./sn-client/
COPY api/ ./api/
COPY scripts/ ./scripts/

# Install API dependencies
RUN cd api && npm install

# Secrets injected at runtime via environment variables — never baked in
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "api/server.js"]
