FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund \
    && addgroup -S setu && adduser -S setu -G setu
COPY index.mjs kafka-worker.mjs domain-consumers.mjs replay-dlq.mjs metrics.mjs tracing.mjs ./
RUN chown -R setu:setu /app
USER setu
ENV NODE_ENV=production
EXPOSE 8787
CMD ["npm", "start"]
