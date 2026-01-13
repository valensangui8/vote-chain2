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
import { CountdownTimer } from "@/app/components/CountdownTimer";

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
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [copiedCommitment, setCopiedCommitment] = useState(false);

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
      setLoadingInvitations(false);
      return;
    }

    try {
      setLoadingInvitations(true);
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
    } finally {
      setLoadingInvitations(false);
    }
  }

  function copyCommitment() {
    if (commitment) {
      navigator.clipboard.writeText(commitment);
      setCopiedCommitment(true);
      setTimeout(() => setCopiedCommitment(false), 2000);
      setToast("Commitment copied to clipboard!");
      setTimeout(() => setToast(null), 3000);
    }
  }

  function isEndingSoon(election: Invitation["elections"]): boolean {
    if (!election.ends_at) return false;
    const endDate = new Date(election.ends_at);
    const now = new Date();
    const hoursUntilEnd = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilEnd > 0 && hoursUntilEnd <= 24; // Less than 24 hours
  }

  function isNewInvitation(invitation: Invitation): boolean {
    // Since we don't have created_at in the type, we'll skip the "New" badge for now
    // This can be added later if the API returns this field
    return false;
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
      // NOTE: We do NOT send commitmentHash to Supabase to preserve voter anonymity.
      // The commitment is only registered on-chain where it cannot be linked to identity.
      const res = await fetch(`/api/invitations/${invitation.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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

  function hasElectionEnded(election: Invitation["elections"]): boolean {
    const now = new Date();
    
    // If status is explicitly "ended", it's ended
    if (election.status === "ended") return true;
    
    // Check if election has ended (compare with time)
    if (election.ends_at) {
      const endDate = new Date(election.ends_at);
      if (endDate.getTime() <= now.getTime()) {
        return true;
      }
    }
    
    return false;
  }

  const pendingInvitations = invitations.filter((i) => i.status === "pending");
  const acceptedInvitations = invitations.filter(
    (i) => i.status === "accepted" && isElectionActive(i.elections)
  );
  const endedElections = invitations.filter(
    (i) => i.status === "accepted" && !isElectionActive(i.elections) && hasElectionEnded(i.elections)
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10 px-6 mt-16">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-2">
          <span className="text-xs font-mono text-indigo-400">VOTER DASHBOARD</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Your Elections</h1>
        <p className="text-sm text-slate-400">
          View invitations and cast your anonymous zk vote.
        </p>
        {user?.email?.address && (
          <p className="text-xs text-slate-500">
            Logged in as: <span className="text-slate-300">{user.email.address.toLowerCase()}</span>
          </p>
        )}
      </header>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-6 border border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">Active Elections</p>
              <p className="text-4xl font-bold text-green-400">{acceptedInvitations.length}</p>
              <p className="text-xs text-slate-500 mt-2">Ready to vote</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-slate-500/20 bg-gradient-to-br from-slate-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">Ended Elections</p>
              <p className="text-4xl font-bold text-slate-300">{endedElections.length}</p>
              <p className="text-xs text-slate-500 mt-2">View results</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-slate-500/20 flex items-center justify-center">
              <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Identity */}
      <div className="glass rounded-2xl p-6 border border-indigo-500/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="h-5 w-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Your Identity
          </h3>
          {commitment && (
            <button
              onClick={copyCommitment}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-1.5"
              title="Copy commitment to clipboard"
            >
              {copiedCommitment ? (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          )}
        </div>
        <div className="mt-3 rounded-lg bg-black/30 border border-white/5 px-4 py-3 text-sm text-indigo-300 break-all relative">
          <span className="text-slate-400">Commitment:</span>
          <div className="mt-1 font-mono text-xs md:text-sm">{commitment ?? "generating..."}</div>
        </div>
        <p className="mt-3 text-xs text-slate-400 flex items-start gap-2">
          <svg className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>This identity is generated locally and stored in your browser. It's used to cast anonymous votes.</span>
        </p>
      </div>

      {/* Pending Invitations */}
      {loadingInvitations ? (
        <div className="glass rounded-2xl p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-slate-700/50 rounded w-48"></div>
            <div className="space-y-3">
              <div className="h-20 bg-slate-700/30 rounded-xl"></div>
              <div className="h-20 bg-slate-700/30 rounded-xl"></div>
            </div>
          </div>
        </div>
      ) : pendingInvitations.length > 0 ? (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            Pending Invitations
            <span className="ml-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
              {pendingInvitations.length}
            </span>
          </h3>
          <div className="space-y-3">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:border-indigo-500/30 transition-all duration-200"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-white">{inv.elections.name}</p>
                    {isNewInvitation(inv) && (
                      <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-300">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">
                    {inv.elections.ends_at
                      ? `Ends: ${new Date(inv.elections.ends_at).toLocaleDateString()}`
                      : "No end date"}
                  </p>
                </div>
                <button
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-500 hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
                  onClick={() => acceptInvitation(inv)}
                  disabled={!commitment || accepting === inv.id}
                >
                  {accepting === inv.id ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Accepting...
                    </span>
                  ) : (
                    "Accept"
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Accepted Elections - Can Vote */}
      {acceptedInvitations.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            Active Elections
            <span className="ml-2 rounded-full bg-green-500/20 border border-green-500/30 px-2.5 py-0.5 text-xs font-medium text-green-300">
              {acceptedInvitations.length}
            </span>
          </h3>
          <div className="space-y-4">
            {acceptedInvitations.map((inv) => (
              <div
                key={inv.id}
                onClick={() => router.push(`/voter/election/${inv.election_id}`)}
                className="rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer transition-all duration-200 hover:bg-white/10 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-white group-hover:text-indigo-300 transition-colors">{inv.elections.name}</p>
                      {isEndingSoon(inv.elections) && (
                        <span className="rounded-full bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 text-xs font-medium text-orange-300 animate-pulse">
                          Ending Soon
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      {inv.elections.ends_at
                        ? `Ends: ${new Date(inv.elections.ends_at).toLocaleString()}`
                        : "No end date"}
                    </p>
                  </div>
                  <span className="ml-4 rounded-full bg-green-500/10 border border-green-500/20 px-3 py-1 text-xs font-medium text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-3 flex items-center gap-1 group-hover:text-indigo-400 transition-colors">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Click to view candidates and vote
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ended Elections - View Results */}
      {endedElections.length > 0 && (
        <section className="rounded-2xl border border-slate-200 glass p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-white mb-4">Ended Elections</h3>
          <div className="space-y-4">
            {endedElections.map((inv) => (
              <div
                key={inv.id}
                className="rounded-lg border border-slate-200 p-4 glass"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-white">{inv.elections.name}</p>
                    <p className="text-sm text-slate-400 mt-1">
                      {inv.elections.ends_at
                        ? `Ended: ${new Date(inv.elections.ends_at).toLocaleString()}`
                        : "Ended"}
                    </p>
                  </div>
                  <span className="ml-4 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800">
                    Ended
                  </span>
                </div>
                <button
                  onClick={() => router.push(`/results/${inv.election_id}`)}
                  className="mt-3 w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500"
                >
                  📊 View Results
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loadingInvitations && invitations.length === 0 && authenticated && user?.email?.address && (
        <div className="glass rounded-2xl p-12 text-center border-dashed border-white/20">
          <div className="mx-auto h-20 w-20 text-slate-600 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-slate-300 font-medium mb-1">No invitations found</p>
          <p className="text-sm text-slate-400 mb-3">for <span className="text-white font-medium">{user.email.address.toLowerCase()}</span></p>
          <p className="text-xs text-slate-500">
            Make sure the organizer invited this exact email address.
          </p>
        </div>
      )}

      {!loadingInvitations && acceptedInvitations.length === 0 && pendingInvitations.length === 0 && invitations.length > 0 && (
        <div className="glass rounded-2xl p-12 text-center border-dashed border-white/20">
          <div className="mx-auto h-20 w-20 text-slate-600 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-slate-300 font-medium mb-1">No active elections</p>
          <p className="text-xs text-slate-400 mt-2">
            All your elections have ended or are not yet active.
          </p>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900/90 border border-indigo-500/50 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-indigo-500/10 backdrop-blur-md z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            {toast}
            <button
              onClick={() => setToast(null)}
              className="ml-3 text-slate-400 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

