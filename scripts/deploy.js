#!/usr/bin/env node

/**
 * VoteChain Contract Deployment Script
 * 
 * This script deploys all voting system contracts to the specified network.
 * 
 * Prerequisites:
 * 1. Set DEPLOYER_PRIVATE_KEY in .env.local
 * 2. Set NEXT_PUBLIC_RPC_URL in .env.local
 * 3. Have Sepolia ETH in the deployer wallet
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });

// Load compiled contract artifacts
const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts", "contracts");

function loadArtifact(contractName, fileName) {
  const artifactPath = path.join(ARTIFACTS_DIR, fileName, `${contractName}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}. Run 'npm run compile' first.`);
  }
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("     VoteChain Contract Deployment");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Check environment variables
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
  const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
  const SEMAPHORE_ADDRESS = process.env.NEXT_PUBLIC_SEMAPHORE_ADDRESS || "0x1e0d7FF1610e480fC93BdEC510811ea2Ba6d7c2f";

  if (!RPC_URL) {
    console.error("❌ NEXT_PUBLIC_RPC_URL not set in .env.local");
    process.exit(1);
  }
  if (!PRIVATE_KEY) {
    console.error("❌ DEPLOYER_PRIVATE_KEY not set in .env.local");
    process.exit(1);
  }

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Configuration:");
  console.log(`  RPC URL: ${RPC_URL.substring(0, 40)}...`);
  console.log(`  Deployer: ${wallet.address}`);
  
  const balance = await provider.getBalance(wallet.address);
  console.log(`  Balance: ${ethers.formatEther(balance)} ETH`);
  
  if (balance === 0n) {
    console.error("\n❌ Deployer wallet has no ETH! Get Sepolia ETH from a faucet.");
    process.exit(1);
  }

  console.log(`  Semaphore: ${SEMAPHORE_ADDRESS}`);

  // Load artifacts
  console.log("\n📦 Loading contract artifacts...");
  const GroupManagerArtifact = loadArtifact("GroupManager", "GroupManager.sol");
  const VotingArtifact = loadArtifact("Voting", "Voting.sol");

  console.log("  ✓ Artifacts loaded\n");

  // Deploy GroupManager
  console.log("📄 Deploying GroupManager...");
  const GroupManagerFactory = new ethers.ContractFactory(
    GroupManagerArtifact.abi,
    GroupManagerArtifact.bytecode,
    wallet
  );
  const groupManager = await GroupManagerFactory.deploy(SEMAPHORE_ADDRESS);
  await groupManager.waitForDeployment();
  const groupManagerAddress = await groupManager.getAddress();
  console.log(`   ✓ GroupManager deployed to: ${groupManagerAddress}`);

  // Deploy Voting
  console.log("\n📄 Deploying Voting...");
  const VotingFactory = new ethers.ContractFactory(
    VotingArtifact.abi,
    VotingArtifact.bytecode,
    wallet
  );
  const voting = await VotingFactory.deploy(SEMAPHORE_ADDRESS, groupManagerAddress);
  await voting.waitForDeployment();
  const votingAddress = await voting.getAddress();
  console.log(`   ✓ Voting deployed to: ${votingAddress}`);

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("     Deployment Summary");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log("Update your .env.local with these values:\n");
  console.log(`NEXT_PUBLIC_SEMAPHORE_ADDRESS=${SEMAPHORE_ADDRESS}`);
  console.log(`NEXT_PUBLIC_GROUP_MANAGER_CONTRACT=${groupManagerAddress}`);
  console.log(`NEXT_PUBLIC_VOTING_CONTRACT=${votingAddress}`);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("     ✅ Deployment Complete!");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Optionally update .env.local automatically
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf8");
    
    // Update contract addresses
    envContent = envContent.replace(
      /NEXT_PUBLIC_VOTING_CONTRACT=.*/,
      `NEXT_PUBLIC_VOTING_CONTRACT=${votingAddress}`
    );
    envContent = envContent.replace(
      /NEXT_PUBLIC_GROUP_MANAGER_CONTRACT=.*/,
      `NEXT_PUBLIC_GROUP_MANAGER_CONTRACT=${groupManagerAddress}`
    );
    
    fs.writeFileSync(envPath, envContent);
    console.log("✓ .env.local updated automatically!\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  });
