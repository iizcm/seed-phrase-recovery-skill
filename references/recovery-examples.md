# Recovery Phrase Examples

## Letter-Hint Mode (Fast)
**Input**: `dragon eager jungle ___ faint subway sunset swim auto panic hub pioneer` + hint `s`
**Output**: `seminar` | Address: `0xf5b5aDACFA2f60fA21694Af21526067427dD5a0B` | USDC=0.8963 | Tx: `0x4989eb0d231a4edd947fafd88e5b110dd3ee861dde140feb10b3ab4c915a9a3b`

## No-Letter-Hint Mode (Slow)
**Input**: `dragon eager jungle ___ faint subway sunset swim auto panic hub pioneer` (no hint)
**Output**: Loops 2048 words → `seminar` (hit) | Time: ~15 minutes.

## Pitfall: ETH Sweep Failed
ETH balance (0.000042) < gas cost → USDC sweep succeeds, ETH ignored.