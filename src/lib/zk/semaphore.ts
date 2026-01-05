import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";

export function createIdentity(seed?: string) {
  return new Identity(seed);
}

export function getCommitment(identity: Identity) {
  return identity.commitment;
}

/**
 * Load a file from the public folder as Uint8Array
 * This is needed for snarkjs to read files in the browser
 */
async function loadFileAsUint8Array(filePath: string): Promise<Uint8Array> {
  try {
    console.log(`Loading file: ${filePath}`);
    const response = await fetch(filePath);
    
    if (!response.ok) {
      throw new Error(`Failed to load file ${filePath}: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    console.log(`✓ File loaded successfully: ${filePath} (${(uint8Array.length / 1024 / 1024).toFixed(2)} MB)`);
    
    return uint8Array;
  } catch (error) {
    console.error(`Error loading file ${filePath}:`, error);
    throw new Error(`Could not load file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function buildProof(params: {
  identity: Identity;
  group: Group;
  signal: bigint;
  externalNullifier: bigint;
}) {

  // Validate group
  if (!params.group) {
    throw new Error("Group is invalid or undefined");
  }

  // Check if group has members
  const memberCount = params.group.size || 0;
  if (memberCount === 0) {
    throw new Error(`Group has no members. Group size: ${memberCount}`);
  }

  // Get the depth - in Semaphore v4.14, depth is calculated automatically
  // But when there's only 1 member, depth is 0, which won't work with the circuit
  // The circuit was compiled with a fixed depth (typically 20), so we need to use that
  // We'll use a fixed depth of 20 (the circuit depth) regardless of the group's calculated depth
  const merkleTreeDepth = 20; // Fixed depth matching the circuit compilation

  console.log(`Building proof with group of ${memberCount} members, depth: ${merkleTreeDepth}`);
  console.log("Group structure:", {
    size: params.group.size,
    depth: params.group.depth,
    root: params.group.root?.toString(),
  });

  try {
    console.log("Calling generateProof with:", {
      identityCommitment: params.identity.commitment.toString(),
      groupDepth: params.group.depth,
      groupRoot: params.group.root?.toString(),
      signal: params.signal.toString(),
      externalNullifier: params.externalNullifier.toString(),
      merkleTreeDepth: merkleTreeDepth,
    });

    // Convert bigint to string for generateProof
    const message = params.signal.toString();
    const scope = params.externalNullifier.toString();
    
    console.log("Generating proof (artifacts will be auto-downloaded from Semaphore CDN)...");
    
    // Don't pass snarkArtifacts - let Semaphore SDK download them automatically from CDN
    // This is more reliable than trying to load local files
    const fullProof = await generateProof(
      params.identity,
      params.group,
      message, // message as string
      scope, // scope as string
      merkleTreeDepth // depth as number
      // snarkArtifacts omitted - SDK will auto-download from PSE CDN
    );

    console.log("Proof generated successfully:", {
      nullifier: fullProof.nullifier.toString(),
      pointsLength: fullProof.points?.length || 0,
      merkleTreeRoot: fullProof.merkleTreeRoot.toString(),
    });

    return {
      fullProof,
      // Return the packed Groth16 proof (points) for Solidity verification
      groth16Proof: fullProof.points,
    };
  } catch (error: any) {
    console.error("Error generating proof:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      groupStructure: params.group ? Object.keys(params.group) : "no group",
    });
    
    if (error.message && (error.message.includes("members is not iterable") || error.message.includes("not iterable"))) {
      throw new Error(`Group structure error: ${error.message}. This might be a Semaphore SDK version issue. Group depth: ${params.group.depth}, root: ${params.group.root?.toString()}`);
    }
    throw error;
  }
}

export function createGroupFromCommitments(commitments: (bigint | number | string)[], depth = 20) {
  if (!commitments || commitments.length === 0) {
    throw new Error("Cannot create group from empty commitments array");
  }
  
  // Ensure commitments are properly converted to BigInt
  const normalizedCommitments = commitments.map((c) => {
    if (typeof c === "string") {
      if (!c || c.trim() === "") {
        throw new Error("Empty commitment string found");
      }
      return BigInt(c);
    } else if (typeof c === "number") {
      return BigInt(c);
    } else if (typeof c === "bigint") {
      return c;
    }
    throw new Error(`Invalid commitment type: ${typeof c}`);
  });
  
  console.log(`Creating group with ${normalizedCommitments.length} commitments`);
  console.log("Commitments:", normalizedCommitments.map(c => c.toString()));
  
  let group: Group;
  try {
    // In Semaphore v4.14, Group constructor signature is: constructor(members?: BigNumber[])
    // It does NOT accept depth as a parameter - depth is calculated dynamically
    // We can either:
    // 1. Create empty group: new Group()
    // 2. Create group with members: new Group([member1, member2, ...])
    // 3. Create empty and add members: new Group() then addMember()
    
    // Option: Create group with all members at once (more efficient)
    console.log("Creating Group with members array...");
    group = new Group(normalizedCommitments);
    console.log("✓ Group created successfully with", group.size, "members");
    console.log("Group depth (calculated):", group.depth);
  } catch (err) {
    console.error("Error creating group with members array:", err);
    
    // Fallback: Create empty group and add members one by one
    try {
      console.log("Fallback: Creating empty group and adding members individually...");
      group = new Group();
      console.log("✓ Empty group created");
      
      normalizedCommitments.forEach((c, index) => {
        try {
          group.addMember(c);
          if ((index + 1) % 10 === 0 || index === normalizedCommitments.length - 1) {
            console.log(`Added ${index + 1}/${normalizedCommitments.length} members`);
          }
        } catch (addErr) {
          console.error(`Error adding member ${index} to group:`, addErr, "commitment:", c.toString());
          throw new Error(`Failed to add commitment ${index} to group: ${addErr instanceof Error ? addErr.message : String(addErr)}`);
        }
      });
      
      console.log("✓ All members added successfully");
    } catch (fallbackErr) {
      console.error("Error in fallback method:", fallbackErr);
      if (fallbackErr instanceof Error) {
        console.error("Error message:", fallbackErr.message);
        console.error("Error stack:", fallbackErr.stack);
      }
      throw fallbackErr;
    }
  }
  
  // Log group structure for debugging
  try {
    console.log(`Group created successfully. Group structure:`, {
      depth: group.depth,
      root: group.root?.toString(),
      hasMembers: 'members' in group,
      membersType: typeof (group as any).members,
      isArray: Array.isArray((group as any).members),
      size: (group as any).size,
      keys: Object.keys(group),
    });
  } catch (logErr) {
    console.warn("Could not log group structure:", logErr);
  }
  
  return group;
}


