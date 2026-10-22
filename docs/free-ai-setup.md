# Free AI provider setup

## Recommended starting point: Groq

[Groq's official cookbook](https://github.com/groq/groq-api-cookbook) explicitly says an API key can be obtained for free by creating an account at [Groq Console](https://console.groq.com/). This is an account-issued credential, not a public shared key. Create your own key in the console and keep it server-side.

The provider's live pricing and rate-limit pages were blocked by this environment's outbound policy during this task. Current model availability, account eligibility and free quotas have **not** been verified. A free key does not imply unlimited free use. Check the console before enabling billing or using real project data.

The app already uses an OpenAI-compatible HTTPS chat-completions client. To select Groq, set the following securely in the environment settings or an ignored `.env` file:

```dotenv
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=YOUR_CURRENT_GROQ_JSON_MODE_MODEL_ID
AI_API_KEY=YOUR_OWN_GROQ_KEY
```

Replace both placeholders; choose an available model that supports JSON object response mode. Restart the server after applying configuration. Do not paste keys into chat, browser code or committed files. The managed environment must allow `api.groq.com` as a credential destination; the existing `AI_API_KEY` requirement currently allows only `api.openai.com`. The supported draft update refused to change its destinations, so edit that existing requirement in environment settings to include `api.groq.com`, then review/save and publish. No draft changes were saved by that attempted update.

Try a small sample project first: ask “Analyze delivery risks”, then “Add a two-day review task after design approval”. Review the proposed task changes, apply them, and verify Undo. The existing controlled-provider tests verify the application's workflow, but do not establish live Groq compatibility, model quality or sufficient free context limits. Large project prompts may exceed a free model's limits.

## Other candidates

- [Google AI Studio](https://aistudio.google.com/): investigate Gemini's eligible free-tier models and region availability. The official [Gemini cookbook](https://github.com/google-gemini/cookbook) documents creating an API key. Current pricing was not accessible in this environment.
- [OpenRouter free models](https://openrouter.ai/models?max_price=0): investigate available free models and account limits. Its documentation was blocked, so no current free quota or compatibility claim is made here.

No live provider key was found, generated, purchased or tested. No account was created and no paid service was enabled. Manual planning remains usable without a key.
