# Multi-stage Docker build for Playwright-compatible Node.js backend
FROM mcr.microsoft.com/playwright:v1.43.0-jammy AS base

# Install Node.js dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy code and build
COPY . .
RUN npx prisma generate
RUN npm run build

# Expose server port
EXPOSE 5000

# Set environment variables for headless playwright run
ENV HEADLESS=true
ENV PORT=5000

CMD ["npm", "start"]
