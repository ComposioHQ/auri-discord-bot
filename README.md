# discord bot

ai-powered discord bot built with composio and vercel ai sdk. features multiple agents that handle different aspects of server automation and user interaction.

## agents

the bot runs four distinct agents that can be toggled individually:

- **ping test** - responds to `!ping` commands for testing bot connectivity
- **moderation** - monitors support forum and introduction channels for content moderation
- **support redirect** - manages support requests and routes them to support team members
- **star reply** - uses ai to generate contextual responses when messages receive star reactions

## setup

### prerequisites

- bun runtime
- discord bot token with message content intent enabled
- composio api key and auth config
- openrouter api key

### environment variables

create a `.env` file in the project root:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token
COMPOSIO_APIKEY=your_composio_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
SUPPORT_FORUM_CHANNEL_ID=your_channel_id
```

### installation

```bash
bun install
```

### development

```bash
bun run dev
```

### production

```bash
bun run start
```

## configuration

edit the agent config in `src/index.ts`:

```typescript
await startAgents(client, {
  supportForumChannelId: process.env.SUPPORT_FORUM_CHANNEL_ID,
  introduceYourselfChannelId: "your_channel_id",
  composioApiKey: process.env.COMPOSIO_APIKEY,
  composioAuthConfigId: "your_auth_config_id",
  userEmail: "your_email",
  supportTeamUserIds: ["user_id_1", "user_id_2"],
});
```

## architecture

- `src/index.ts` - main entry point and discord client setup
- `src/agents/` - individual agent implementations
- `src/lib/subscribe.ts` - message and reaction subscription system
- `src/lib/run-agent.ts` - utility for running agents standalone

each agent can be run independently for testing by executing its file directly with bun.

## tech stack

- discord.js for bot interactions
- composio for tool orchestration via mcp
- vercel ai sdk for llm integration
- openrouter for model access
- typescript and bun for runtime
