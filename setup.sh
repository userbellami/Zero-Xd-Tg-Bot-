#!/bin/bash
set -e
echo "📦 Installing Node.js & ffmpeg..."
pkg update -y && pkg upgrade -y
pkg install nodejs-lts ffmpeg git -y

echo "📁 Creating bot files..."
cat > package.json << 'PKG'
{
  "name": "xero-xd-bot",
  "version": "1.0.0",
  "main": "bot.js",
  "scripts": { "start": "node bot.js" },
  "dependencies": {
    "telegraf": "^4.15.3",
    "ytdl-core": "^4.11.5",
    "yt-search": "^2.10.4",
    "fluent-ffmpeg": "^2.1.2",
    "ffmpeg-static": "^5.2.0"
  }
}
PKG

cat > bot.js << 'BOT'
const { Telegraf } = require('telegraf');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const OWNER_NAME = 'Xero Xd';
const START_IMAGE = 'xero.jpg';
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

const bot = new Telegraf(BOT_TOKEN);

async function sendStartImage(ctx, caption) {
  if (fs.existsSync(START_IMAGE)) {
    await ctx.replyWithPhoto({ source: START_IMAGE }, { caption, parse_mode: 'Markdown' });
  } else {
    await ctx.reply(caption, { parse_mode: 'Markdown' });
  }
}

async function downloadAndSend(ctx, query, type) {
  const search = await ytSearch(query);
  if (!search.videos.length) throw new Error('No results found');
  const video = search.videos[0];
  const title = video.title.replace(/[^\w\s]/gi, '');
  const url = video.url;
  const outputBase = path.join(DOWNLOAD_DIR, `${Date.now()}_${title}`);
  let outputFile;

  await ctx.reply(`🎬 Found: *${video.title}*\n⏳ Processing...`, { parse_mode: 'Markdown' });

  if (type === 'song') {
    outputFile = `${outputBase}.mp3`;
    const stream = ytdl(url, { quality: 'highestaudio' });
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        '-i', 'pipe:0',
        '-acodec', 'libmp3lame',
        '-ab', '192k',
        '-f', 'mp3',
        '-y', outputFile
      ]);
      stream.pipe(ffmpeg.stdin);
      ffmpeg.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg error ${code}`)));
      ffmpeg.on('error', reject);
      stream.on('error', reject);
    });
  } else {
    outputFile = `${outputBase}.webm`;
    const stream = ytdl(url, { quality: 'highestvideo' });
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        '-i', 'pipe:0',
        '-c:v', 'libvpx',
        '-c:a', 'libopus',
        '-b:v', '1M',
        '-b:a', '128k',
        '-f', 'webm',
        '-y', outputFile
      ]);
      stream.pipe(ffmpeg.stdin);
      ffmpeg.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg error ${code}`)));
      ffmpeg.on('error', reject);
      stream.on('error', reject);
    });
  }

  if (fs.existsSync(outputFile)) {
    const fileSize = fs.statSync(outputFile).size;
    if (fileSize > 50 * 1024 * 1024) {
      await ctx.replyWithDocument({ source: outputFile }, { caption: `⚠️ File >50MB, sent as document\n${title}` });
    } else if (type === 'song') {
      await ctx.replyWithAudio({ source: outputFile }, { title: video.title, performer: 'Xero Xd Bot' });
    } else {
      await ctx.replyWithVideo({ source: outputFile }, { caption: `🎥 ${video.title}` });
    }
    fs.unlinkSync(outputFile);
  } else {
    throw new Error('Output file not created');
  }
}

bot.start(async (ctx) => {
  const caption = `
✨ *Welcome to Xero Xd Bot* ✨

👑 **Owner:** ${OWNER_NAME}

🎯 *Commands:*
• \`/song <song name>\` – Download MP3
• \`/video <video name>\` – Download WebM video
• \`/help\` – Show this message

💡 Example: \`/song Blinding Lights\`
⚡ *Fast | Free | No ads*
  `;
  await sendStartImage(ctx, caption);
});

bot.help((ctx) => ctx.start());

bot.command('song', async (ctx) => {
  const query = ctx.message.text.split(' ').slice(1).join(' ');
  if (!query) return ctx.reply('🎵 Please provide a song name.\nExample: `/song Shape of You`', { parse_mode: 'Markdown' });
  try {
    await downloadAndSend(ctx, query, 'song');
  } catch (err) {
    console.error(err);
    ctx.reply(`❌ Error: ${err.message}`);
  }
});

bot.command('video', async (ctx) => {
  const query = ctx.message.text.split(' ').slice(1).join(' ');
  if (!query) return ctx.reply('🎥 Please provide a video name.\nExample: `/video Funny Cats`', { parse_mode: 'Markdown' });
  try {
    await downloadAndSend(ctx, query, 'video');
  } catch (err) {
    console.error(err);
    ctx.reply(`❌ Error: ${err.message}`);
  }
});

bot.launch().then(() => console.log('🤖 Xero Xd Bot is running...'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
BOT

cat > Dockerfile << 'DOCK'
FROM node:18-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY bot.js .
COPY xero.jpg .
CMD ["node", "bot.js"]
DOCK

cat > render.yaml << 'REND'
services:
  - type: web
    name: xero-xd-bot
    runtime: image
    repo: https://github.com/yourusername/your-repo-name
    plan: free
    dockerfilePath: ./Dockerfile
    envVars:
      - key: BOT_TOKEN
        sync: false
REND

echo "node_modules/" > .gitignore
echo "downloads/" >> .gitignore
echo "xero.jpg" >> .gitignore

npm install

echo ""
echo "✅✅✅ XERO XD BOT SETUP COMPLETE ✅✅✅"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📌 NEXT STEPS:"
echo "1. Edit bot.js and replace YOUR_BOT_TOKEN_HERE with your bot token from @BotFather"
echo "   (use: nano bot.js)"
echo ""
echo "2. Place your startup image as 'xero.jpg' in: $(pwd)"
echo ""
echo "3. Test locally: npm start"
echo ""
echo "4. Push to GitHub and deploy on Render"
echo "   - Add BOT_TOKEN environment variable"
echo "   - Render will use Dockerfile → zero errors"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
