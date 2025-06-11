# Moo Do Bot

A Telegram bot that monitors website health and sends sarcastic alerts when the site is down. Built on Cloudflare Workers with scheduled checks.

## Features

- 🔍 Regular monitoring of website health (every minute)
- 🚨 Detects various error types (HTTP 500+, timeouts, DNS issues, connection refused)
- 💬 Sends alerts to a Telegram chat when issues are detected
- 🤖 Uses Google's Gemini AI to generate sarcastic messages for alerts
- ⏱️ Implements a mute duration to prevent alert spam
- 🔄 Uses Cloudflare Workers KV for state management

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/moo_do_bot.git
   cd moo_do_bot
   ```

2. Install Wrangler CLI (Cloudflare Workers CLI):
   ```
   npm install -g wrangler
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Login to Cloudflare:
   ```
   wrangler login
   ```

5. Create a KV namespace:
   ```
   wrangler kv namespace create CACHE
   ```
   
   Update the `wrangler.toml` file with the new KV namespace ID.

## Configuration

Edit the `wrangler.toml` file to configure your bot:

```toml
[vars]
URL = "https://your-website-to-monitor.com/"
BOT_TOKEN = "your-telegram-bot-token"
CHAT_ID = "your-telegram-chat-id"
GEMINI_API_KEY = "your-gemini-api-key"
```

### Required Environment Variables

- `URL`: The website URL to monitor
- `BOT_TOKEN`: Your Telegram bot token (get it from [@BotFather](https://t.me/botfather))
- `CHAT_ID`: The Telegram chat ID where alerts will be sent
- `GEMINI_API_KEY`: Google Gemini API key for generating sarcastic messages

## Usage

### Local Development

Run the bot locally for testing:

```
wrangler dev
```

### Deployment

Deploy to Cloudflare Workers:

```
wrangler publish
```

## How It Works

1. The bot runs on a schedule (every minute by default)
2. It checks if the configured website is accessible
3. If the site is down, it:
   - Generates a sarcastic message using Google's Gemini AI
   - Formats an alert with error details and timestamp
   - Sends the alert to the configured Telegram chat
4. A mute duration prevents sending multiple alerts in quick succession

## Customization

- Modify the mute duration in `src/index.js` (line 13) to control how frequently alerts can be sent
- Adjust the timeout duration in `src/index.js` (line 14) to change how long the bot waits for a response
- Edit the AI prompts in `src/index.js` (lines 146-152) to change the tone of the generated messages
- Modify the fallback messages in `src/index.js` (lines 201-209) used when AI generation fails

## Security Note

The `wrangler.toml` file contains sensitive information. In a production environment:

1. Do not commit this file with real credentials
2. Use Cloudflare's secret management:
   ```
   wrangler secret put BOT_TOKEN
   wrangler secret put GEMINI_API_KEY
   ```

## License

[MIT License](LICENSE)