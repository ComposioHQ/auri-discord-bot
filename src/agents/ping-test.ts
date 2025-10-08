import type { Client } from "discord.js";
import { registerMessageSubscriptions } from "../lib/subscribe.ts";

export const startPingTestAgent = (client: Client) => {
  console.log("starting ping test agent...");

  registerMessageSubscriptions(client, [
    {
      id: "ping-test",
      filter: (message) =>
        message.inGuild() &&
        message.author.id !== message.client.user?.id &&
        message.content.trim().toLowerCase() === "!ping",
      action: async ({ message, user, channel }) => {
        console.log("ping test - user info:", {
          id: user.id,
          username: user.username,
          tag: user.tag,
        });
        console.log("ping test - channel info:", {
          id: channel.id,
          name: "name" in channel ? channel.name : "DM",
          type: channel.type,
        });
        console.log("ping test - message info:", {
          id: message.id,
          content: message.content,
          url: message.url,
        });

        await message.reply({
          content: "pong! 🏓",
          allowedMentions: { repliedUser: false },
        });
      },
    },
  ]);

  console.log("ping test agent started");
};

// run as standalone
if (import.meta.main) {
  const { runAgent } = await import("../lib/run-agent.ts");

  runAgent({
    name: "ping test agent",
    onReady: (client) => {
      startPingTestAgent(client);
    },
  });
}
