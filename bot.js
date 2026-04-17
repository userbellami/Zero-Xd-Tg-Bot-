const { Telegraf } = require('telegraf');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const OWNER_NAME = 'LORD MONK 💧';
const START_IMAGE = 'xero.jpg';
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

const bot = new Telegraf(BOT_TOKEN, { telegram: { timeout: 120 } });

async function sendStartImage(ctx, caption) {
  if (fs.existsSync(START_IMAGE)) {
    await ctx.replyWithPhoto({ source: START_IMAGE }, { caption, parse_mode: 'Markdown' });
  } else {
    await ctx.reply(caption, { parse_mode: 'Markdown' });
  }
}

async function downloadAndSend(ctx, query, type) {
  const statusMsg = await ctx.reply(`🔍 *${query}* ...`, { parse_mode: 'Markdown' });
  try {
    const searchResults = await ytSearch(query);
    if (!searchResults.videos.length) throw new Error('No results');
    const video = searchResults.videos[0];
    const title = video.title;
    const url = video.url;

    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `⬇️ *${title.substring(0, 50)}*`, { parse_mode: 'Markdown' });

    const safeTitle = title.replace(/[^\w\s]/gi, '').substring(0, 50);
    const outputBase = path.join(DOWNLOAD_DIR, `${Date.now()}_${safeTitle}`);
    let outputFile, stream, ffmpegArgs;

    if (type === 'song') {
      outputFile = `${outputBase}.mp3`;
      stream = ytdl(url, { quality: 'highestaudio' });
      ffmpegArgs = [
        '-i', 'pipe:0',
        '-acodec', 'libmp3lame',
        '-ab', '128k',
        '-f', 'mp3',
        '-y', outputFile
      ];
    } else {
      outputFile = `${outputBase}.webm`;
      stream = ytdl(url, { quality: 'highestvideo' });
      ffmpegArgs = [
        '-i', 'pipe:0',
        '-c:v', 'libvpx',
        '-c:a', 'libopus',
        '-b:v', '1M',
        '-b:a', '128k',
        '-f', 'webm',
        '-y', outputFile
      ];
    }

    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      stream.pipe(ffmpeg.stdin);
      ffmpeg.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg error ${code}`)));
      ffmpeg.on('error', reject);
      stream.on('error', reject);
    });

    if (!fs.existsSync(outputFile)) throw new Error('File missing');

    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `📤 *Uploading...*`, { parse_mode: 'Markdown' });
    const fileSize = fs.statSync(outputFile).size;
    if (fileSize > 50 * 1024 * 1024) {
      await ctx.replyWithDocument({ source: outputFile }, { caption: `📁 ${title}` });
    } else if (type === 'song') {
      await ctx.replyWithAudio({ source: outputFile }, { title, performer: 'Xero Xd' });
    } else {
      await ctx.replyWithVideo({ source: outputFile }, { caption: `🎬 ${title}` });
    }
    fs.unlinkSync(outputFile);
    await ctx.deleteMessage(statusMsg.message_id).catch(() => {});
  } catch (err) {
    console.error(err);
    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `❌ *Error:* ${err.message.substring(0, 100)}`, { parse_mode: 'Markdown' });
  }
}

bot.start(async (ctx) => {
  const caption = `
✨ *Xero Xd Bot* ✨
👑 **Owner:** ${OWNER_NAME}

⚡ *Commands:*
/song <name> → MP3
/video <name> → WebM (fast)
/help → this

💡 *Example:* \`/video cry allan walker\`
  `;
  await sendStartImage(ctx, caption);
});

bot.command('help', async (ctx) => {
  const caption = `
✨ *Xero Xd Bot* ✨
👑 **Owner:** ${OWNER_NAME}

⚡ *Commands:*
/song <name> → MP3
/video <name> → WebM (fast)
/help → this

💡 *Example:* \`/video cry allan walker\`
  `;
  await ctx.reply(caption, { parse_mode: 'Markdown' });
});

bot.command('song', async (ctx) => {
  const q = ctx.message.text.split(' ').slice(1).join(' ');
  if (!q) return ctx.reply('🎵 Example: `/song blinding lights`', { parse_mode: 'Markdown' });
  await downloadAndSend(ctx, q, 'song');
});
bot.command('video', async (ctx) => {
  const q = ctx.message.text.split(' ').slice(1).join(' ');
  if (!q) return ctx.reply('🎥 Example: `/video funny cats`', { parse_mode: 'Markdown' });
  await downloadAndSend(ctx, q, 'video');
});

bot.launch().then(() => console.log('✅ Xero Xd Bot is live!'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
