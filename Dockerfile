FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    git  # මෙය එක් කරන්න

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 8000
CMD ["npm", "start"]
