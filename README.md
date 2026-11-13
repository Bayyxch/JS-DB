# Bot Sawit

A long-term palm-farming economy Discord bot built around:

`!tanam` -> `!panen` -> `!jual` -> `!luasin`

The MVP is designed so currency has both faucets and sinks. Farming revenue comes from harvested TBS, while seeds and land expansion remove currency from circulation. The project keeps economy operations atomic in SQLite and records balance-changing transactions in a ledger.

## Stack

- Node.js 24 LTS
- TypeScript
- discord.js 14
- better-sqlite3
- dotenv
- Vitest

Node.js 24 is intentionally targeted because it is an LTS line in October 2026. discord.js 14.27.0 is used for the Discord layer and better-sqlite3 13.0.3 is used for the database.

## Features in this MVP

- Prefix commands with `!`
- First-time account provisioning
- Four starter farm plots
- Seed inventory
- `!tanam` with multi-plot planting
- Real-time grow timers
- `!panen` producing TBS resources
- `!jual` converting TBS to SawitCoin
- Exponential land expansion cost with a hard plot cap
- `!shop` and `!buy`
- `!inventory`
- `!balance`
- `!daily`
- `!work`
- `!leaderboard`
- Global player profiles with editable bio
- Global friendship requests, accept/decline, list, and remove
- Game partner proposals, acceptance, status, divorce, and shared bond progression
- Per-command cooldowns
- Atomic economy transactions
- Transaction ledger for every balance change
- SQLite WAL mode and foreign keys
- Database migrations
- Configurable custom Discord emoji
- Unit tests for core economy formulas
- GitHub Actions CI

## Setup

1. Install Node.js 24 LTS.
2. Copy `.env.example` to `.env`.
3. Put your Discord bot token into `DISCORD_TOKEN`.
4. In the Discord Developer Portal, enable the **Message Content Intent** for the bot because the MVP uses prefix commands.
5. Give the bot only the permissions it needs to read/send messages and embeds.
6. Run:

```bash
npm install
npm run check
npm test
npm run build
npm start
```

For development with automatic reload:

```bash
npm run dev
```

## Commands

```text
!help
!balance
!kebun
!inventory
!shop
!buy seed_basic 4
!tanam 4
!tanam basic 2
!panen
!jual tbs 10
!luasin
!daily
!work
!leaderboard
!ping
```

Aliases are also available for common commands, such as `!saldo`, `!farm`, `!inv`, `!beli`, `!jual`, `!luas`, `!lb`, and `!harvest`.

## Global player and social system

Player accounts, profiles, wallets, farms, and friendships are keyed by Discord user ID and shared across every server where the bot is installed. Server IDs are not used to create separate player economies. Friendship requests must be accepted by the recipient. Profiles support a bio of up to 160 characters. Optional game-partner status is global too; both players must accept a proposal flow, and bond points can be claimed once every 24 hours.

## Economy rules

The MVP deliberately avoids printing large amounts of free money. The primary farming faucet is the sale of TBS. Seeds are a recurring sink and land expansion is a large permanent sink. `!work` and `!daily` are intentionally small compared with farming so they support new players without becoming the dominant money source.

All wallet changes use a single SQLite transaction and create a ledger row. This makes balance bugs much easier to audit and makes future economy features safer to add.

## Custom emoji

Set any of the `EMOJI_*` variables to full custom emoji syntax, for example:

```env
EMOJI_PALM=<:sawit:123456789012345678>
EMOJI_COIN=<:coin:123456789012345678>
```

The bot falls back to text labels when an emoji is not configured, so the application remains usable before the final emoji pack is uploaded.

## Project structure

```text
bot-sawit/
├─ .github/workflows/ci.yml
├─ src/
│  ├─ commands/
│  ├─ config/
│  ├─ db/
│  ├─ events/
│  ├─ migrations/
│  ├─ services/
│  ├─ types/
│  ├─ utils/
│  └─ index.ts
├─ tests/
├─ data/
├─ .env.example
├─ .gitignore
├─ package.json
├─ tsconfig.json
└─ README.md
```

## Roadmap

The code is intentionally split into command, service, database, and configuration layers so later systems can be added without rewriting the core loop.

Planned upgrades:

1. Crop varieties and quality
2. Fertilizer and tools
3. Storage and processing
4. Dynamic market demand
5. Contracts and quests
6. Weather and seasonal events
7. Collection and cosmetics
8. Player marketplace
9. Guild/farm co-op
10. Prestige and endgame systems

Do not add a new currency faucet without adding or confirming a meaningful sink.

## Git workflow

Use small, descriptive commits:

```text
feat: add planting system
feat: add land expansion
fix: prevent duplicate harvest
fix: reject negative purchase quantity
test: cover land cost curve
```

Never commit `.env` or a production SQLite database.
