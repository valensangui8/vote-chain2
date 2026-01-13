import type { Abi } from "viem";
import { encodeFunctionData } from "viem";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SmartWallet = any;

export async function sendSmartWalletContractTx(params: {
  smartWallet: SmartWallet;
  to: `0x${string}`;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
}) {
  const { smartWallet, to, abi, functionName, args } = params;
  console.log("smartWallet", smartWallet);

  if (!smartWallet) {
    throw new Error("Smart wallet not ready. Ensure SmartWalletsProvider is configured and user is logged in.");
  }
  if (typeof smartWallet.sendTransaction !== "function") {
    throw new Error("Smart wallet does not expose sendTransaction. Check Privy smart wallets setup.");
  }

  const data = encodeFunctionData({
    abi,
    functionName: functionName as string,
    args: args as unknown[],
  });

  const result = await smartWallet.sendTransaction({ to, data });

  if (!result) {
    throw new Error("Transaction failed to send. Please try again.");
  }

  if (typeof result === "string") {
    return result;
  }

  if (typeof result.hash === "string") {
    return result.hash;
  }

  if (typeof result.transactionHash === "string") {
    return result.transactionHash;
  }

  throw new Error("Unexpected transaction response from wallet.");
}
