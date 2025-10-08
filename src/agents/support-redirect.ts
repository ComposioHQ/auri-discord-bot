import type { Client, Message } from "discord.js";
import { ChannelType } from "discord.js";
import { registerReactionSubscriptions } from "../lib/subscribe.ts";

const SUPPORT_THREAD_FOLLOW_UP = `beep boop, I've moved this conversation here so the support team can get back to you sooner.\n \nCould you please share your debugging info if you have not already? https://docs.composio.dev/docs/resources/debugging-info`;

export interface SupportRedirectAgentConfig {
  supportForumChannelId: string;
  supportTeamUserIds: string[];
}

export const startSupportRedirectAgent = (
  client: Client,
  config: SupportRedirectAgentConfig
) => {
  console.log("starting support redirect agent...");

  registerReactionSubscriptions(client, [
    {
      emoji: "tech_support",
      action: async ({ message, user, reaction, channel }) => {
        console.log("support redirect - triggered");

        if (!message.guild) {
          return;
        }

        if (!config.supportForumChannelId) {
          console.warn(
            "support forum channel id not configured. skipping support thread creation."
          );
          return;
        }

        if (reaction.count && reaction.count > 1) {
          return;
        }

        if (
          "isThread" in channel &&
          typeof channel.isThread === "function" &&
          channel.isThread()
        ) {
          return;
        }

        const cachedChannel = message.guild.channels.cache.get(
          config.supportForumChannelId
        );

        const forumChannel =
          cachedChannel ??
          (await message.guild.channels
            .fetch(config.supportForumChannelId)
            .catch((error) => {
              console.error("failed to fetch support forum channel:", error);
              return null;
            }));

        if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
          console.warn(
            `channel ${config.supportForumChannelId} is not a forum channel or could not be found.`
          );
          return;
        }

        const threadName = buildSupportThreadName(message);
        const initialPost = buildSupportInitialPost({
          message,
          sourceChannelMention: channel.toString(),
        });

        try {
          const allowedMentionUsers = uniqueUserMentions(
            message.author.id,
            user.id
          );

          const availableTags = forumChannel.availableTags || [];
          const appliedTags =
            availableTags.length > 0 && availableTags[0]
              ? [availableTags[0].id]
              : [];

          const supportThread = await forumChannel.threads.create({
            name: threadName,
            appliedTags,
            message: {
              content: initialPost,
              allowedMentions: {
                users: allowedMentionUsers,
              },
            },
          });

          // add support team members to thread
          for (const userId of config.supportTeamUserIds) {
            await supportThread.members.add(userId).catch((error) => {
              console.error(
                `failed to add user ${userId} to support thread:`,
                error
              );
            });
          }

          await channel.send({
            content: `${
              message.author
            }, i've moved this conversation to ${supportThread.toString()} so the support team can jump in.`,
            allowedMentions: { users: [message.author.id] },
          });

          console.log("support redirect - thread created:", supportThread.url);
        } catch (error) {
          console.error("failed to create support forum thread:", error);
          return;
        }
      },
    },
  ]);

  console.log("support redirect agent started");
};

const buildSupportThreadName = (message: Message): string => {
  const fallbackName = `${message.author.username}-support`;
  const sanitized = message.content
    .split(/\s+/)
    .slice(0, 6)
    .join(" ")
    .replace(/[^\w\s-]+/g, "")
    .trim();

  const base = sanitized.length > 0 ? sanitized : fallbackName;

  return base.slice(0, 90);
};

interface SupportInitialPostOptions {
  message: Message;
  sourceChannelMention: string;
}

const buildSupportInitialPost = ({
  message,
  sourceChannelMention,
}: SupportInitialPostOptions): string => {
  const originalContent =
    message.content.trim() || "_No message content provided._";
  const attachmentSection =
    message.attachments.size > 0
      ? "\n" +
        message.attachments.map((attachment) => attachment.url).join("\n")
      : "";

  const flaggedByLine = `support request from ${message.author} in ${sourceChannelMention}`;

  return [
    flaggedByLine,
    "```",
    originalContent + attachmentSection,
    "```",
    `original message link: ${message.url}`,
    "",
    "---",
    "",
    SUPPORT_THREAD_FOLLOW_UP,
  ].join("\n");
};

const uniqueUserMentions = (
  ...ids: Array<string | null | undefined>
): string[] => {
  const unique = new Set<string>();

  for (const id of ids) {
    if (typeof id !== "string") {
      continue;
    }

    const normalized = id.trim();

    if (normalized.length === 0) {
      continue;
    }

    unique.add(normalized);
  }

  return [...unique];
};

// run as standalone
if (import.meta.main) {
  const { runAgent } = await import("../lib/run-agent.ts");

  runAgent({
    name: "support redirect agent",
    onReady: (client) => {
      startSupportRedirectAgent(client, {
        supportForumChannelId:
          process.env.SUPPORT_FORUM_CHANNEL_ID ?? "1268871288156323901",
        supportTeamUserIds: ["1234551142533300315", "179264835618471936"],
      });
    },
  });
}
