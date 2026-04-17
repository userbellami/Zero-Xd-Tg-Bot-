const { Telegraf } = require('telegraf');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');

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
    // Use which yt-dlp to get full path, fallback to 'yt-dlp'
    let ytDlpCmd = 'yt-dlp';
    try {
      const { stdout: whichOut } = await execPromise('which yt-dlp', { timeout: 5000 });
      if (whichOut.trim()) ytDlpCmd = whichOut.trim();
    } catch(e) { /* use default */ }

    const searchCmd = `${ytDlpCmd} "ytsearch1:${query.replace(/"/g, '\\"')}" --get-id`;
    const { stdout: idOut } = await execPromise(searchCmd, { timeout: 20000 });
    const videoId = idOut.trim();
    if (!videoId) throw new Error('No results');

    const titleCmd = `${ytDlpCmd} "https://youtube.com/watch?v=${videoId}" --get-title`;
    const { stdout: titleOut } = await execPromise(titleCmd, { timeout: 10000 });
    const title = titleOut.trim();

    const url = `https://youtube.com/watch?v=${videoId}`;
    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `⬇️ *${title.substring(0, 50)}*`, { parse_mode: 'Markdown' });

    const safeTitle = title.replace(/[^\w\s]/gi, '').substring(0, 50);
    const outputBase = path.join(DOWNLOAD_DIR, `${Date.now()}_${safeTitle}`);
    let outputFile, cmd;

    if (type === 'song') {
      outputFile = `${outputBase}.mp3`;
      cmd = `${ytDlpCmd} -f bestaudio --extract-audio --audio-format mp3 --audio-quality 128k -o "${outputFile}" "${url}"`;
    } else {
      outputFile = `${outputBase}.webm`;
      cmd = `${ytDlpCmd} -f "bestvideo[height<=480][ext=webm]+bestaudio[ext=webm]/best[height<=480][ext=webm]" -o "${outputFile}" "${url}"`;
    }

    await execPromise(cmd, { timeout: 90000 });
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
