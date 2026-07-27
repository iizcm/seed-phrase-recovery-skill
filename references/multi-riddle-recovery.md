# Multi-Riddle BIP39 Recovery — Session 2026-07-26

## Task
Recover a BIP39 seed phrase with **multiple missing words** (`___`) using **non-letter hints**: synonyms, translations, riddles, or simple math.

## Input
```
Phrase: ___ ___ flavor become dynamic demand ___ provide task worth ___ purse
Hints: seseorang, sakit panas, lagi, 3849-3846
```

## Hints Parsing
| Hint          | Type          | Candidates (BIP39)                     |
|---------------|---------------|----------------------------------------|
| seseorang     | Translation   | person, human, man, woman, someone     |
| sakit panas   | Synonym       | fever, sick, hot, ill, temperature     |
| lagi           | Synonym       | again, more, repeat, still             |
| 3849-3846     | Math          | 3 → Three                              |

## Script
`scripts/recover_multi_riddle.js` — accepts phrase + comma-separated hints, generates all combinations, derives addresses, checks tx history via Basescan API.

## Output
```
**FOUND** | phrase: person fever flavor become dynamic demand repeat provide task worth three purse
  address: 0xeD6ca043E389C00Fa274f4B0F3835FDAB061e217
  TX HISTORY: YES
```

## Key Points
- **No auto-sweep** — only reports wallets with tx history (user may not want to drain test wallets).
- **Combinatorial explosion** — 4 hints × 50 candidates = 6.25M combinations. Keep hints narrow.
- **Basescan API** — fallback to `eth_getTransactionCount` if API fails.
- **Contract triage** — `getCode(addr) === '0x'` to skip contract addresses.

## Session Artifacts
- [Script: recover_multi_riddle.js](../scripts/recover_multi_riddle.js)
- [Basescan API docs](https://docs.basescan.org/api-endpoints/accounts#get-a-list-of-internal-transactions-by-address)
- [BIP39 wordlist](https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt)