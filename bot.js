const { Telegraf } = require('telegraf');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const tough = require('tough-cookie');

const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const OWNER_NAME = 'LORD MONK 💧';
const START_IMAGE = 'xero.jpg';
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

const bot = new Telegraf(BOT_TOKEN, { telegram: { timeout: 120 } });

// Cookie management
let cookieJar = new tough.CookieJar();

async function getYoutubeCookie() {
    try {
        const cookieFile = path.join(__dirname, 'cookies.json');
        if (fs.existsSync(cookieFile)) {
            const cookieData = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
            cookieJar = tough.CookieJar.deserializeSync(cookieData, new tough.CookieJar());
        }
        const cookieString = await cookieJar.getCookieString('https://www.youtube.com');
        return cookieString;
    } catch (error) {
        return '';
    }
}

async function saveCookieJar() {
    try {
        const cookieData = cookieJar.serializeSync();
        fs.writeFileSync(path.join(__dirname, 'cookies.json'), JSON.stringify(cookieData, null, 2));
    } catch (error) {}
}

async function updateCookiesFromBrowser() {
    try {
        const response = await axios.get('https://www.youtube.com', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const setCookieHeaders = response.headers['set-cookie'];
        if (setCookieHeaders) {
            for (const header of setCookieHeaders) {
                cookieJar.setCookieSync(header, 'https://www.youtube.com');
            }
            await saveCookieJar();
            return true;
        }
    } catch (error) {}
    return false;
}

async function ensureValidCookies() {
    let cookieString = await getYoutubeCookie();
    if (!cookieString || cookieString.length < 10) {
        await updateCookiesFromBrowser();
        cookieString = await getYoutubeCookie();
    }
    return cookieString;
}

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
    const cookieString = await ensureValidCookies();
    const searchResults = await ytSearch(query);
    if (!searchResults.videos.length) throw new Error('No results');
    const video = searchResults.videos[0];
    const title = video.title;
    const url = video.url;

    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `⬇️ *${title.substring(0, 50)}*`, { parse_mode: 'Markdown' });

    const safeTitle = title.replace(/[^\w\s]/gi, '').substring(0, 50);
    const outputBase = path.join(DOWNLOAD_DIR, `${Date.now()}_${safeTitle}`);
    let outputFile, stream, ffmpegArgs;

    const requestOptions = {
        requestOptions: {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Cookie: cookieString
            }
        }
    };

    if (type === 'song') {
      outputFile = `${outputBase}.mp3`;
      stream = ytdl(url, { ...requestOptions, quality: 'highestaudio' });
      ffmpegArgs = ['-i', 'pipe:0', '-acodec', 'libmp3lame', '-ab', '128k', '-f', 'mp3', '-y', outputFile];
    } else {
      outputFile = `${outputBase}.webm`;
      stream = ytdl(url, { ...requestOptions, quality: 'highestvideo' });
      ffmpegArgs = ['-i', 'pipe:0', '-c:v', 'libvpx', '-c:a', 'libopus', '-b:v', '1M', '-b:a', '128k', '-f', 'webm', '-y', outputFile];
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

// Handle 409 conflict by dropping pending updates
bot.launch({ dropPendingUpdates: true }).then(() => {
  console.log('✅ Xero Xd Bot is live!');
}).catch((err) => {
  console.error('Failed to launch bot:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
