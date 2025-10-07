import type {
  Client,
  Message,
  MessageReaction,
  PartialMessage,
  PartialMessageReaction,
  TextBasedChannel,
  User,
} from 'discord.js';

type ReactionIdentifier = string;
type MessageIdentifier = string;

type SendableChannel = Extract<
  TextBasedChannel,
  { send: (...args: any[]) => unknown }
>;

interface ReactionContext {
  client: Client;
  emojiKey: ReactionIdentifier;
  channel: SendableChannel;
  message: Message;
  reaction: MessageReaction;
  user: User;
}

interface MessageContext {
  client: Client;
  message: Message;
}

type ReactionAction = (context: ReactionContext) => Promise<void> | void;
type MessageAction = (context: MessageContext) => Promise<void> | void;

export interface ReactionSubscription {
  emoji: ReactionIdentifier;
  action: ReactionAction;
}

export interface MessageSubscription {
  id: MessageIdentifier;
  action: MessageAction;
  /**
   * Optional predicate to decide whether the action should fire. If omitted the
   * action runs for every incoming message.
   */
  filter?: (message: Message) => boolean;
}

const reactionActions = new Map<ReactionIdentifier, ReactionAction>();
const messageActions = new Map<MessageIdentifier, MessageSubscription>();
let reactionListenerRegistered = false;
let messageListenerRegistered = false;

const addReactionAction = (
  emoji: ReactionIdentifier,
  action: ReactionAction,
): void => {
  reactionActions.set(normalizeEmojiKey(emoji), action);
};

const removeReactionAction = (emoji: ReactionIdentifier): boolean => {
  return reactionActions.delete(normalizeEmojiKey(emoji));
};

const clearReactionActions = (): void => {
  reactionActions.clear();
};

const addMessageAction = (subscription: MessageSubscription): void => {
  messageActions.set(subscription.id, subscription);
};

const removeMessageAction = (id: MessageIdentifier): boolean => {
  return messageActions.delete(id);
};

const clearMessageActions = (): void => {
  messageActions.clear();
};

export interface ReactionActionRegistry {
  add: typeof addReactionAction;
  remove: typeof removeReactionAction;
  clear: typeof clearReactionActions;
}

export interface MessageActionRegistry {
  add: typeof addMessageAction;
  remove: typeof removeMessageAction;
  clear: typeof clearMessageActions;
}

/**
 * Sets up message reaction listeners for the provided Discord client and wires
 * them to the reaction action registry. Pass additional reaction subscriptions
 * to register corresponding emoji actions immediately.
 */
export const registerReactionSubscriptions = (
  client: Client,
  subscriptions: ReactionSubscription[] = [],
): ReactionActionRegistry => {
  subscriptions.forEach(({ emoji, action }) => addReactionAction(emoji, action));

  if (!reactionListenerRegistered) {
    client.on('messageReactionAdd', async (rawReaction, rawUser) => {
      if (rawUser.bot) {
        return;
      }

      try {
        const reaction = await hydrateReaction(rawReaction);
        const user = rawUser.partial ? await rawUser.fetch() : rawUser;
        const message = await hydrateMessage(reaction.message);
        const emojiKey = reaction.emoji.id ?? reaction.emoji.name;

        if (!emojiKey) {
          return;
        }

        const candidateKeys: ReactionIdentifier[] = [];
        const pushCandidate = (value?: string | null) => {
          if (!value) {
            return;
          }

          const normalized = normalizeEmojiKey(value);

          if (normalized && !candidateKeys.includes(normalized)) {
            candidateKeys.push(normalized);
          }
        };

        pushCandidate(emojiKey);
        pushCandidate(reaction.emoji.name);
        pushCandidate(reaction.emoji.id);

        let matchedKey: ReactionIdentifier | undefined;
        let action: ReactionAction | undefined;

        for (const key of candidateKeys) {
          const possibleAction = reactionActions.get(key);

          if (possibleAction) {
            matchedKey = key;
            action = possibleAction;
            break;
          }
        }

        if (!action || !matchedKey) {
          return;
        }

        const channel = message.channel;

        if (!isSendableChannel(channel)) {
          return;
        }

        await action({
          client,
          emojiKey: matchedKey,
          channel,
          message,
          reaction,
          user,
        });
      } catch (error) {
        const identifier =
          rawReaction.emoji?.name ?? rawReaction.emoji?.id ?? 'unknown';
        console.error(`Failed to process reaction ${identifier}:`, error);
      }
    });

    reactionListenerRegistered = true;
  }

  if (reactionActions.size === 0) {
    addReactionAction('⭐', async ({ message, user, reaction, channel }) => {
      if (!message.guild) {
        return;
      }

      // Only fire the action once per message to avoid duplicates.
      if (reaction.count && reaction.count > 1) {
        return;
      }

      await channel.send({
        content: `⭐ ${user.toString()} starred a message from ${message.author}: ${message.url}`,
        allowedMentions: { users: [user.id] },
      });
    });
  }

  return {
    add: addReactionAction,
    remove: removeReactionAction,
    clear: clearReactionActions,
  };
};

/**
 * Registers message listeners that run whenever a message passes the provided
 * filter. Use the returned registry to add, remove, or clear at runtime.
 */
export const registerMessageSubscriptions = (
  client: Client,
  subscriptions: MessageSubscription[] = [],
): MessageActionRegistry => {
  subscriptions.forEach(addMessageAction);

  if (!messageListenerRegistered) {
    client.on('messageCreate', async (rawMessage) => {
      try {
        const message = await hydrateMessage(rawMessage);

        for (const subscription of messageActions.values()) {
          if (subscription.filter && !subscription.filter(message)) {
            continue;
          }

          await subscription.action({
            client,
            message,
          });
        }
      } catch (error) {
        console.error('Failed to process incoming message:', error);
      }
    });

    messageListenerRegistered = true;
  }

  return {
    add: addMessageAction,
    remove: removeMessageAction,
    clear: clearMessageActions,
  };
};

const hydrateReaction = async (
  reaction: MessageReaction | PartialMessageReaction,
): Promise<MessageReaction> => {
  if (reaction.partial) {
    return reaction.fetch();
  }

  return reaction;
};

const hydrateMessage = async (
  message: Message | PartialMessage,
): Promise<Message> => {
  if (message.partial) {
    return message.fetch();
  }

  return message;
};

const normalizeEmojiKey = (emoji: ReactionIdentifier): ReactionIdentifier => {
  const trimmed = emoji.trim();
  const customEmojiMatch = trimmed.match(/^<a?:\w+:(\d+)>$/);

  if (customEmojiMatch && customEmojiMatch[1]) {
    return customEmojiMatch[1];
  }

  const namedEmojiMatch = trimmed.match(/^:([\w-]{2,}):$/);

  if (namedEmojiMatch && namedEmojiMatch[1]) {
    return namedEmojiMatch[1];
  }

  const compositeCustomMatch = trimmed.match(/^([\w-]+):(\d+)$/);

  if (compositeCustomMatch && compositeCustomMatch[2]) {
    return compositeCustomMatch[2];
  }

  return trimmed;
};

export const reactionRegistry: ReactionActionRegistry = {
  add: addReactionAction,
  remove: removeReactionAction,
  clear: clearReactionActions,
};

export const messageRegistry: MessageActionRegistry = {
  add: addMessageAction,
  remove: removeMessageAction,
  clear: clearMessageActions,
};

const isSendableChannel = (
  channel: Message['channel'],
): channel is SendableChannel => {
  return (
    !!channel &&
    typeof (channel as { send?: unknown }).send === 'function'
  );
};
