# Multi-Blank Recovery with Riddle/Synonym Hints

## Session Reference
**Date:** 2026-07-26  
**Phrase:** `___ ___ flavor become dynamic demand ___ provide task worth ___ purse`  
**Hints:** `seseorang, sakit panas, lagi, 3849-3846`  
**Script:** `recover_multi_riddle.js`  

## Hint Parsing Logic
| Hint | Type | Candidates (BIP39) |
|------|------|---------------------|
| `seseorang` | Synonym/Translation | person, human, man, woman, individual, someone |
| `sakit panas` | Synonym/Translation | fever, sick, hot, ill, temperature |
| `lagi` | Synonym/Translation | again, more, repeat, still, extra, another |
| `3849-3846` | Math | three |

## Results
Found **6 wallets** with tx history (ETH=0, but active):

| Phrase | Address | TX History |
|--------|---------|-------------|
| `person fever flavor become dynamic demand repeat provide task worth three purse` | `0xeD6ca043E389C00Fa274f4B0F3835FDAB061e217` | ✅ |
| `man fever flavor become dynamic demand another provide task worth three purse` | `0x400B77b72aBD8Cd8E15bf0b4c5bbD20989f21726` | ✅ |
| `man ill flavor become dynamic demand still provide task worth three purse` | `0x3580E71E8E37d1A6F53e034b8FfcEFA90F20241A` | ✅ |
| `woman fever flavor become dynamic demand still provide task worth three purse` | `0x1b461c09b903299Ae83b501ada506d2E26df6d30` | ✅ |
| `woman ill flavor become dynamic demand more provide task worth three purse` | `0x99aFb40688b44238D757d8B4b58591c9eCaBf540` | ✅ |
| `someone fever flavor become dynamic demand again provide task worth three purse` | `0x43D0925146627e615E5e67D5B29f55b3d01d107c` | ✅ |

## Key Learnings
1. **Multi-blank recovery** requires combinatorial testing (4 blanks × ~5-6 candidates = 108 combos in this case).
2. **Tx history check** (not just balance) is critical for "empty but used" wallets.
3. **Hint flexibility** (synonyms, translations, math) expands candidate pool intelligently.
4. **NO auto-sweep** for multi-blank mode (user may be testing).

## Script Notes
- `recover_multi_riddle.js` uses Basescan API (`api.basescan.org`) for tx history.
- Falls back to `eth_getTransactionCount` + `eth_getCode` for fast EOA vs contract check.
- Math hints: simple `eval()` on numeric expressions (e.g., `3849-3846=3` → `three`).
- Translation hints: hardcoded map for common Indonesian→English (extend as needed).