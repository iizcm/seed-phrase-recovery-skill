const { ethers } = require("ethers");
const fs = require("fs");

// Usage:
//   node recover_loop.js "word1 word2 ___ word4 ..." words.txt
//   node recover_loop.js --phrase "..." --word CAND
// Edits at top for other chains.
// NOTE: recover_letter.js (letter-hint filtering) is the PREFERRED mode.

const PRIMARY = "0x732c86F49B2416D9D401070E8dBe59aC5e7331BF";
const RPCS = ["https://mainnet.base.org", "https://base-rpc.publicnode.com"];
const USDC  = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // native USDC (Base)
const USDBC = "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6c"; // bridged USDbC (Base)
const ERC20 = ["function balanceOf(address) view returns (uint256)","function decimals() view returns (uint8)"];

function parseArgs(){
  const a = process.argv.slice(2);
  let phrase=null, word=null, file=null;
  if (a.length===2 && a[0].includes("___") && fs.existsSync(a[1])) return {phrase:a[0], file:a[1]};
  for(let i=0;i<a.length;i++){
    if(a[i]==="--phrase") phrase=a[++i];
    else if(a[i]==="--word") word=a[++i];
    else if(a[i]==="--wordfile") file=a[++i];
  }
  if(!phrase && process.env.IN){ const m=process.env.IN.match(/phrase[:=]\s*([^\n]+)/i); if(m) phrase=m[1].trim(); }
  if(!word && process.env.IN){ const m=process.env.IN.match(/kata[:=]\s*(\S+)/i); if(m) word=m[1].trim(); }
  return {phrase, word, file};
}

function getWords({word,file}){
  if(word) return [word];
  if(file) return fs.readFileSync(file,"utf8").split(/\s+/).map(s=>s.trim()).filter(Boolean);
  return [];
}

async function pickProvider(){
  for(const u of RPCS){ try{ const p=new ethers.JsonRpcProvider(u); await p.getBlockNumber(); return p; }catch(e){ console.log("rpc fail",u); } }
  return null;
}

(async()=>{
  const {phrase, word, file} = parseArgs();
  if(!phrase || !phrase.includes("___")){ console.log("ERR: need phrase with ___ (and --word or --wordfile)"); process.exit(1); }
  const WORDS = getWords({word,file});
  if(!WORDS.length){ console.log("ERR: no words"); process.exit(1); }
  const provider = await pickProvider();
  if(!provider){ console.log("no RPC"); process.exit(1); }
  console.log("WORDS TO TRY:", WORDS.length);
  let found=null;
  for(const w of WORDS){
    const filled = phrase.replace("___", w);
    let wallet;
    try{ const m = ethers.Mnemonic.fromPhrase(filled); wallet = ethers.HDNodeWallet.fromMnemonic(m,"m/44'/60'/0'/0/0"); }
    catch(e){ continue; } // invalid checksum -> skip
    let eth=0n, usdc=0n, usdbc=0n;
    try{ eth = await provider.getBalance(wallet.address); }catch(e){}
    try{ usdc = await new ethers.Contract(USDC,ERC20,provider).balanceOf(wallet.address); }catch(e){}
    try{ usdbc = await new ethers.Contract(USDBC,ERC20,provider).balanceOf(wallet.address); }catch(e){}
    const has = eth>0n || usdc>0n || usdbc>0n;
    console.log(`${has?"**FOUND**":"  valid"} ${w.padEnd(10)} ${wallet.address} ETH=${ethers.formatEther(eth)} USDC=${ethers.formatUnits(usdc,6)}`);
    if(has){ found={w,wallet,eth,usdc,usdbc}; break; }
  }
  if(!found){ console.log("NONE FOUND in dict"); process.exit(0); }

  console.log(">>> AUTO-SWEEP ->", PRIMARY);
  const w = found.wallet.connect(provider);
  // EIP-1559: priorityFee MUST be <= maxFee. Base baseFee ~0.006 gwei -> set prio = fee (== baseFee).
  const fd = await provider.getFeeData();
  let fee = fd.gasPrice || 100000000n;
  if (fee > 100000000n) fee = 100000000n; // cap 0.1 gwei
  const maxP = fee;
  const prio = fee; // never exceeds maxP
  let swept=false;
  // TOKENS FIRST (user: USDC is what matters; ETH leftover irrelevant)
  if(found.usdc>0n){
    try{ const c=new ethers.Contract(USDC,[...ERC20,"function transfer(address,uint256)"],w); const tx=await c.transfer(PRIMARY,found.usdc,{maxFeePerGas:maxP,maxPriorityFeePerGas:prio}); console.log("USDC SWEEP:",tx.hash); await tx.wait(); swept=true; }
    catch(e){ console.log("USDC sweep err:", e.shortMessage||e.message.slice(0,60)); }
  }
  if(found.usdbc>0n){
    try{ const c=new ethers.Contract(USDBC,[...ERC20,"function transfer(address,uint256)"],w); const tx=await c.transfer(PRIMARY,found.usdbc,{maxFeePerGas:maxP,maxPriorityFeePerGas:prio}); console.log("USDbC SWEEP:",tx.hash); await tx.wait(); swept=true; }
    catch(e){ console.log("USDbC sweep err:", e.shortMessage||e.message.slice(0,60)); }
  }
  // ETH last (best-effort)
  const bal = await provider.getBalance(found.wallet.address);
  const need = 21000n * fee + 5000n;
  if(bal > need){
    const val = bal - 21000n*fee;
    try{ const tx = await w.sendTransaction({to:PRIMARY, value:val, maxFeePerGas:maxP, maxPriorityFeePerGas:prio, gasLimit:21000}); console.log("ETH SWEEP :", tx.hash); await tx.wait(); swept=true; }
    catch(e){ console.log("ETH err:", e.shortMessage||e.message.slice(0,50)); }
  } else { console.log("ETH sisa < gas, skip native"); }
  console.log(swept?"DONE -> "+PRIMARY:"NOTHING SENT");
})();
