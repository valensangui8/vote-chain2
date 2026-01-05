"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { parseAbi } from "viem";
import { createIdentity, getCommitment } from "@/lib/zk";
import { sendSmartWalletContractTx } from "@/lib/privy";
import { contracts } from "@/lib/ethers";
import { ethers } from "ethers";

type Invitation = {
  id: string;
  election_id: string;
  invitee_email: string;
  status: "pending" | "accepted" | "rejected";
  commitment_hash: string | null;
  elections: {
    id: string;
    name: string;
    status: string;
    onchain_election_id: string;
    onchain_group_id: string;
    external_nullifier: string;
    starts_at: string | null;
    ends_at: string | null;
  };
};

export default function VoterPage() {
  const router = useRouter();
  const { user, ready, authenticated, login } = usePrivy();
  const { client: smartWallet } = useSmartWallets();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [seed, setSeed] = useState("");
  const [commitment, setCommitment] = useState<string | null>(null);
  const [identity, setIdentity] = useState<any>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Helper to wait for transaction confirmation
  async function waitForTransaction(txHash: string, description: string = "Transaction") {
    console.log(`⏳ Waiting for ${description} to confirm...`, txHash.substring(0, 20) + "...");
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
    
    let attempts = 0;
    const maxAttempts = 40; // 40 * 3s = 2 minutes max
    
    while (attempts < maxAttempts) {
      try {
        const receipt = await provider.getTransactionReceipt(txHash);
        if (receipt) {
          if (receipt.status === 1) {
            console.log(`✓ ${description} confirmed!`, {
              blockNumber: receipt.blockNumber,
              gasUsed: receipt.gasUsed.toString(),
              txHash: txHash,
            });
            return receipt;
          } else {
            console.error(`❌ ${description} FAILED on blockchain!`, {
              status: receipt.status,
              blockNumber: receipt.blockNumber,
              txHash: txHash,
            });
            throw new Error(`${description} transaction failed on blockchain (status: 0). Check Sepolia explorer: https://sepolia.etherscan.io/tx/${txHash}`);
          }
        }
      } catch (err: any) {
        if (err.message?.includes("transaction failed")) {
          // Already handled above
          throw err;
        }
        // Transaction not yet mined, continue waiting
      }
      
      // Wait 3 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts++;
    }
    
    throw new Error(`${description} timed out after ${maxAttempts * 3} seconds. Check Sepolia explorer: https://sepolia.etherscan.io/tx/${txHash}`);
  }

  useEffect(() => {
    if (authenticated && user?.email?.address) {
      loadInvitations();
    }
  }, [authenticated, user?.email?.address]);

  useEffect(() => {
    // Wait for user to be authenticated before creating identity
    if (!user?.id) {
      return;
    }

    // Load identity from localStorage - unique per Privy user
    const seedKey = `voter_seed_${user.id}`;
    let savedSeed = localStorage.getItem(seedKey);
    
    // Migration: if old global seed exists and user doesn't have one, migrate it
    // BUT only for the first user - then delete the old seed so other users get their own
    const oldSeed = localStorage.getItem("voter_seed");
    if (!savedSeed && oldSeed) {
      savedSeed = oldSeed;
      localStorage.setItem(seedKey, savedSeed);
      localStorage.removeItem("voter_seed"); // Remove old seed so next user gets their own
      console.log("Migrated voter seed to user-specific key and removed old global seed");
    }
    
    // If no seed exists for this user, generate and save one
    if (!savedSeed) {
      savedSeed = Math.random().toString(36).substring(2);
      localStorage.setItem(seedKey, savedSeed);
      console.log("Generated new voter seed for user:", user.id.substring(0, 15) + "...");
    } else {
      console.log("Using existing voter seed for user:", user.id.substring(0, 15) + "...");
    }

    try {
      const id = createIdentity(savedSeed);
      setIdentity(id);
      const value = getCommitment(id).toString();
      setCommitment(value);
      console.log("🔑 Voter page - Identity loaded:", {
        userId: user.id.substring(0, 15) + "...",
        seed: savedSeed.substring(0, 10) + "...",
        commitment: value.substring(0, 20) + "...",
        fullCommitment: value,
      });
    } catch (err) {
      console.error("Failed to create identity:", err);
      setCommitment(null);
      setIdentity(null);
    }
  }, [user?.id]);

  async function loadInvitations() {
    if (!user?.email?.address) {
      console.log("No email address found in user object", user);
      return;
    }

    try {
      const email = user.email.address.toLowerCase().trim();
      console.log("Loading invitations for email:", email);
      
      const res = await fetch(`/api/invitations?email=${encodeURIComponent(email)}`);
      const body = await res.json();
      
      if (res.ok) {
        console.log("Loaded invitations:", body.invitations);
        setInvitations(body.invitations || []);
      } else {
        console.error("Failed to load invitations:", body.error);
      }
    } catch (err) {
      console.error("Failed to load invitations", err);
    }
  }

  function isElectionActive(election: Invitation["elections"]): boolean {
    const now = new Date();
    
    // If status is explicitly "ended", it's not active
    if (election.status === "ended") return false;
    
    // Check if election has ended (compare with time)
    if (election.ends_at) {
      const endDate = new Date(election.ends_at);
      // Compare timestamps to ensure we're checking time, not just date
      if (endDate.getTime() <= now.getTime()) {
        return false;
      }
    }
    
    // Check if election hasn't started yet (compare with time)
    if (election.starts_at) {
      const startDate = new Date(election.starts_at);
      // Compare timestamps to ensure we're checking time, not just date
      if (startDate.getTime() > now.getTime()) {
        return false;
      }
    }
    
    // If we get here, the election is active:
    // - It hasn't ended (or has no end date)
    // - It has started (or has no start date)
    // - Status is not "ended"
    return true;
  }

  async function acceptInvitation(invitation: Invitation) {
    if (!ready || !authenticated) {
      await login();
      return;
    }
    if (!smartWallet) {
      alert("Smart wallet not ready");
      return;
    }
    if (!commitment || !identity) {
      alert("Identity not generated. Please refresh the page.");
      return;
    }

    try {
      setAccepting(invitation.id);

      // 1) Accept invitation in Supabase
      const res = await fetch(`/api/invitations/${invitation.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commitmentHash: commitment,
          privyUserId: user?.id,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Failed to accept invitation");
      }

      const election = body.election;

      // Verify we have all required values
      if (!election?.onchainElectionId || !election?.onchainGroupId || !election?.id) {
        throw new Error("Election data incomplete. Please contact the organizer.");
      }

      if (!commitment) {
        throw new Error("Commitment not generated. Please refresh the page.");
      }

      // 2) Add commitment on-chain (Semaphore v4: no groupId needed, contract looks it up)
      const groupManagerAbi = parseAbi([
        "function addCommitment(uint256 electionId,uint256 identityCommitment)",
      ]);

      const txHash = await sendSmartWalletContractTx({
        smartWallet: smartWallet!,
        to: contracts.groupManager as `0x${string}`,
        abi: groupManagerAbi,
        functionName: "addCommitment",
        args: [
          BigInt(election.onchainElectionId),
          BigInt(commitment),
        ],
      });
      console.log("✓ addCommitment tx sent:", txHash);
      
      // Wait for confirmation
      setToast("Waiting for blockchain confirmation...");
      await waitForTransaction(txHash, "addCommitment");
      console.log("✓✓ Commitment CONFIRMED on blockchain!");

      // Reload invitations to show the accepted one in the list
      await loadInvitations();
      
      // Show success message - user can now click to vote
      setToast(`Invitation accepted! You can now vote in "${(invitation.elections as any).name}"`);
      setTimeout(() => setToast(null), 5000);
    } catch (err: any) {
      alert(err?.reason || err?.message || "Failed to accept invitation");
    } finally {
      setAccepting(null);
    }
  }

  const pendingInvitations = invitations.filter((i) => i.status === "pending");
  const acceptedInvitations = invitations.filter(
    (i) => i.status === "accepted" && isElectionActive(i.elections)
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">Voter</p>
        <h1 className="text-3xl font-bold text-slate-900">Your Elections</h1>
        <p className="text-sm text-slate-600">
          View invitations and cast your anonymous zk vote.
        </p>
        {user?.email?.address && (
          <p className="text-xs text-slate-600">
            Logged in as: {user.email.address.toLowerCase()}
          </p>
        )}
      </header>

      {/* Generate Identity */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Your Identity</h3>
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
          Commitment: <span className="font-mono">{commitment ?? "generating..."}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          This identity is generated locally and stored in your browser. It's used to cast anonymous votes.
        </p>
      </section>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Pending Invitations</h3>
          <div className="space-y-3">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-4"
              >
                <div>
                  <p className="font-medium text-slate-900">{inv.elections.name}</p>
                  <p className="text-sm text-slate-600">
                    {inv.elections.ends_at
                      ? `Ends: ${new Date(inv.elections.ends_at).toLocaleDateString()}`
                      : "No end date"}
                  </p>
                </div>
                <button
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
                  onClick={() => acceptInvitation(inv)}
                  disabled={!commitment || accepting === inv.id}
                >
                  {accepting === inv.id ? "Accepting..." : "Accept"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Accepted Elections - Can Vote */}
      {acceptedInvitations.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Active Elections</h3>
          <div className="space-y-4">
            {acceptedInvitations.map((inv) => (
              <div
                key={inv.id}
                onClick={() => router.push(`/voter/election/${inv.election_id}`)}
                className="rounded-lg border border-slate-200 p-4 cursor-pointer transition hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{inv.elections.name}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      {inv.elections.ends_at
                        ? `Ends: ${new Date(inv.elections.ends_at).toLocaleString()}`
                        : "No end date"}
                    </p>
                  </div>
                  <span className="ml-4 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">Click to view candidates and vote</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {invitations.length === 0 && authenticated && user?.email?.address && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-600">No invitations found for {user.email.address.toLowerCase()}.</p>
          <p className="text-xs text-slate-600 mt-2">
            Make sure the organizer invited this exact email address.
          </p>
        </div>
      )}

      {acceptedInvitations.length === 0 && pendingInvitations.length === 0 && invitations.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-700">No active elections available.</p>
          <p className="text-xs text-slate-600 mt-2">
            All your elections have ended or are not yet active.
          </p>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg z-50">
          {toast}
          <button
            onClick={() => setToast(null)}
            className="ml-3 text-white hover:text-indigo-200"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

