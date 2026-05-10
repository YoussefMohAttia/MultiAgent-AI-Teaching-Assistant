FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
ENV NODE_ENV=development
RUN npm install --production=false && test -f node_modules/.bin/vite

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Copy to a staging location, not /etc/nginx/templates/
# (avoids nginx auto-envsubst which replaces ALL variables)
COPY nginx.conf.template /etc/nginx/nginx.conf.template

EXPOSE 80

# Manually substitute only ${BACKEND_URL}, leaving nginx variables untouched
CMD ["/bin/sh", "-c", "export BACKEND_URL=\"${BACKEND_URL:-http://host.docker.internal:8000}\"; envsubst '${BACKEND_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf; nginx -g 'daemon off;'"]