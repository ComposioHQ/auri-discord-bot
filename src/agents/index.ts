import type { Client } from "discord.js";
import { startPingTestAgent } from "./ping-test.ts";
import {
  startModerationAgent,
  type ModerationAgentConfig,
} from "./moderation.ts";
import {
  startSupportRedirectAgent,
  type SupportRedirectAgentConfig,
} from "./support-redirect.ts";
import {
  startStarReplyAgent,
  type StarReplyAgentConfig,
} from "./star-reply.ts";

export interface AgentOrchestratorConfig {
  supportForumChannelId: string;
  introduceYourselfChannelId: string;
  composioApiKey: string;
  composioAuthConfigId: string;
  userEmail: string;
  supportTeamUserIds: string[];
}

export interface AgentSelection {
  pingTest?: boolean;
  moderation?: boolean;
  supportRedirect?: boolean;
  starReply?: boolean;
}

export const startAgents = async (
  client: Client,
  config: AgentOrchestratorConfig,
  selection: AgentSelection = {
    pingTest: true,
    moderation: true,
    supportRedirect: true,
    starReply: true,
  }
) => {
  console.log("starting agents with selection:", selection);

  if (selection.pingTest) {
    startPingTestAgent(client);
  }

  if (selection.moderation) {
    const moderationConfig: ModerationAgentConfig = {
      supportForumChannelId: config.supportForumChannelId,
      introduceYourselfChannelId: config.introduceYourselfChannelId,
      composioApiKey: config.composioApiKey,
      composioAuthConfigId: config.composioAuthConfigId,
      userEmail: config.userEmail,
    };
    await startModerationAgent(client, moderationConfig);
  }

  if (selection.supportRedirect) {
    const supportRedirectConfig: SupportRedirectAgentConfig = {
      supportForumChannelId: config.supportForumChannelId,
      supportTeamUserIds: config.supportTeamUserIds,
    };
    startSupportRedirectAgent(client, supportRedirectConfig);
  }

  if (selection.starReply) {
    const starReplyConfig: StarReplyAgentConfig = {
      composioApiKey: config.composioApiKey,
      composioAuthConfigId: config.composioAuthConfigId,
      userEmail: config.userEmail,
    };
    await startStarReplyAgent(client, starReplyConfig);
  }

  console.log("all selected agents started");
};

// individual agent starters for convenience
export { startPingTestAgent } from "./ping-test.ts";
export { startModerationAgent } from "./moderation.ts";
export { startSupportRedirectAgent } from "./support-redirect.ts";
export { startStarReplyAgent } from "./star-reply.ts";
