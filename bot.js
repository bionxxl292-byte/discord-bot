require("dotenv").config();
const { Client, GatewayIntentBits, Events, ActivityType } = require("discord.js");
const { Pool } = require("pg");

const token = process.env.DISCORD_BOT_TOKEN?.trim();
if (!token) { console.error("Token yok!"); process.exit(1); }

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot çevrimiçi: ${c.user.tag}`);
  c.user.setActivity("Komutları dinliyorum...", { type: ActivityType.Watching });
  try {
    const res = await pool.query("SELECT id FROM bots LIMIT 1");
    if (res.rows.length > 0) {
      await pool.query("UPDATE bots SET status=$1, guild_count=$2, updated_at=NOW() WHERE id=$3", ["online", c.guilds.cache.size, res.rows[0].id]);
      await pool.query("INSERT INTO bot_logs (bot_id, level, message) VALUES ($1,$2,$3)", [res.rows[0].id, "info", `Bot "${c.user.tag}" çevrimiçi. ${c.guilds.cache.size} sunucu.`]);
    }
  } catch(e) { console.error("DB hatası:", e.message); }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith("!")) return;
  const args = message.content.slice(1).trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();
  if (!cmd) return;
  try {
    const res = await pool.query("SELECT * FROM bot_commands WHERE enabled=true");
    const commands = res.rows;
    if (cmd === "yardim" || cmd === "help") {
      const list = commands.map(c => `\`!${c.name}\` — ${c.description}`).join("\n");
      await message.reply(`**Komutlar:**\n${list || "Henüz komut yok."}`);
      return;
    }
    const found = commands.find(c => c.name === cmd);
    if (found) {
      const response = found.response.replace("{kullanici}", message.author.username).replace("{isim}", args.join(" ") || "bilinmiyor");
      await message.reply(response);
      await pool.query("UPDATE bot_commands SET usage_count=usage_count+1 WHERE id=$1", [found.id]);
    }
  } catch(e) { console.error("Komut hatası:", e.message); }
});

client.login(token).catch(e => { console.error("Giriş hatası:", e.message); process.exit(1); });
