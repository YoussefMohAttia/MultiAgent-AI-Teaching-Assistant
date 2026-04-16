FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
ENV NODE_ENV=development
RUN npm install --production=false && test -f node_modules/.bin/vite

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
