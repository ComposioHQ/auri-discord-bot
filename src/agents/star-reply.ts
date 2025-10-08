import type { Client } from "discord.js";
import { registerReactionSubscriptions } from "../lib/subscribe.ts";
import { experimental_createMCPClient, generateText, stepCountIs } from "ai";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export interface StarReplyAgentConfig {
  composioApiKey: string;
  composioAuthConfigId: string;
  userEmail: string;
}

export const startStarReplyAgent = async (
  client: Client,
  config: StarReplyAgentConfig
) => {
  console.log("starting star reply agent (example tool router)...");

  const composio = new Composio({
    apiKey: config.composioApiKey,
    provider: new VercelProvider(),
  });

  const session = await composio.experimental.toolRouter.createSession(
    config.userEmail,
    {
      toolkits: [
        { toolkit: "discordbot", authConfigId: config.composioAuthConfigId },
      ],
    }
  );

  const httpTransport = new StreamableHTTPClientTransport(
    new URL(session.url),
    {
      fetch: fetch,
    }
  );

  const httpClient = await experimental_createMCPClient({
    transport: httpTransport,
  });

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

        const tools = await httpClient.tools();

        console.log("star reply - tools:", tools);

        const result = await generateText({
          model: openrouter("anthropic/claude-4.5-sonnet"),
          prompt: `reply to user on discord (discordbot) with a funny message. context: ${
            message.content
          }, user: ${user.toString()}, reaction: ${
            reaction.emoji.name
          }, channel: ${channel.toString()}`,
          tools: tools,
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
