import "dotenv/config";
import { createServer } from "http";
import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type ClientOptions,
} from "discord.js";
import { startAgents } from "./agents/index.ts";

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error(
    "Missing DISCORD_BOT_TOKEN environment variable. Add it to your .env file."
  );
}

if (!process.env.COMPOSIO_APIKEY) {
  throw new Error("Missing COMPOSIO_APIKEY environment variable.");
}

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error("Missing OPENROUTER_API_KEY environment variable.");
}

const clientOptions: ClientOptions = {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
};

const client = new Client(clientOptions);

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("discord bot running");
});

const PORT = 5432;
server.listen(PORT, () => {
  console.log(`http server listening on port ${PORT}`);
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`discord bot ready! logged in as ${readyClient.user.tag}`);

  // start all agents
  await startAgents(client, {
    supportForumChannelId:
      process.env.SUPPORT_FORUM_CHANNEL_ID ?? "1268871288156323901",
    introduceYourselfChannelId: "1244566743284715584",
    composioApiKey: process.env.COMPOSIO_APIKEY!,
    composioAuthConfigId: "ac_yAxogT931v4z",
    userEmail: "hey@cryo.wtf",
    supportTeamUserIds: ["1234551142533300315", "179264835618471936"],
  });

  console.log("all agents initialized");
});

client.login(token).catch((error) => {
  console.error("failed to connect the discord bot client:", error);
  process.exitCode = 1;
});

process.on("SIGINT", () => {
  if (client.isReady()) {
    console.log("shutting down discord bot (SIGINT)");
  }
  server.close();
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (client.isReady()) {
    console.log("shutting down discord bot (SIGTERM)");
  }
  server.close();
  client.destroy();
  process.exit(0);
});
