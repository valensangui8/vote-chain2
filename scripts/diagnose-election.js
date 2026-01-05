#!/usr/bin/env node

/**
 * Election Diagnostic Script
 * 
 * This script helps diagnose issues with elections on the blockchain.
 * Run with: node scripts/diagnose-election.js <onchainElectionId>
 */

const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const VOTING_CONTRACT = process.env.NEXT_PUBLIC_VOTING_CONTRACT;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;

// Different ABI versions to try
const ABI_VERSIONS = {
  // Current ABI (from compiled contracts)
  current: [
    "function elections(uint256) external view returns (uint256 id, uint256 groupId, uint256 externalNullifier, uint64 startsAt, uint64 endsAt, address owner, bool exists)",
    "function getCandidates(uint256 electionId) external view returns (tuple(uint256 id, string name, string image, uint256 voteCount)[])",
    "function nullifierUsed(uint256) external view returns (bool)",
    "event ElectionCreated(uint256 indexed electionId, uint256 indexed groupId, uint256 externalNullifier, uint64 startsAt, uint64 endsAt, address indexed owner)",
    "event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, uint256 nullifierHash, uint256 signal)",
    "event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name, string image)",
  ],
  // Alternative ABI (older version without 'id' field)
  alternative: [
    "function elections(uint256) external view returns (uint256 groupId, uint256 externalNullifier, uint64 startsAt, uint64 endsAt, address owner, bool exists)",
    "function getCandidates(uint256 electionId) external view returns (tuple(uint256 id, string name, string image, uint256 voteCount)[])",
  ],
  // Minimal ABI (just to check if contract responds)
  minimal: [
    "function semaphore() external view returns (address)",
    "function groupManager() external view returns (address)",
  ],
};

async function main() {
  const electionId = process.argv[2];
  
  if (!electionId) {
    console.log("Usage: node scripts/diagnose-election.js <onchainElectionId>");
    console.log("Example: node scripts/diagnose-election.js 17676212222822");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("     Election Diagnostic Tool");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log("Configuration:");
  console.log(`  RPC URL: ${RPC_URL ? RPC_URL.substring(0, 40) + "..." : "NOT SET"}`);
  console.log(`  Voting Contract: ${VOTING_CONTRACT || "NOT SET"}`);
  console.log(`  Election ID: ${electionId}`);
  console.log(`  Election ID (BigInt): ${BigInt(electionId).toString()}\n`);

  if (!RPC_URL || !VOTING_CONTRACT) {
    console.error("❌ Missing environment variables. Check .env.local");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Check if contract exists
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("     Step 1: Verify Contract Exists");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const code = await provider.getCode(VOTING_CONTRACT);
  if (code === "0x") {
    console.log("❌ No contract deployed at this address!");
    process.exit(1);
  }
  console.log(`✓ Contract exists at ${VOTING_CONTRACT}`);
  console.log(`  Bytecode length: ${code.length} characters\n`);

  // Try minimal ABI first
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("     Step 2: Test Contract Basic Functions");
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    const minimalContract = new ethers.Contract(VOTING_CONTRACT, ABI_VERSIONS.minimal, provider);
    
    const semaphoreAddr = await minimalContract.semaphore();
    console.log(`✓ semaphore(): ${semaphoreAddr}`);
    
    const groupManagerAddr = await minimalContract.groupManager();
    console.log(`✓ groupManager(): ${groupManagerAddr}`);
  } catch (err) {
    console.log(`❌ Basic functions failed: ${err.message}`);
  }

  // Try different ABI versions
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("     Step 3: Try Different ABI Versions");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const [name, abi] of Object.entries(ABI_VERSIONS)) {
    if (name === "minimal") continue;
    
    console.log(`\nTrying ${name} ABI...`);
    const contract = new ethers.Contract(VOTING_CONTRACT, abi, provider);
    
    try {
      const result = await contract.elections(BigInt(electionId));
      console.log(`✓ SUCCESS with ${name} ABI!`);
      console.log("  Election data:", {
        groupId: result.groupId?.toString(),
        externalNullifier: result.externalNullifier?.toString(),
        startsAt: result.startsAt?.toString(),
        endsAt: result.endsAt?.toString(),
        owner: result.owner,
        exists: result.exists,
        ...(result.id !== undefined && { id: result.id.toString() }),
      });
    } catch (err) {
      console.log(`❌ Failed with ${name} ABI: ${err.code || err.message}`);
    }
  }

  // Try raw call
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("     Step 4: Raw Contract Call");
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    const iface = new ethers.Interface(["function elections(uint256)"]);
    const calldata = iface.encodeFunctionData("elections", [BigInt(electionId)]);
    
    console.log(`Call data: ${calldata}`);
    
    const rawResult = await provider.call({
      to: VOTING_CONTRACT,
      data: calldata,
    });
    
    console.log(`Raw result: ${rawResult}`);
    
    if (rawResult === "0x") {
      console.log("\n⚠️  Contract returned empty data (0x)");
      console.log("   This usually means:");
      console.log("   1. The election ID doesn't exist in the contract");
      console.log("   2. Or the contract reverted silently");
    } else {
      console.log(`   Result length: ${rawResult.length} characters`);
    }
  } catch (err) {
    console.log(`❌ Raw call failed: ${err.message}`);
  }

  // Check events
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("     Step 5: Search for Events");
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    const contract = new ethers.Contract(VOTING_CONTRACT, ABI_VERSIONS.current, provider);
    
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000); // Last ~10000 blocks
    
    console.log(`Searching events from block ${fromBlock} to ${currentBlock}...`);
    
    // Search for ElectionCreated events
    const electionFilter = contract.filters.ElectionCreated(BigInt(electionId));
    const electionEvents = await contract.queryFilter(electionFilter, fromBlock);
    
    if (electionEvents.length > 0) {
      console.log(`\n✓ Found ${electionEvents.length} ElectionCreated event(s):`);
      for (const event of electionEvents) {
        console.log(`  - Block: ${event.blockNumber}, TxHash: ${event.transactionHash.substring(0, 20)}...`);
        console.log(`    Args:`, event.args);
      }
    } else {
      console.log(`❌ No ElectionCreated events found for election ${electionId}`);
    }

    // Search for VoteCast events
    const voteFilter = contract.filters.VoteCast(BigInt(electionId));
    const voteEvents = await contract.queryFilter(voteFilter, fromBlock);
    
    if (voteEvents.length > 0) {
      console.log(`\n✓ Found ${voteEvents.length} VoteCast event(s):`);
      for (const event of voteEvents) {
        console.log(`  - Block: ${event.blockNumber}, Candidate: ${event.args[1]?.toString()}`);
      }
    } else {
      console.log(`❌ No VoteCast events found for election ${electionId}`);
    }

    // Search for CandidateAdded events
    const candidateFilter = contract.filters.CandidateAdded(BigInt(electionId));
    const candidateEvents = await contract.queryFilter(candidateFilter, fromBlock);
    
    if (candidateEvents.length > 0) {
      console.log(`\n✓ Found ${candidateEvents.length} CandidateAdded event(s):`);
      for (const event of candidateEvents) {
        console.log(`  - Candidate #${event.args[1]?.toString()}: ${event.args[2]}`);
      }
    } else {
      console.log(`❌ No CandidateAdded events found for election ${electionId}`);
    }
    
  } catch (err) {
    console.log(`❌ Event search failed: ${err.message}`);
  }

  // Try getCandidates
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("     Step 6: Try getCandidates Directly");
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    const contract = new ethers.Contract(VOTING_CONTRACT, ABI_VERSIONS.current, provider);
    const candidates = await contract.getCandidates(BigInt(electionId));
    
    if (candidates.length > 0) {
      console.log(`✓ Found ${candidates.length} candidate(s):`);
      for (const c of candidates) {
        console.log(`  - ID: ${c.id?.toString()}, Name: ${c.name}, Votes: ${c.voteCount?.toString()}`);
      }
    } else {
      console.log("❌ No candidates found (empty array returned)");
    }
  } catch (err) {
    console.log(`❌ getCandidates failed: ${err.code || err.message}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("     Summary");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log("If election data returned 0x or failed, possible causes:");
  console.log("1. The election was never created on-chain (transaction failed)");
  console.log("2. The deployed contract has a different ABI than expected");
  console.log("3. The onchainElectionId doesn't match what's in the contract");
  console.log("\nRecommendations:");
  console.log("1. Check Etherscan for the contract and verify transactions");
  console.log(`   https://sepolia.etherscan.io/address/${VOTING_CONTRACT}`);
  console.log("2. If contract is outdated, redeploy with: npm run deploy:sepolia");
  console.log("3. Update .env.local with new contract addresses");
}

main().catch(console.error);

