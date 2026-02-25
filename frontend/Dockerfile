# ============================================================
# Sapa-Tazkia Frontend — Multi-Stage Dockerfile
# Stage 1: Build React app
# Stage 2: Serve with Nginx (minimal)
# ============================================================

# ------- Stage 1: Build -------
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files for layer caching
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .

# Build args for environment (injected at build time)
ARG REACT_APP_API_URL
ARG REACT_APP_AI_PROVIDER
ARG REACT_APP_AI_MODEL
ARG REACT_APP_APP_VERSION

ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_AI_PROVIDER=$REACT_APP_AI_PROVIDER
ENV REACT_APP_AI_MODEL=$REACT_APP_AI_MODEL
ENV REACT_APP_APP_VERSION=$REACT_APP_APP_VERSION

RUN npm run build

# ------- Stage 2: Nginx -------
FROM nginx:alpine AS runner

# Copy built files
COPY --from=builder /app/build /usr/share/nginx/html

# Nginx config for SPA routing
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check endpoint for container
    location /nginx-health {
        access_log off;
        return 200 "OK";
    }
}
EOF

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/nginx-health || exit 1

CMD ["nginx", "-g", "daemon off;"]
