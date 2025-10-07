import "dotenv/config";
import { createServer } from "http";
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type ClientOptions,
  type Message,
  type ThreadChannel,
  type User,
} from "discord.js";
import {
  registerMessageSubscriptions,
  registerReactionSubscriptions,
} from "./lib/subscribe.ts";

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error(
    "Missing DISCORD_BOT_TOKEN environment variable. Add it to your .env file."
  );
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

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Discord bot ready! Logged in as ${readyClient.user.tag}`);
});

const SUPPORT_FORUM_CHANNEL_ID =
  process.env.SUPPORT_FORUM_CHANNEL_ID ?? "1268871288156323901";

const SUPPORT_THREAD_FOLLOW_UP = `beep boop, I've moved this conversation here so the support team can get back to you sooner.\n \nCould you please share your debugging info if you have not already? https://docs.composio.dev/resources/debugging-info`;

registerReactionSubscriptions(client, [
  {
    emoji: "⭐",
    action: async ({ message, user, reaction, channel }) => {
      if (!message.guild) {
        return;
      }

      if (reaction.count && reaction.count > 1) {
        return;
      }

      await channel.send({
        content: `⭐ ${user.toString()} starred a message from ${
          message.author
        }: ${message.url}`,
        allowedMentions: { users: [user.id] },
      });
    },
  },
  {
    emoji: "tech_support",
    action: async ({ message, user, reaction, channel }) => {
      if (!message.guild) {
        return;
      }

      if (!SUPPORT_FORUM_CHANNEL_ID) {
        console.warn(
          "SUPPORT_FORUM_CHANNEL_ID is not configured. Skipping support thread creation."
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
        SUPPORT_FORUM_CHANNEL_ID
      );

      const forumChannel =
        cachedChannel ??
        (await message.guild.channels
          .fetch(SUPPORT_FORUM_CHANNEL_ID)
          .catch((error) => {
            console.error("Failed to fetch support forum channel:", error);
            return null;
          }));

      if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
        console.warn(
          `Channel ${SUPPORT_FORUM_CHANNEL_ID} is not a forum channel or could not be found.`
        );
        return;
      }

      const threadName = buildSupportThreadName(message);
      const initialPost = buildSupportInitialPost({
        message,
        sourceChannelMention: channel.toString(),
      });

      let supportThread: ThreadChannel;

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

        supportThread = await forumChannel.threads.create({
          name: threadName,
          appliedTags,
          message: {
            content: initialPost,
            allowedMentions: {
              users: allowedMentionUsers,
            },
          },
        });
      } catch (error) {
        console.error("Failed to create support forum thread:", error);
        return;
      }

      await supportThread.members.add("1234551142533300315").catch((error) => {
        console.error("Failed to add user to support thread:", error);
      });

      await supportThread.members.add("179264835618471936").catch((error) => {
        console.error("Failed to add user to support thread:", error);
      });

      await channel.send({
        content: `${
          message.author
        }, I've moved this conversation to ${supportThread.toString()} so the support team can jump in.`,
        allowedMentions: { users: [message.author.id] },
      });
    },
  },
]);

registerMessageSubscriptions(client, [
  {
    id: "ping-pong-reply",
    filter: (message) =>
      message.inGuild() &&
      message.author.id !== message.client.user?.id &&
      message.content.trim().toLowerCase() === "!ping",
    action: async ({ message }) => {
      await message.reply({
        content: "Pong! 🏓",
        allowedMentions: { repliedUser: false },
      });
    },
  },
]);

client.login(token).catch((error) => {
  console.error("Failed to connect the Discord bot client:", error);
  process.exitCode = 1;
});

process.on("SIGINT", () => {
  if (client.isReady()) {
    console.log("Shutting down Discord bot (SIGINT)");
  }
  server.close();
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (client.isReady()) {
    console.log("Shutting down Discord bot (SIGTERM)");
  }
  server.close();
  client.destroy();
  process.exit(0);
});

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
    `Original message link: ${message.url}`,
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
