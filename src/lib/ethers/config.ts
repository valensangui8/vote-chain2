export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "";

export const contracts = {
  voting: process.env.NEXT_PUBLIC_VOTING_CONTRACT || "",
  groupManager: process.env.NEXT_PUBLIC_GROUP_MANAGER_CONTRACT || "",
  semaphore: process.env.NEXT_PUBLIC_SEMAPHORE_ADDRESS || "",
};
