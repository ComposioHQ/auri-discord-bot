import type { Client } from "discord.js";
import { registerMessageSubscriptions } from "../lib/subscribe.ts";
import { Agent, run, hostedMcpTool } from "@openai/agents";
import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";

export interface ModerationOpenAIAgentConfig {
  supportForumChannelId: string;
  introduceYourselfChannelId: string;
  composioApiKey: string;
  composioAuthConfigId: string;
  userEmail: string;
}

export const startModerationOpenAIAgent = async (
  client: Client,
  config: ModerationOpenAIAgentConfig
) => {
  console.log("starting moderation openai agent...");

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

  const mcpTool = hostedMcpTool({
    serverLabel: "composio-discordbot",
    serverUrl: session.url,
  });

  const agent = new Agent({
    name: "discord moderation agent",
    instructions: `you are a discord bot that helps moderate the discord #general channel, you also operate in the background so must take actions on your own in a self direction way without being asked or prompted by user.

here are some things you should do:
1. if someone joins, say hi (empty message likely means they joined, you can check their chat history if you are unsure)
2. if someone asks a support query, point them to <#${config.supportForumChannelId}>
3. if someone wants to introduce themselves or talk about resume point them to <#${config.introduceYourselfChannelId}>. delete their message on the general channel, @ them in the introduce-yourself channel and tell them to post there
4. if someone outright spams or tries to @ everyone or posts some crypto stuff, delete all their messages and time them out

when talking to users be very friendly, conversational, quirky, all lowercase. be very much a robot. avoid emojis`,
    model: "gpt-4o",
    tools: [mcpTool],
  });

  registerMessageSubscriptions(client, [
    {
      id: "moderation-openai-general",
      filter: (message) => {
        console.log("moderation openai - checking message:", {
          id: message.id,
          channel: message.channel,
          content: message.content,
          url: message.url,
        });
        return (
          message.inGuild() &&
          message.author.id !== message.client.user?.id &&
          message.channel.name.includes("general")
        );
      },
      action: async ({ message, user, channel }) => {
        console.log("moderation openai - user info:", {
          id: user.id,
          username: user.username,
          tag: user.tag,
        });
        console.log("moderation openai - channel info:", {
          id: channel.id,
          name: "name" in channel ? channel.name : "DM",
          type: channel.type,
        });

        // extract images from message attachments
        const imageAttachments = Array.from(
          message.attachments.values()
        ).filter((attachment) => {
          const ext = attachment.url.split(".").pop()?.toLowerCase();
          return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
        });

        // build prompt with image information
        let prompt = `message: ${message.content}
user: ${user.toString()}
channel: ${channel.toString()}`;

        if (imageAttachments.length > 0) {
          prompt += `\n\nimages attached: ${imageAttachments
            .map((a) => a.url)
            .join(", ")}`;
        }

        const result = await run(agent, prompt);

        console.log("moderation openai - final output:", result.finalOutput);
      },
    },
  ]);

  console.log("moderation openai agent started");
};

// run as standalone
if (import.meta.main) {
  const { runAgent } = await import("../lib/run-agent.ts");

  runAgent({
    name: "moderation openai agent",
    requiredEnvVars: ["COMPOSIO_APIKEY", "OPENAI_API_KEY"],
    onReady: async (client) => {
      await startModerationOpenAIAgent(client, {
        supportForumChannelId:
          process.env.SUPPORT_FORUM_CHANNEL_ID ?? "1268871288156323901",
        introduceYourselfChannelId: "1244566743284715584",
        composioApiKey: process.env.COMPOSIO_APIKEY!,
        composioAuthConfigId: "ac_yAxogT931v4z",
        userEmail: "hey@cryo.wtf",
      });
    },
  });
}
