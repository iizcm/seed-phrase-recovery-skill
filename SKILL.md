---
name: seed-phrase-recovery
description: "Recover a BIP39 seed phrase with ONE missing word, given a letter hint or dictionary of candidate words. Iterate candidates -> derive address (m/44'/60'/0'/0/0) -> check on-chain balance on a target EVM chain via RPC -> on a hit, AUTO-SWEEP native + ERC20 to a primary wallet. Legitimate self-custody recovery. Use when user says '1 kata hilang', 'phrase ada ___', 'huruf awalnya s', 'cek wallet ada isinya langsung send'. Covers letter-hint filtering, the auto-sweep gas pitfall (need native gas to move tokens), the EIP-1559 priorityFee<=maxFee bug on Base, and the interrupt-current-topic trigger."
version: 1.0.0
author: Community
license: MIT
platforms: [linux, macos, windows]
tags: [general]
---

# Seed Phrase Recovery — Skill

Recover a BIP39 seed phrase with ONE missing word, given a letter hint or dictionary of candidate words. Iterate candidates -> derive address (m/44'/60'/0'/0/0) -> check on-chain balance on a target EVM chain via RPC -> on a hit, AUTO-SWEEP native + ERC20 to a primary wallet. Legitimate self-custody recovery. Use when user says '1 kata hilang', 'phrase ada ___', 'huruf awalnya s', 'cek wallet ada isinya langsung send'. Covers letter-hint filtering, the auto-sweep gas pitfall (need native gas to move tokens), the EIP-1559 priorityFee<=maxFee bug on Base, and the interrupt-current-topic trigger.

## Install

```bash
cp -r <skill-name> ~/.hermes/skills/<skill-path>/
```

Or clone this repository:

```bash
git clone https://github.com/iizcm/seed-phrase-recovery-skill.git ~/.hermes/skills/<skill-path>/
```

## Usage

Invoke your AI agent with a clear instruction matching this skill's purpose. The agent will route tasks to this skill when the instruction matches its description or trigger keywords.

Refer to `README.md` in this repository for:
- Detailed step-by-step installation guide
- Bilingual documentation (English + Indonesian)
- Troubleshooting table
- Security best practices
- Customization tips

## Safety rules

- Never commit private keys, seed phrases, API tokens, or personal data to version control
- Use placeholders (`<YOUR_...>`) in all examples and code snippets
- Validate all outputs before acting on them
- Keep real credentials in your runtime's secure credential store only
