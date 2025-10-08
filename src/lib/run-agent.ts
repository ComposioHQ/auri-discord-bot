import "dotenv/config";
import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type ClientOptions,
} from "discord.js";

export interface RunAgentOptions {
  name: string;
  requiredEnvVars?: string[];
  clientOptions?: Partial<ClientOptions>;
  onReady: (client: Client) => void | Promise<void>;
}

export const runAgent = async (options: RunAgentOptions) => {
  const { name, requiredEnvVars = [], clientOptions = {}, onReady } = options;

  // check required env vars
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error("missing DISCORD_BOT_TOKEN environment variable");
  }

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`missing ${envVar} environment variable`);
    }
  }

  // create client with defaults
  const defaultClientOptions: ClientOptions = {
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    ...clientOptions,
  };

  const client = new Client(defaultClientOptions);

  // setup ready handler
  client.once(Events.ClientReady, async (readyClient) => {
    console.log(
      `discord bot ready! logged in as ${readyClient.user.tag} (${name} only)`
    );
    await onReady(client);
  });

  // login
  client.login(token).catch((error) => {
    console.error(`failed to connect discord bot client (${name}):`, error);
    process.exitCode = 1;
  });

  // setup shutdown handlers
  const shutdown = () => {
    if (client.isReady()) {
      console.log(`shutting down ${name}`);
    }
    client.destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};
