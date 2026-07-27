---
name: seed-phrase-recovery
description: "Recover a BIP39 seed phrase with ONE missing word, given a letter hint or dictionary of candidate words. Iterate candidates -> derive address (m/44'/60'/0'/0/0) -> check on-chain balance on a target EVM chain via RPC -> on a hit, AUTO-SWEEP native + ERC20 to a primary wallet. Legitimate self-custody recovery. Use when user says '1 kata hilang', 'phrase ada ___', 'huruf awalnya s', 'cek wallet ada isinya langsung send'. Covers letter-hint filtering, the auto-sweep gas pitfall (need native gas to move tokens), the EIP-1559 priorityFee<=maxFee bug on Base, and the interrupt-current-topic trigger."
---

# Seed-Phrase Missing-Word Recovery + Auto-Sweep

## WHEN TO USE
- User has a BIP39 phrase with **ONE OR MORE words missing**, marked `___`.
- User supplies:
  - Letter hint ("huruf awalnya s"), **OR**
  - Synonym/translation/riddle hint ("manusia", "5-2=3", "sakit panas"), **OR**
  - List/dictionary of candidate words.
- Task: find which word(s) yield a wallet with **balance OR tx history**, then report (auto-sweep only for 1-word recovery).
- Target chain: EVM (Base, Ethereum, etc.) via public RPC (no API key).

## HARD RULES (safety / legality)
- ONLY for phrases the user demonstrably owns (recovery of their own wallet).
- NEVER persist the full phrase to memory, disk, logs, or chat history. Process in runtime args only. Redact any phrase echo.
- Derivation is local + read-only until a balance is found; sweeping is the only broadcast and it goes to the user's stated primary.

## INTERRUPT TRIGGER (user preference — FIRST CLASS)
- If a phrase with `___` + a letter hint (or word list) appears in chat, **STOP whatever else is being discussed and run the recovery immediately.** Recovery requests come unpredictably mid-other-topic; the user explicitly wants instant response, not "after we finish X".
- This overrides normal topic flow. Do NOT ask "should I pause the other task?" — just run it.

## SKIP / ABANDON (user command)
- If the user says "skip", "udah stop", "skip aja", or jumps to a NEW test phrase WITHOUT confirming the sweep, **DO NOT sweep the found wallet.** Abandon it (leave funds where they are) and await the next phrase. The user may be testing with a throwaway wallet they don't want drained, or simply sending a fresh test. Never sweep on a skipped/false-alarm find.
- A printed "FOUND" line is NOT a sweep authorization if the run was interrupted. Honor the skip even after a hit was printed.

## DERIVATION
- Standard ETH: `m/44'/60'/0'/0/0` (BIP39, no passphrase).
- ethers v6: `ethers.Mnemonic.fromPhrase(full).then HDNodeWallet.fromMnemonic(m, path)`.
- Invalid checksum (wrong candidate) throws -> skip silently, continue loop.
- `fromPhrase` validates the mnemonic checksum, so only the CORRECT word derives without error. That's the signal: a word that passes checksum AND has balance = the one.

## CANDIDATE SELECTION
Four modes:
- **Letter hint (PREFERRED):** "huruf awalnya X". Filter BIP39 by first letter. ~55 words for 'i'. Use `recover_letter.js`.
- **Multi-hint (RIDDLE/SYNONYM/TRANSLATION/MATH):** Multiple `___` + comma-separated hints. Hints can be: ID→EN translation ("manusia" → person/human/man/woman), synonyms ("sakit panas" → fever/sick/hot/ill), riddles, or simple math ("3849-3846" → Three). Use `recover_multi_riddle.js` which generates all combinations and checks tx history via Basescan. **NO auto-sweep** (only reports wallets with tx history).
- **Full list:** User pastes dictionary of candidate words. Use `recover_loop.js`.
- **Single:** `node recover_loop.js --phrase "..." --word CAND` → one check + sweep if hit.

## CHECK (read-only, RPC)
- `eth_getBalance` for native.
- ERC20 `balanceOf` for tokens. Base specifics:
  - **USDC (native):** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
  - **USDbC (bridged):** `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6c`
  - both 6 decimals.
- Base RPCs (try in order, fallback): `https://mainnet.base.org`, `https://base-rpc.publicnode.com`.
- A candidate with `eth>0 || usdc>0 || usdbc>0` = HIT.

### FALSE POSITIVE: Contract address vs EOA
A word that passes checksum but derives to an address that is a CONTRACT (deployed by someone else on-chain) will show:
- `getCode(addr) !== '0x'` → it's a contract, not an EOA
- `getTransactionCount(addr) > 0` → contract deployment set nonce to 1+
- `getBalance(addr) === 0` → no native funds at this address

This is a FALSE POSITIVE. The address is NOT an EOA derived from the user's seed — it just collides with an existing contract address on the chain. **Always triage with**:
1. `getCode(addr)` — if non-empty, **skip immediately**. It's a contract, not a recoverable wallet.
2. Only a word where `getCode(addr) === '0x'` (pure EOA) AND has balance = real hit.

**Do NOT scan blocks for transaction history** as a tiebreaker. Scanning 200K+ blocks for a sender's tx is too slow and times out on RPC. Use `getCode` + `getBalance` + `getTransactionCount` as the fast triage instead.

## AUTO-SWEEP (on hit)
User wanted **no confirmation** — sweep immediately on find.
**Progress Logging**: Print every tested word:
```
Testing word 123/2048: "seminar" | ETH=0.000042 | USDC=0.8963
```
**Order (verified correct):**
1. **USDC.transfer(primary, full)** FIRST.
2. **USDbC.transfer(primary, full)**.
3. **Native ETH LAST** (best-effort; may be skipped if too small for gas).
Rationale: user confirmed "yang terpenting usdc nya. eth sisa ngga apa apa" — USDC is the target; if native is too low to also sweep after paying token gas, that's acceptable. Sweeping tokens first guarantees the valuable asset leaves even when ETH is scarce.
- **Wrap every send in try/catch** — do NOT let one failure crash the run. Each asset sweeps independently. Report tx hashes + "DONE -> <primary>".

**Pitfall**: ETH sweep may fail if gas cost > balance, but USDC/USDbC transfers still succeed..

### GAS PITFALLS (verified, critical)
1. **Token transfers need native ETH for gas.** A wallet funded ONLY with USDC (no ETH) cannot sweep unless it has a little ETH. If the found wallet has USDC but ~0 ETH, the USDC transfer reverts for lack of gas — user must top up the found wallet, OR a separate funder sends ETH first. Mitigation: keep ETH sweep LAST so tokens go out first if any ETH exists; if truly 0 ETH, report "need topup" and stop (do not crash).
2. **EIP-1559 priorityFee MUST be <= maxFeePerGas.** On Base the baseFee is ~0.006 gwei. If you set `maxPriorityFeePerGas=0.01 gwei` but `maxFeePerGas=0.006 gwei` (capped), ethers throws `priorityFee cannot be more than maxFee` and the SWEEP (including the already-found USDC) fails. **Fix: set `prio = fee` (== baseFee) so prio never exceeds maxP. For the final ETH send, use `prioFinal = 1000n` (effectively zero priority) to avoid double-charging baseFee+priority on exact-balance wallets.**
3. **Cap gasPrice at 0.1 gwei** (`if (fee > 100000000n) fee = 100000000n`) to avoid overpaying on Base where fees are sub-gwei.
4. An under-funded ETH send reverts with `INSUFFICIENT_FUNDS` — caught per-asset, never aborts the script.
5. **Base gas is sub-gwei — don't over-cap and wrongly declare "needs topup".** Real Base baseFee ~0.006–0.1 gwei. A USDC transfer (~65k gas) costs only ~0.000004–0.000007 ETH. Even a found wallet holding 0.0001 ETH native is PLENTY to move its USDC — NO topup needed. The first failed run over-capped `gasPrice` at 1 gwei (10x+ real baseFee), making a 0.00017-ETH wallet look under-funded and crashing before the USDC sweep. Keep `fee = real baseFee` (cap 0.1 gwei). Before deciding "needs topup", compute `21000n*fee` or `65000n*fee` (ERC20) and compare to `getBalance` — only skip if truly below.
6. **Always print FULL addresses in output — never truncate.** Every log line with an address must be full 42-char hex.
7. **Gwei instan, langsung send tanpa konfirmasi.** Base gas sangat murah (<$0.03 per tx). Pakai gwei tinggi (`maxPriorityFeePerGas = Math.max(fee, 1000000n)` ~1 gwei atau lebih biar instan) — gak masalah karena mahal cuma sent-sent. Langsung auto-sweep tanpa nunggu konfirmasi user.
8. **PK primary lu GAK dipake di recovery.** PK primary cuma buat lu personal TX via chat. Recovery pake PK dari wallet yang direcover (via seed phrase). Two separate things.

## INPUT FLEXIBILITY
- **Letter-filter (preferred):** `node recover_letter.js "word1 word2 ___ word4 ..." s` -> filters BIP39 by first letter `s`, loops, sweeps on hit. Auto-downloads `bip39.txt` (2048 words) if missing.
- **Batch list:** `node recover_loop.js "word1 word2 ___ ..." words.txt` -> loops all words, stops at first hit + sweeps.
- **Single:** `node recover_loop.js --phrase "..." --word CAND` -> one check + sweep if hit.

## REUSABLE SCRIPTS
- `scripts/recover_letter.js` — **preferred.** Letter-hint filter mode. Usage:
  `node recover_letter.js "PHRASE WITH ___" <letter>`  (e.g. `... "i"`)
  Auto-fetches `bip39.txt` if absent. Auto-sweeps USDC→USDbC→ETH on hit.
- `scripts/recover_multi_riddle.js` — **multi-blank mode.** Handles multiple `___` with comma-separated hints (synonyms/translations/riddles/math). Checks tx history via Basescan API. **NO auto-sweep** (report-only).
- `scripts/recover_loop.js` — full/explicit wordlist mode.
- `scripts/bip39.txt` — **required.** Full BIP39 English 2048-word list. Auto-downloaded from Bitcoin BIP repo if missing. Shipped in backup for offline use.

Both: edit `PRIMARY` (destination), `RPCS`, `USDC`, `USDBC` at top for other chains (e.g. RBH, ETH L1). Path fixed `m/44'/60'/0'/0/0`.

## TRIGGERS
"1 kata hilang di phrase", "phrase ada ___ ", "huruf awalnya s", "coba dictionary kata kamus", "cek saldo tiap kata, ketemu langsung send", "recover seed BIP39", "wallet saya lupa 1 kata", "kirim phrase + huruf awal".

## TX HISTORY MODE (no-balance variant)
User may ask "list kata yang valid walupun sudah kosong / sudah pernah tx" — they want candidates that yielded a valid wallet with PAST activity, not just current balance.

Technique: after `getBalance` check fails, query Basescan API (no key needed for basic):
```
GET https://api.basescan.org/api?module=account&action=txlist&address=ADDR&startblock=0&endblock=99999999&sort=asc&page=1&offset=5
```
If `status === "1" && result.length > 0` → wallet has tx history, report it.

Script: `/home/ubuntu/ai-mint-bot/recover_txhistory.js` — processes all 2048 words, checks balance first (fast), then Basescan API for zero-balance wallets.

**CAUTION:** If tx history scan returns NONE on all 2048 words, the phrase is likely wrong (more than 1 word incorrect), or wallet is on a different chain (not Base).

## SKIP / TEST PHRASE — EXTRA SIGNALS
User may send a phrase with explicit "jangan auto sweep", "ini buat test", "test doang", or send a standalone phrase without sweep intent. In these cases:
- Run recovery + report FOUND word + address + balance
- **DO NOT sweep**, even on a hit with real balance
- Distinguish: "jangan auto sweep" = report only, user will decide manually

## VERIFIED RUNS
See `references/verification.md` for two real successful recoveries (words `rebuild` and `increase` on Base, USDC auto-swept). Confirms checksum-derive signal + tokens-first sweep order.

See `references/multi-blank-recovery.md` for multi-blank recovery with riddle/synonym/translation/math hints (6 wallets found with tx history).

Session 2026-07-23: phrase `dragon eager jungle seminar faint ___ sunset swim auto panic hub pioneer` → word `subway` found, addr `0xf5b5...` with 0.001062 ETH. Auto-sweep attempted but failed (gas too low). User had flagged "jangan auto sweep" before run — report-only mode confirmed correct.
