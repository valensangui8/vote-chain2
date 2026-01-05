// Helper to generate unique on-chain IDs from timestamp + random component
export function generateOnChainElectionId(): string {
  // Use timestamp (seconds since epoch) as base, add random 4-digit suffix
  const timestamp = Math.floor(Date.now() / 1000);
  const random = Math.floor(Math.random() * 10000);
  return `${timestamp}${random}`;
}

export function generateGroupId(): string {
  // Group ID: timestamp + random 5-digit suffix
  const timestamp = Math.floor(Date.now() / 1000);
  const random = Math.floor(Math.random() * 100000);
  return `${timestamp}${random}`;
}

export function generateExternalNullifier(): string {
  // External nullifier: timestamp + random 6-digit suffix
  const timestamp = Math.floor(Date.now() / 1000);
  const random = Math.floor(Math.random() * 1000000);
  return `${timestamp}${random}`;
}

