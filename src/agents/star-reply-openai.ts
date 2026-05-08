import type { Client } from "discord.js";
import { registerReactionSubscriptions } from "../lib/subscribe.ts";
import { Agent, run, hostedMcpTool } from "@openai/agents";
import { createDiscordToolRouterSession } from "../lib/composio-tool-router.ts";
import { getOpenAIAgentModelId } from "../lib/llm.ts";

export interface StarReplyOpenAIAgentConfig {
  composioApiKey: string;
  composioAuthConfigId: string;
  userEmail: string;
}

export const startStarReplyOpenAIAgent = async (
  client: Client,
  config: StarReplyOpenAIAgentConfig
) => {
  const model = getOpenAIAgentModelId();
  console.log("starting star reply openai agent...", { model });

  const session = await createDiscordToolRouterSession(config);

  const mcpTool = hostedMcpTool({
    serverLabel: "composio-discordbot",
    serverUrl: session.mcp.url,
    headers: session.mcp.headers,
    requireApproval: "never",
  });

  const agent = new Agent({
    name: "discord reply agent",
    instructions:
      "you are a helpful discord bot that replies to messages with funny and engaging content. be concise and witty.",
    model,
    tools: [mcpTool],
  });

  registerReactionSubscriptions(client, [
    {
      emoji: "⭐",
      action: async ({ message, user, reaction, channel, emojiKey }) => {
        if (!message.guild) {
          return;
        }

        console.log("star reply openai - reaction triggered");
        console.log("star reply openai - emoji key:", emojiKey);
        console.log(
          "star reply openai - reaction emoji name:",
          reaction.emoji.name
        );
        console.log(
          "star reply openai - reaction emoji id:",
          reaction.emoji.id
        );

        const result = await run(
          agent,
          `reply to user on discord (discordbot) with a funny message. context: ${
            message.content
          }, user: ${user.toString()}, reaction: ${
            reaction.emoji.name
          }, channel: ${channel.toString()}`
        );

        console.log("star reply openai - final output:", result.finalOutput);
      },
    },
  ]);

  console.log("star reply openai agent started");
};

// run as standalone
if (import.meta.main) {
  const { runAgent } = await import("../lib/run-agent.ts");

  runAgent({
    name: "star reply openai agent",
    requiredEnvVars: ["COMPOSIO_APIKEY", "OPENAI_API_KEY"],
    onReady: async (client) => {
      await startStarReplyOpenAIAgent(client, {
        composioApiKey: process.env.COMPOSIO_APIKEY!,
        composioAuthConfigId: "ac_yAxogT931v4z",
        userEmail: "hey@cryo.wtf",
      });
    },
  });
}
