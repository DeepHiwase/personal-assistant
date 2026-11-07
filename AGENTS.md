## Hono CLI

Run `npx hono --help` first, and use the CLI instead of a dev server.

## Render environment-variable sync

When syncing variables from the local `.env` to Render, **always exclude
`TRIGGER_SECRET_KEY`**. The local value is for Trigger.dev development and must
never be copied to production, even when asked to sync *all* variables.
Never overwrite or delete Render's existing `TRIGGER_SECRET_KEY` during a sync;
production Trigger.dev credentials must be configured separately from a
production key. Preserve all other Render variables outside the requested sync.

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.agents/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-chat-agent`, `trigger-authoring-tasks`, `trigger-chat-agent-advanced`, `trigger-cost-savings`, `trigger-getting-started`, `trigger-realtime-and-frontend`.
<!-- TRIGGER.DEV SKILLS END -->
