const { ethers } = require("ethers");
const fs = require("fs");
const cp = require("child_process");

const PHRASE = process.argv[2];
const LETTER = (process.argv[3] || "").toLowerCase();
const PRIMARY = "0x732c86F49B2416D9D401070E8dBe59aC5e7331BF";
const RPCS = ["https://mainnet.base.org", "https://base-rpc.publicnode.com"];
const USDC  = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDBC = "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6c";
const ERC20 = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];

// ensure BIP39 wordlist present
if (!fs.existsSync("bip39.txt")) {
  console.log("bip39.txt missing, downloading...");
  cp.execSync("curl -s https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039/english.txt -o bip39.txt");
}
let ALL = fs.readFileSync("bip39.txt", "utf8").split(/\s+/).map(s => s.trim()).filter(Boolean);
let WORDS = LETTER ? ALL.filter(w => w[0] === LETTER) : ALL;

async function pickProvider() {
  for (const u of RPCS) {
    try { const p = new ethers.JsonRpcProvider(u); await p.getBlockNumber(); return p; }
    catch (e) { console.log("rpc fail", u); }
  }
  return null;
}

(async () => {
  if (!PHRASE || !PHRASE.includes("___")) { console.log("need phrase with ___ as argv[2]"); process.exit(1); }
  if (!LETTER) { console.log("need letter clue as argv[3]"); process.exit(1); }
  const provider = await pickProvider();
  if (!provider) { console.log("no RPC"); process.exit(1); }
  console.log(`LETTER: ${LETTER} | WORDS: ${WORDS.length}`);
  let found = null;
  for (const w of WORDS) {
    const filled = PHRASE.replace("___", w);
    let wallet;
    try { const m = ethers.Mnemonic.fromPhrase(filled); wallet = ethers.HDNodeWallet.fromMnemonic(m, "m/44'/60'/0'/0/0"); }
    catch (e) { continue; }
    let eth = 0n, usdc = 0n, usdbc = 0n;
    try { eth = await provider.getBalance(wallet.address); } catch (e) {}
    try { usdc = await new ethers.Contract(USDC, ERC20, provider).balanceOf(wallet.address); } catch (e) {}
    try { usdbc = await new ethers.Contract(USDBC, ERC20, provider).balanceOf(wallet.address); } catch (e) {}
    const has = eth > 0n || usdc > 0n || usdbc > 0n;
    const addr = wallet.address;
    if (has) console.log(`**FOUND** word=${w} | address=${addr} | ETH=${ethers.formatEther(eth)} | USDC=${ethers.formatUnits(usdc,6)} | USDbC=${ethers.formatUnits(usdbc,6)}`);
    else console.log(`  valid ${w} | address=${addr} | (empty)`);
    if (has) { found = { w, wallet, eth, usdc, usdbc }; break; }
  }
  if (!found) { console.log("NONE FOUND in letter", LETTER); process.exit(0); }

  const primary = PRIMARY; // main receiver
  console.log(">>> AUTO-SWEEP -> " + primary);
  console.log("source: " + found.wallet.address);
  const w = found.wallet.connect(provider);
  // EIP-1559: priorityFee MUST be <= maxFee. Base baseFee ~0.006 gwei -> set prio = fee (== baseFee).
  const fd = await provider.getFeeData();
  let fee = fd.gasPrice || 100000000n;
  if (fee > 100000000n) fee = 100000000n; // cap 0.1 gwei
  const maxP = fee;
  const prio = fee; // never exceeds maxP
  console.log("gasPrice:", ethers.formatUnits(maxP, "gwei"), "gwei");
  let swept = false;

  // TOKENS FIRST (user: USDC is what matters; ETH leftover irrelevant)
  if (found.usdc > 0n) {
    try { const c = new ethers.Contract(USDC, [...ERC20, "function transfer(address,uint256)"], w);
          const tx = await c.transfer(primary, found.usdc, { maxFeePerGas: maxP, maxPriorityFeePerGas: prio });
          console.log("USDC SWEEP:", tx.hash, "from", found.wallet.address, "->", primary); await tx.wait(); swept = true; }
    catch (e) { console.log("USDC err:", e.shortMessage || e.message.slice(0,60)); }
  }
  if (found.usdbc > 0n) {
    try { const c = new ethers.Contract(USDBC, [...ERC20, "function transfer(address,uint256)"], w);
          const tx = await c.transfer(primary, found.usdbc, { maxFeePerGas: maxP, maxPriorityFeePerGas: prio });
          console.log("USDbC SWEEP:", tx.hash, "from", found.wallet.address, "->", primary); await tx.wait(); swept = true; }
    catch (e) { console.log("USDbC err:", e.shortMessage || e.message.slice(0,60)); }
  }
  // ETH last (best-effort)
  const bal = await provider.getBalance(found.wallet.address);
  const need = 21000n * fee + 5000n;
  if (bal > need) {
    const val = bal - 21000n * fee;
    try { const tx = await w.sendTransaction({ to: primary, value: val, maxFeePerGas: maxP, maxPriorityFeePerGas: prio, gasLimit: 21000 });
          console.log("ETH SWEEP:", tx.hash, "from", found.wallet.address, "->", primary); await tx.wait(); swept = true; }
    catch (e) { console.log("ETH err:", e.shortMessage || e.message.slice(0,50)); }
  } else { console.log("ETH sisa < gas, skip native"); }
  console.log(swept ? ("DONE -> " + PRIMARY) : "NOTHING SENT");
})();
