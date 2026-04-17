FROM node:18-slim

# Install Python, pip, ffmpeg, and yt-dlp
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --upgrade yt-dlp

# Ensure yt-dlp is in PATH
ENV PATH="/usr/local/bin:${PATH}"

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY bot.js .
COPY xero.jpg .

CMD ["node", "bot.js"]
