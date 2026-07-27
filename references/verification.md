# Seed-Recovery Verification Log

Real runs proving the technique (Base chain, primary `0x732c...31BF`).

## Test 1 — letter "r"
Phrase: `resource slab tomorrow obscure tone snap label awful produce ___ slender novel`
- Found word: **rebuild**
- Address: `0x68695869D6E028661e5D8E270B6CADCE6c95Fc00`
- Balance: ETH 0.00018578, USDC 1.666046
- Note: first sweep attempt failed (legacy gas fallback 1gwei + crash before USDC). After fix (prio=fee, tokens-first) USDC moves first.

## Test 2 — letter "i"
Phrase: `venture lion ___ sweet scissors feed side devote vibrant enter behave concert`
- Found word: **increase**
- Address: `0xD2dA8290fAfBa40cF05226fc7c6395f5DDDa9a18`
- Balance: ETH 0.0001767, USDC 1.66686
- USDC SWEEP tx: `0x26265edd5beb2c688e7b9ac2e96de2ba796fdca1728cf0c9f1c8621272cc97dd` ✅
- ETH leftover NOT swept (too small after token gas) — acceptable per user ("eth sisa gak apa apa").

## Lesson reinforced
- `fromPhrase` checksum: only the CORRECT word derives without throwing → that's the hit signal.
- Always sweep USDC BEFORE ETH. ETH-only wallets funded with USDC but ~0 ETH still sweep USDC fine (token tx pays its own gas from existing ETH; if ETH truly 0, needs topup).
- Base gas is sub-gwei (~0.006). Never set maxPriorityFeePerGas > maxFeePerGas or ethers throws `priorityFee cannot be more than maxFee`.

## Test 3 — letter "b" (2026-07-21, NO MATCH — false positive detection)
Phrase: `trick auction update hobby camp width poem diet mixture ___ cereal despair`
- Letter hint: "b"
- 17 valid B-words checked (balance, bean, because, bind, boil, bomb, budget, etc.)
- **All addresses empty** (0 ETH, 0 USDC, 0 USDbC on Base)
- **False positive found:** word "boil" → address `0x8076218e956c05EabA715E4791432A9Ab005E011` had nonce=1, but `getCode()` returned non-empty → it was a **contract deployed by someone else**, NOT an EOA from the seed.
- Lesson: `getCode` check is essential to filter out contract-address false positives. Block-scanning for tx history is too slow (times out at 200K+ blocks). Fast triage: `getCode → getBalance → getTransactionCount`.
- Status: **No balance found for letter B** — user may try another letter.
