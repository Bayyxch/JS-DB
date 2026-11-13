# Validation and Home Test Checklist

## Automated validation

The GitHub Actions workflow runs:

1. `npm run check` — TypeScript type-check.
2. `npm test` — Vitest unit and SQLite integration tests.
3. `npm run build` — production TypeScript build.

Latest M6 CI result: **passed**. The workflow completed all three steps successfully. The current test suite contains 7 test files and 30 passing tests.

Use Node.js 24, matching the project's engine requirement.

```bash
npm install
npm run ci
```

## Before testing against an existing database

1. Stop the bot cleanly.
2. Make a backup copy of `data/sawit.sqlite`.
3. Keep the original database untouched during the first test.
4. Configure a separate test database path in `.env`, for example `DATABASE_PATH=./data/sawit-test.sqlite`.
5. Start the bot with `npm start` and use a private test server with at least two test accounts.
6. Check the `schema_migrations` table. The latest schema version should be **7**.
7. Compare old and new wallet balances, inventory, farm plots, and transaction history on the copied database to confirm migration preservation.

Do not test migrations on the only copy of a live economy database.

## Manual Discord smoke tests

### M1 — Global profile and friendship

- [ ] Run `!profil` and confirm the profile, balance, farm count, and friend count display.
- [ ] Run `!profil bio Halo, petani sawit!` and confirm the bio updates.
- [ ] Try a bio longer than 160 characters and confirm it is rejected.
- [ ] Use `!profil @pemain` to view another registered player.
- [ ] From account A, run `!teman add @B`; confirm B receives a request.
- [ ] From B, run `!teman accept @A`; confirm both lists show the friendship.
- [ ] Test `!teman decline @A` and `!teman remove @B`.
- [ ] Repeat profile and friend checks in a second server. Data must remain the same.

### M2 — Game partner and bond

- [ ] Run `!nikah propose @B`, then accept from B.
- [ ] Confirm `!nikah status` shows the same partner from both accounts.
- [ ] Try proposing to a player who already has a partner; it must be rejected.
- [ ] Claim `!nikah bond` from one account, then immediately from the other; the shared 24-hour cooldown must block the second claim.
- [ ] Run `!nikah divorce` and confirm both profiles show no partner.

### M3 — Crop varieties and collection

- [ ] Run `!shop` and confirm Corn, Pineapple, and Cacao seeds appear.
- [ ] Buy seeds, for example `!buy seed_corn 2`.
- [ ] Plant with `!tanam corn 2`; confirm the correct plots and grow time.
- [ ] After the grow timer, harvest with `!panen`; confirm the correct resource is awarded.
- [ ] Sell the new resource and confirm the correct item price is used.
- [ ] Run `!koleksi` and confirm the crop is recorded with its rarity.
- [ ] Repeat with Pineapple and Cacao.

### M4 — Family cooperative

- [ ] Create a family with `!keluarga create Keluarga Sawit`.
- [ ] Invite a second account and accept using the family ID.
- [ ] Confirm both members appear in `!keluarga info`.
- [ ] Harvest crops as a member and confirm family contribution points increase.
- [ ] Test ownership transfer, kicking a member, and leaving the family.
- [ ] Confirm a player cannot join two families and a family cannot exceed eight members.

### M5 — Global player market

- [ ] Give seller account enough items, then create a listing with `!market sell tbs 10 75`.
- [ ] Confirm the listed items leave the seller's inventory while listed.
- [ ] From buyer account, use `!market list` and buy a partial quantity with `!market buy <id> 2`.
- [ ] Confirm buyer items and seller SawitCoin increase by the correct amounts.
- [ ] Confirm the remaining listing quantity is correct.
- [ ] Test `!market cancel <id>` and confirm escrowed items return to the seller.
- [ ] Confirm self-purchase, insufficient funds, and non-owner cancellation are rejected without partial changes.
- [ ] Confirm listings are visible across servers and expired listings can be cancelled by their owner.

### M6 — Expeditions, homes, pets, and events

- [ ] Run `!ekspedisi`; confirm a resource reward and adventure XP are granted.
- [ ] Immediately repeat it; the two-hour cooldown must block the second run.
- [ ] Run `!ekspedisi status` and confirm progress persists after restart.
- [ ] Run `!rumah`, then `!rumah upgrade`; confirm the cost is deducted and pet slots increase.
- [ ] Adopt a pet with `!pet adopt Kiko`; confirm the adoption cost and rarity.
- [ ] Feed a pet with `!pet feed <id>`; confirm five TBS are consumed and pet XP increases.
- [ ] Try feeding again within one hour; the cooldown must block it.
- [ ] Test `!pet rename <id> <nama>` and the pet slot limit.
- [ ] Run `!event` from two servers; the active global event should match.
- [ ] Confirm event bonuses affect the appropriate harvest, expedition, or adoption action.

## Final acceptance

- [ ] Bot starts without migration errors.
- [ ] Existing M0 player balances, inventory, and farm plots are preserved.
- [ ] Global features behave identically across multiple Discord servers.
- [ ] Cooldowns and progress survive a bot restart.
- [ ] No unexpected balance or inventory changes occur after failed transactions.
- [ ] All manual checks pass on a copied database before merging the milestone PRs.

## Merge order

The milestone PRs are stacked. Review and merge them in this order:

1. PR #2 — M1 Global Profile & Friendship
2. PR #3 — M2 Game Partner & Bond
3. PR #4 — M3 Crop Varieties & Collection
4. PR #5 — M4 Family Cooperative
5. PR #6 — M5 Global Player Market
6. PR #7 — M6 Expeditions, Homes, Pets & Events

PR #1 (M0 foundation hardening) is already merged. Do not merge later PRs before their prerequisites.
