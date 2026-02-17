FROM node:20-alpine

WORKDIR /app

# Install dependencies for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3847

# Start development server
CMD ["npm", "run", "dev"]
