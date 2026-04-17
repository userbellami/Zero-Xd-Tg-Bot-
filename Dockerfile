FROM node:18-slim
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip && \
    pip3 install --upgrade yt-dlp && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY bot.js .
COPY xero.jpg .
CMD ["node", "bot.js"]
