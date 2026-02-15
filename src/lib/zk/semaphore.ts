import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";

export function createIdentity(seed?: string) {
  return new Identity(seed);
}

export function getCommitment(identity: Identity) {
  return identity.commitment;
}

export async function buildProof(params: {
  identity: Identity;
  group: Group;
  signal: bigint;
  externalNullifier: bigint;
}) {
  if (!params.group) {
    throw new Error("Group is invalid or undefined");
  }

  const memberCount = params.group.size || 0;
  if (memberCount === 0) {
    throw new Error(`Group has no members. Group size: ${memberCount}`);
  }

  const merkleTreeDepth = 20;

  try {
    const message = params.signal.toString();
    const scope = params.externalNullifier.toString();

    const fullProof = await generateProof(
      params.identity,
      params.group,
      message,
      scope,
      merkleTreeDepth
    );

    return {
      fullProof,
      groth16Proof: fullProof.points,
    };
  } catch (error: any) {
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

  let group: Group;
  try {
    group = new Group(normalizedCommitments);
  } catch {
    group = new Group();
    normalizedCommitments.forEach((c, index) => {
      try {
        group.addMember(c);
      } catch (addErr) {
        throw new Error(`Failed to add commitment ${index} to group: ${addErr instanceof Error ? addErr.message : String(addErr)}`);
      }
    });
  }

  return group;
}
