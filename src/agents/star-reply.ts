import type { Client } from "discord.js";
import { registerReactionSubscriptions } from "../lib/subscribe.ts";
import { generateText, stepCountIs } from "ai";
import {
  createDiscordToolRouterSession,
  summarizeTools,
} from "../lib/composio-tool-router.ts";
import { getAuriModel, getAuriModelId } from "../lib/llm.ts";

export interface StarReplyAgentConfig {
  composioApiKey: string;
  composioAuthConfigId: string;
  userEmail: string;
}

export const startStarReplyAgent = async (
  client: Client,
  config: StarReplyAgentConfig
) => {
  const modelId = getAuriModelId();
  console.log("starting star reply agent...", { model: modelId });

  const session = await createDiscordToolRouterSession(config);

  console.log("tool router session:", {
    sessionId: session.sessionId,
    mcpType: session.mcp.type,
  });

  const tools = await session.tools();
  console.log("star reply - tool summary:", summarizeTools(tools));

  registerReactionSubscriptions(client, [
    {
      emoji: "⭐",
      action: async ({ message, user, reaction, channel, emojiKey }) => {
        if (!message.guild) {
          return;
        }

        console.log("star reply - reaction triggered");
        console.log("star reply - emoji key:", emojiKey);
        console.log("star reply - reaction emoji name:", reaction.emoji.name);
        console.log("star reply - reaction emoji id:", reaction.emoji.id);

        const result = await generateText({
          model: getAuriModel(),
          prompt: `reply to user on discord (discordbot) with a funny message. context: ${
            message.content
          }, user: ${user.toString()}, reaction: ${
            reaction.emoji.name
          }, channel: ${channel.toString()}`,
          tools,
          stopWhen: stepCountIs(25),
        });

        console.log("star reply - generated text:", result.text);
      },
    },
  ]);

  console.log("star reply agent started");
};

// run as standalone
if (import.meta.main) {
  const { runAgent } = await import("../lib/run-agent.ts");

  runAgent({
    name: "star reply agent",
    requiredEnvVars: ["COMPOSIO_APIKEY", "OPENROUTER_API_KEY"],
    onReady: async (client) => {
      await startStarReplyAgent(client, {
        composioApiKey: process.env.COMPOSIO_APIKEY!,
        composioAuthConfigId: "ac_yAxogT931v4z",
        userEmail: "hey@cryo.wtf",
      });
    },
  });
}
