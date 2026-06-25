# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies using package-lock.json if available
COPY package*.json ./
RUN npm ci

# Copy frontend source code and build it
COPY . .
RUN npm run build

# Runtime stage
FROM nginx:alpine

# Copy built files from build stage to nginx html folder
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
