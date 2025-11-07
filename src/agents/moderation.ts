import type { Client } from "discord.js";
import { registerMessageSubscriptions } from "../lib/subscribe.ts";
import { experimental_createMCPClient, generateText, stepCountIs } from "ai";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";

const previewText = (text: string, maxLength = 160) => {
  if (!text) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
};

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.helicone.ai/api/v1",
  headers: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
    "Helicone-Cache-Enabled": "false",
  },
});

export interface ModerationAgentConfig {
  supportForumChannelId: string;
  introduceYourselfChannelId: string;
  composioApiKey: string;
  composioAuthConfigId: string;
  userEmail: string;
}

export const startModerationAgent = async (
  client: Client,
  config: ModerationAgentConfig
) => {
  console.log("starting moderation agent...");

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

  console.log("session id:", session.sessionId);

  const httpTransport = new StreamableHTTPClientTransport(new URL(session.url));

  const httpClient = await experimental_createMCPClient({
    transport: httpTransport,
  });

  registerMessageSubscriptions(client, [
    {
      id: "moderation-general",
      filter: (message) => {
        const channelName =
          "name" in message.channel && typeof message.channel.name === "string"
            ? message.channel.name
            : null;
        const normalizedChannelName = channelName
          ? channelName.toLowerCase()
          : "";
        const isMonitoredChannel =
          normalizedChannelName.includes("general") ||
          normalizedChannelName.includes("welcome");

        console.log("moderation - checking message:", {
          id: message.id,
          authorId: message.author.id,
          channelId: message.channel.id,
          channelName,
          channelType: message.channel.type,
          contentLength: message.content.length,
          contentPreview: previewText(message.content),
          url: message.url,
        });
        return (
          message.inGuild() &&
          message.author.id !== message.client.user?.id &&
          isMonitoredChannel
        );
      },
      action: async ({ message, user, channel }) => {
        console.log("moderation - user info:", {
          id: user.id,
          username: user.username,
          tag: user.tag,
        });
        console.log("moderation - channel info:", {
          id: channel.id,
          name: "name" in channel ? channel.name : "DM",
          type: channel.type,
        });

        console.log("moderation - fetching available tools from MCP...");
        const tools = await httpClient.tools();
        const toolNames =
          Array.isArray(tools) && tools.length > 0
            ? tools
                .map((tool) => {
                  if (tool && typeof tool === "object" && "name" in tool) {
                    return String((tool as { name?: string }).name);
                  }

                  if (
                    tool &&
                    typeof tool === "object" &&
                    "metadata" in tool &&
                    tool.metadata &&
                    typeof tool.metadata === "object" &&
                    "name" in tool.metadata
                  ) {
                    return String(
                      (tool as { metadata?: { name?: string } }).metadata?.name
                    );
                  }

                  return typeof tool === "string"
                    ? tool
                    : `[unnamed:${typeof tool}]`;
                })
                .slice(0, 10)
            : [];
        console.log("moderation - tool summary:", {
          count: Array.isArray(tools) ? tools.length : "unknown",
          names: toolNames,
        });

        // extract images from message attachments
        const imageAttachments = Array.from(
          message.attachments.values()
        ).filter((attachment) => {
          const ext = attachment.url.split(".").pop()?.toLowerCase();
          return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
        });

        console.log("moderation - image attachments detected:", {
          count: imageAttachments.length,
        });

        // build message content with images
        const messageContent: Array<
          { type: "text"; text: string } | { type: "image"; image: string }
        > = [
          {
            type: "text" as const,
            text: `message: ${message.content}
user: ${user.toString()}
channel: ${channel.toString()}`,
          },
        ];

        // add images to content
        imageAttachments.forEach((attachment) => {
          messageContent.push({
            type: "image" as const,
            image: attachment.url,
          });
        });

        console.log("moderation - invoking generateText with payload:", {
          messageId: message.id,
          contentBlocks: messageContent.length,
        });

        try {
          const result = await generateText({
            model: openrouter("anthropic/claude-haiku-4.5"),
            system: `you are a discord bot that helps moderate the discord #general channel, you also operate in the background so must take actions on your own in a self direction way without being asked or prompted by user.

here are some things you should do:
1. if someone joins, say hi (empty message likely means they joined, you can check their chat history if you are unsure)
2. if someone asks a support query, point them to <#${config.supportForumChannelId}>
3. if someone wants to introduce themselves or talk about resume point them to <#${config.introduceYourselfChannelId}>. delete their message on the general channel, @ them in the introduce-yourself channel and tell them to post there
4. if someone outright spams or tries to @ everyone or posts some crypto stuff, delete all their messages and time them out

when talking to users be very friendly, conversational, quirky, all lowercase. be very much a robot. avoid emojis`,
            messages: [
              {
                role: "user",
                content: messageContent,
              },
            ],
            tools: tools,
            onStepFinish: (step) => {
              console.log("moderation - step finished:", step.content);
            },
            stopWhen: stepCountIs(25),
          });

          console.log("moderation - generated text:", {
            text: result.text,
            finishReason: "finishReason" in result ? result.finishReason : null,
            usage: "usage" in result ? result.usage : null,
          });
        } catch (error) {
          console.error("moderation - generateText failed:", {
            messageId: message.id,
            error,
          });
        }
      },
    },
  ]);

  console.log("moderation agent started");
};

// run as standalone
if (import.meta.main) {
  const { runAgent } = await import("../lib/run-agent.ts");

  runAgent({
    name: "moderation agent",
    requiredEnvVars: ["COMPOSIO_APIKEY", "OPENROUTER_API_KEY"],
    onReady: async (client) => {
      await startModerationAgent(client, {
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
