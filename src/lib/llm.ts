import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const DEFAULT_AURI_MODEL = "openai/gpt-5-mini";
export const DEFAULT_OPENAI_AGENT_MODEL = "gpt-5-mini";

const trimmedEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
};

const heliconeApiKey = trimmedEnv("HELICONE_API_KEY");

export const openrouter = createOpenRouter({
  apiKey: trimmedEnv("OPENROUTER_API_KEY"),
  appName: "auri-discord-bot",
  ...(heliconeApiKey
    ? {
        baseURL: "https://openrouter.helicone.ai/api/v1",
        headers: {
          "Helicone-Auth": `Bearer ${heliconeApiKey}`,
          "Helicone-Cache-Enabled": "false",
        },
      }
    : {}),
});

export const getAuriModelId = (): string => {
  return trimmedEnv("AURI_MODEL") ?? DEFAULT_AURI_MODEL;
};

export const getAuriModel = () => {
  return openrouter.chat(getAuriModelId(), {
    provider: {
      sort: "price",
    },
  });
};

export const getOpenAIAgentModelId = (): string => {
  return trimmedEnv("AURI_OPENAI_MODEL") ?? DEFAULT_OPENAI_AGENT_MODEL;
};
