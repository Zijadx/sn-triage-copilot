FROM node:20-alpine

WORKDIR /app

# Copy and install root dependencies (shared modules like @anthropic-ai/sdk)
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

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "api/server.js"]