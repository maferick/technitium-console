# --- build the SPA ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# --- serve with nginx, reverse-proxying /api to your Technitium server ---
FROM nginx:1.27-alpine
# The upstream is templated at container start from $TECHNITIUM_UPSTREAM.
COPY nginx.conf.template /etc/nginx/technitium-console.conf.template
COPY docker/40-set-upstream.sh /docker-entrypoint.d/40-set-upstream.sh
RUN chmod +x /docker-entrypoint.d/40-set-upstream.sh
COPY --from=build /app/dist /usr/share/nginx/html
# Point this at your Technitium DNS Server's web service (host:port).
ENV TECHNITIUM_UPSTREAM=technitium:5380
EXPOSE 80
