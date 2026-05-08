import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import type { ToolSet } from "ai";

export interface DiscordToolRouterConfig {
  composioApiKey: string;
  composioAuthConfigId: string;
  userEmail: string;
}

export const createDiscordToolRouterSession = async ({
  composioApiKey,
  composioAuthConfigId,
  userEmail,
}: DiscordToolRouterConfig) => {
  const composio = new Composio({
    apiKey: composioApiKey,
    provider: new VercelProvider(),
  });

  const session = await composio.toolRouter.create(userEmail, {
    toolkits: ["discordbot"],
    authConfigs: {
      discordbot: composioAuthConfigId,
    },
    manageConnections: true,
  });

  if (session.warnings.length > 0) {
    console.warn("tool router session warnings:", session.warnings);
  }

  return session;
};

export const summarizeTools = (tools: ToolSet, maxNames = 10) => {
  const names = Object.keys(tools).sort();

  return {
    count: names.length,
    names: names.slice(0, maxNames),
  };
};
