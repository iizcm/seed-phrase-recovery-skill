const { ethers } = require("ethers");
const fs = require("fs");
const cp = require("child_process");

// Config
const PRIMARY = "0x732c86F49B2416D9D401070E8dBe59aC5e7331BF";
const RPCS = ["https://mainnet.base.org", "https://base-rpc.publicnode.com"];
const BASESCAN_API = "https://api.basescan.org/api";

// Input: phrase with multiple ___ and hints (comma-separated)
// Example: node recover_multi_riddle.js "___ ___ flavor become dynamic demand ___ provide task worth ___ purse" "seseorang,sakit panas,lagi,3849-3846"
const PHRASE = process.argv[2];
const HINTS = (process.argv[3] || "").split(",").map(h => h.trim().toLowerCase());

// Ensure BIP39 wordlist
if (!fs.existsSync("bip39.txt")) {
  console.log("bip39.txt missing, downloading...");
  cp.execSync("curl -s https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039/english.txt -o bip39.txt");
}
const ALL_WORDS = fs.readFileSync("bip39.txt", "utf8").split(/\s+/).map(s => s.trim()).filter(Boolean);

// Parse hints into candidate lists
function parseHint(hint) {
  hint = hint.toLowerCase().trim();
  const candidates = new Set();
  
  // Direct BIP39 match
  if (ALL_WORDS.includes(hint)) {
    candidates.add(hint);
  }
  
  // Math: e.g., "3849-3846" -> 3 -> "three"
  const mathMatch = hint.match(/(\d+)[\s\-x*+]?(\d+)?/);
  if (mathMatch) {
    try {
      const expr = hint.replace(/x/g, "*");
      const result = eval(expr); // Simple math
      const numToWord = {1:"one",2:"two",3:"three",4:"four",5:"five",6:"six",7:"seven",8:"eight",9:"nine",10:"ten"};
      if (numToWord[result]) candidates.add(numToWord[result]);
    } catch (e) {}
  }
  
  // Synonyms/Translations (ID->EN)
  const synonymMap = {
    // People
    "seseorang": ["person", "human", "man", "woman", "individual", "someone", "people"],
    "manusia": ["person", "human", "man", "woman", "individual", "someone", "people"],
    // Health
    "sakit panas": ["fever", "sick", "hot", "ill", "temperature", "burn", "heat"],
    "sakit": ["sick", "ill", "pain", "hurt", "ache"],
    "panas": ["hot", "fever", "heat", "burn", "warm"],
    // Time/Repeat
    "lagi": ["again", "more", "repeat", "still", "extra", "another"],
    // Numbers
    "satu": ["one"], "dua": ["two"], "tiga": ["three"], "empat": ["four"],
    "lima": ["five"], "enam": ["six"], "tujuh": ["seven"], "delapan": ["eight"],
    "sembilan": ["nine"], "sepuluh": ["ten"]
  };
  
  if (synonymMap[hint]) {
    synonymMap[hint].forEach(word => {
      if (ALL_WORDS.includes(word)) candidates.add(word);
    });
  }
  
  // Add all BIP39 words starting with the hint (if hint is a letter)
  if (hint.length === 1 && hint >= 'a' && hint <= 'z') {
    ALL_WORDS.filter(w => w.startsWith(hint)).forEach(w => candidates.add(w));
  }
  
  // If hint is a number word (e.g., "three"), add it directly
  if (ALL_WORDS.includes(hint)) {
    candidates.add(hint);
  }
  
  return Array.from(candidates);
}

// Generate candidate lists for each hint
const candidateLists = HINTS.map(parseHint);
console.log("Hints parsed:", HINTS.map((h, i) => `${h} -> ${candidateLists[i].length} candidates`));

// Count ___ in phrase
const blanks = (PHRASE.match(/___/g) || []).length;
if (blanks !== HINTS.length) {
  console.log(`ERROR: ${blanks} blanks but ${HINTS.length} hints. Must match.`);
  process.exit(1);
}

// Get RPC provider
async function pickProvider() {
  for (const u of RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(u);
      await p.getBlockNumber();
      return p;
    } catch (e) {}
  }
  return null;
}

// Check tx history via Basescan API
async function hasTxHistory(address, provider) {
  try {
    // Fast check: getCode (if contract, skip)
    const code = await provider.getCode(address);
    if (code !== "0x") return false; // Contract, not EOA
    
    // Check tx count
    const txCount = await provider.getTransactionCount(address);
    if (txCount > 0) return true;
    
    // Fallback: Basescan API
    const url = `${BASESCAN_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&page=1&offset=1`;
    const res = await fetch(url);
    const data = await res.json();
    return data.result && data.result.length > 0;
  } catch (e) {
    return false;
  }
}

// Recursive combination generator
function* generateCombinations(lists, current = [], index = 0) {
  if (index === lists.length) {
    yield current;
    return;
  }
  for (const word of lists[index]) {
    yield* generateCombinations(lists, [...current, word], index + 1);
  }
}

(async () => {
  if (!PHRASE || !PHRASE.includes("___")) {
    console.log("Usage: node recover_multi_riddle.js '<phrase_with___>' '<hint1,hint2,...>'");
    process.exit(1);
  }
  
  const provider = await pickProvider();
  if (!provider) {
    console.log("No RPC available");
    process.exit(1);
  }
  
  console.log(`\nStarting recovery for: ${PHRASE}`);
  console.log(`Hints: ${HINTS.join(", ")}\n`);
  
  // Replace ___ with placeholders for combination
  const phraseParts = PHRASE.split(/\s+/);
  const blankIndices = [];
  phraseParts.forEach((part, i) => {
    if (part === "___") blankIndices.push(i);
  });
  
  // Generate all combinations
  const combinations = Array.from(generateCombinations(candidateLists));
  console.log(`Total combinations to test: ${combinations.length}\n`);
  
  let foundCount = 0;
  for (const combo of combinations) {
    // Build full phrase
    const fullPhrase = [...phraseParts];
    blankIndices.forEach((idx, i) => {
      fullPhrase[idx] = combo[i];
    });
    const phraseStr = fullPhrase.join(" ");
    
    // Try to derive
    let wallet;
    try {
      const m = ethers.Mnemonic.fromPhrase(phraseStr);
      wallet = ethers.HDNodeWallet.fromMnemonic(m, "m/44'/60'/0'/0/0");
    } catch (e) {
      continue; // Invalid checksum
    }
    
    const addr = wallet.address;
    
    // Check tx history (not just balance)
    const hasHistory = await hasTxHistory(addr, provider);
    
    if (hasHistory) {
      console.log(`**FOUND** | phrase: ${phraseStr}`);
      console.log(`  address: ${addr}`);
      console.log(`  TX HISTORY: YES`);
      
      // Get balance info too
      try {
        const eth = await provider.getBalance(addr);
        console.log(`  ETH: ${ethers.formatEther(eth)}`);
      } catch (e) {}
      
      foundCount++;
    } else {
      if (foundCount % 100 === 0) {
        process.stdout.write(`\rTested ${foundCount} combinations...`);
      }
    }
  }
  
  if (foundCount === 0) {
    console.log("\nNO MATCHES FOUND with tx history.");
  } else {
    console.log(`\nDONE. Found ${foundCount} wallet(s) with tx history.`);
  }
})();
