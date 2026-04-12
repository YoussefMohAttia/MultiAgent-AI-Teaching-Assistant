# Stage 1: Build the React app
FROM node:lts as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Stage 2: Create the production image

EXPOSE 80
