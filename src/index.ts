import { createServer } from "http";
import { runAgent } from "./lib/run-agent.ts";
import { startAgents } from "./agents/index.ts";

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("discord bot running");
});

const PORT = 5432;
server.listen(PORT, () => {
  console.log(`http server listening on port ${PORT}`);
});

runAgent({
  name: "discord bot (all agents)",
  requiredEnvVars: ["COMPOSIO_APIKEY", "OPENROUTER_API_KEY"],
  onReady: async (client) => {
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
  },
  onShutdown: () => {
    server.close();
  },
});
