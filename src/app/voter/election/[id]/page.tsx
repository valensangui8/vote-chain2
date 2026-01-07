"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { parseAbi } from "viem";
import { createIdentity, getCommitment, buildProof, createGroupFromCommitments } from "@/lib/zk";
import { sendSmartWalletContractTx } from "@/lib/privy";
import { contracts } from "@/lib/ethers";
import { ethers } from "ethers";

type Candidate = {
  id: string;
  name: string;
  image_url: string | null;
  created_at: string;
};

type Election = {
  id: string;
  name: string;
  status: string;
  onchain_election_id: string;
  onchain_group_id: string;
  external_nullifier: string;
  starts_at: string | null;
  ends_at: string | null;
};

type Invitation = {
  id: string;
  election_id: string;
  status: "pending" | "accepted" | "rejected";
  elections: Election;
};

export default function ElectionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, ready, authenticated, login } = usePrivy();
  const { client: smartWallet } = useSmartWallets();
  const electionId = params?.id as string;

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [identity, setIdentity] = useState<any>(null);
  const [commitment, setCommitment] = useState<string | null>(null);
  const [proofStatus, setProofStatus] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  // Check if already voted on mount
  useEffect(() => {
    if (electionId) {
      const voted = localStorage.getItem(`voted_${electionId}`);
      if (voted === "true") {
        setHasVoted(true);
        setProofStatus("You have already voted in this election");
      }
    }
  }, [electionId]);

  useEffect(() => {
    if (authenticated && user?.email?.address && electionId) {
      loadInvitationAndCandidates();
    }
  }, [authenticated, user?.email?.address, electionId]);

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
      console.log("🔑 Election page - Identity loaded:", {
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

  async function loadInvitationAndCandidates() {
    try {
      // Load invitation
      const invRes = await fetch(`/api/invitations?email=${encodeURIComponent(user?.email?.address?.toLowerCase() || "")}&electionId=${electionId}`);
      const invBody = await invRes.json();
      if (invRes.ok && invBody.invitations && invBody.invitations.length > 0) {
        setInvitation(invBody.invitations[0]);
      }

      // Load candidates
      const candRes = await fetch(`/api/candidates?electionId=${electionId}`);
      const candBody = await candRes.json();
      if (candRes.ok) {
        setCandidates(candBody.candidates || []);
      }
    } catch (err) {
      console.error("Failed to load data", err);
    }
  }

  function isElectionActive(election: Election): boolean {
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

  async function submitVote() {
    if (!selectedCandidate) {
      setProofStatus("Please select a candidate first");
      return;
    }
    if (!invitation || invitation.status !== "accepted") {
      setProofStatus("Please accept the invitation first");
      return;
    }
    if (!ready || !authenticated) {
      setProofStatus("Please sign in first");
      await login();
      return;
    }
    if (!smartWallet) {
      setProofStatus("Smart wallet not ready");
      return;
    }
    if (!identity || !commitment) {
      setProofStatus("Identity not generated. Please refresh the page.");
      return;
    }

    const election = invitation.elections;
    if (!isElectionActive(election)) {
      setProofStatus("This election has ended");
      return;
    }

    try {
      setVoting(true);
      setProofStatus("Loading on-chain group members...");

      // Read commitments directly from on-chain events to ensure correct order
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
      const groupId = BigInt(election.onchain_group_id);

      // Get MemberAdded events from Semaphore contract for this group
      const semaphoreInterface = new ethers.Interface([
        "event MemberAdded(uint256 indexed groupId, uint256 index, uint256 identityCommitment, uint256 merkleTreeRoot)"
      ]);

      // Query events (last 10000 blocks should be enough for recent elections)
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000);

      const logs = await provider.getLogs({
        address: contracts.semaphore,
        topics: [
          ethers.id("MemberAdded(uint256,uint256,uint256,uint256)"),
          ethers.toBeHex(groupId, 32), // groupId is indexed
        ],
        fromBlock,
        toBlock: "latest",
      });

      console.log(`📊 Found ${logs.length} MemberAdded events for group ${groupId.toString()}`);

      // Parse events and extract commitments in order
      const commitments: bigint[] = logs
        .map((log) => {
          const parsed = semaphoreInterface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          return {
            index: Number(parsed?.args[1]),
            commitment: BigInt(parsed?.args[2]),
          };
        })
        .sort((a, b) => a.index - b.index) // Sort by index to ensure correct order
        .map((item) => item.commitment);

      if (!commitments.length) {
        throw new Error("No members found on-chain for this election group. Please accept the invitation first.");
      }

      console.log("📊 On-chain commitments:", commitments.map(c => c.toString().substring(0, 20) + "..."));

      const depth = 20;
      const group = createGroupFromCommitments(commitments, depth);
      const externalNullifier = BigInt(election.external_nullifier);

      // Verify our commitment is in the group
      const myCommitment = getCommitment(identity).toString();
      const isInGroup = commitments.some((c: bigint) => c.toString() === myCommitment);

      console.log("✓ Commitment verification:", {
        myCommitment: myCommitment.substring(0, 20) + "...",
        groupSize: commitments.length,
        isInGroup,
      });

      if (!isInGroup) {
        throw new Error(
          `Your identity commitment is not registered on-chain for this election. ` +
          `This can happen if the accept invitation transaction failed or is still pending. ` +
          `Please go back to the voter dashboard and try accepting the invitation again.`
        );
      }

      // Use candidate index (1-based) as signal
      const candidateIndex = candidates.findIndex((c) => c.id === selectedCandidate.id) + 1;
      const signalBig = BigInt(candidateIndex);

      setProofStatus("Generating zk proof...");
      const { fullProof } = await buildProof({
        identity,
        group,
        signal: signalBig,
        externalNullifier,
      });

      console.log("✓ Proof received:", {
        nullifier: fullProof.nullifier.toString(),
        merkleTreeRoot: fullProof.merkleTreeRoot.toString(),
        merkleTreeDepth: fullProof.merkleTreeDepth,
        message: fullProof.message.toString(),
        scope: fullProof.scope.toString(),
        pointsLength: fullProof.points.length,
      });

      // Build the SemaphoreProof struct for Semaphore v4
      // SemaphoreProof = (merkleTreeDepth, merkleTreeRoot, nullifier, message, scope, points[8])
      const semaphoreProof = {
        merkleTreeDepth: BigInt(fullProof.merkleTreeDepth),
        merkleTreeRoot: BigInt(fullProof.merkleTreeRoot),
        nullifier: BigInt(fullProof.nullifier),
        message: signalBig, // message = candidateId
        scope: externalNullifier, // scope = election's external nullifier
        points: fullProof.points.map((p: string | bigint) => BigInt(p)) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
      };

      console.log("Submitting vote with Semaphore v4 proof:", {
        electionId: election.onchain_election_id,
        candidateId: signalBig.toString(),
        proof: {
          merkleTreeDepth: semaphoreProof.merkleTreeDepth.toString(),
          merkleTreeRoot: semaphoreProof.merkleTreeRoot.toString().substring(0, 20) + "...",
          nullifier: semaphoreProof.nullifier.toString().substring(0, 20) + "...",
          message: semaphoreProof.message.toString(),
          scope: semaphoreProof.scope.toString(),
          pointsLength: semaphoreProof.points.length,
        },
      });

      // Semaphore v4 castVote uses a struct/tuple for the proof
      const votingAbi = parseAbi([
        "function castVote(uint256 electionId, uint256 candidateId, (uint256 merkleTreeDepth, uint256 merkleTreeRoot, uint256 nullifier, uint256 message, uint256 scope, uint256[8] points) proof)",
      ]);

      setProofStatus("Submitting vote on-chain...");
      const txHash = await sendSmartWalletContractTx({
        smartWallet,
        to: contracts.voting as `0x${string}`,
        abi: votingAbi,
        functionName: "castVote",
        args: [
          BigInt(election.onchain_election_id),
          signalBig, // candidateId (1-based index)
          semaphoreProof,
        ],
      });

      setProofStatus(`✓ Vote submitted successfully! Tx: ${txHash.substring(0, 10)}...`);
      setHasVoted(true);

      // Save to localStorage for persistence
      localStorage.setItem(`voted_${election.id}`, "true");

      // Save vote to Supabase for tracking
      try {
        // Note: We only log non-identifying information
        console.log("💾 Saving vote to Supabase:", {
          electionId: election.id,
          nullifier: semaphoreProof.nullifier.toString().substring(0, 20) + "...",
          message: semaphoreProof.message.toString(),
          txHash: txHash.substring(0, 20) + "...",
          // privyUserId intentionally not logged to preserve anonymity
        });

        // IMPORTANT: Do NOT send voterPrivyUserId to preserve voter anonymity
        // The nullifier is sufficient to prevent double voting
        const saveRes = await fetch("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            electionId: election.id, // Supabase election UUID
            nullifierHash: semaphoreProof.nullifier.toString(),
            signal: semaphoreProof.message.toString(),
            txHash,
            // voterPrivyUserId intentionally omitted to preserve anonymity
          }),
        });

        const saveBody = await saveRes.json();
        if (!saveRes.ok) {
          console.error("❌ Failed to save vote to Supabase:", saveBody);
        } else {
          console.log("✓ Vote saved to Supabase successfully");
        }
      } catch (saveErr) {
        console.error("Failed to save vote to Supabase:", saveErr);
      }

      // Redirect after 3 seconds
      setTimeout(() => {
        router.push("/voter");
      }, 3000);
    } catch (err: any) {
      console.error("❌ Vote submission error:", err);
      console.error("Error details:", {
        message: err?.message,
        reason: err?.reason,
        code: err?.code,
        data: err?.data,
      });

      // Check if it's a duplicate vote error
      const errorMessage = err?.message?.toLowerCase() || "";
      const errorReason = err?.reason?.toLowerCase() || "";
      const errorData = JSON.stringify(err?.data || "").toLowerCase();

      if (
        errorMessage.includes("nullifieralreadyused") ||
        errorMessage.includes("already used") ||
        errorReason.includes("nullifieralreadyused") ||
        errorReason.includes("already used") ||
        errorData.includes("nullifieralreadyused")
      ) {
        console.log("🚫 Duplicate vote detected!");
        setProofStatus("You have already voted in this election!");
        setHasVoted(true);
      } else {
        setProofStatus(err?.reason || err?.message || "Failed to submit vote");
      }
    } finally {
      setVoting(false);
    }
  }

  if (!invitation) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-600">Loading election...</p>
        </div>
      </div>
    );
  }

  const election = invitation.elections;
  const isActive = isElectionActive(election);

  if (!isActive) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-600">This election has ended.</p>
          <button
            onClick={() => router.push("/voter")}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Back to Elections
          </button>
        </div>
      </div>
    );
  }

  if (invitation.status !== "accepted") {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-600">Please accept the invitation first.</p>
          <button
            onClick={() => router.push("/voter")}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Back to Elections
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10 mt-20">
      <button
        onClick={() => router.push("/voter")}
        className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition w-fit"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to My Elections
      </button>

      {/* Already Voted Banner */}
      {hasVoted && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-900">You have already voted in this election</h3>
              <p className="mt-1 text-sm text-amber-800">
                Each voter can only cast one vote per election. This ensures fairness and prevents manipulation.
                Your vote has been recorded anonymously on the blockchain.
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Your vote is secured by zero-knowledge cryptography</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">Election</p>
        <h1 className="text-3xl font-bold text-slate-600">{election.name}</h1>
        <p className="text-sm text-slate-400">
          {hasVoted ? "You can view the candidates below" : "Select a candidate to cast your anonymous vote"}
        </p>
      </header>

      {candidates.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-600">No candidates available for this election.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {candidates.map((candidate, index) => (
              <button
                key={candidate.id}
                onClick={() => setSelectedCandidate(candidate)}
                disabled={voting || hasVoted}
                className={`rounded-2xl border-2 p-6 text-left transition ${selectedCandidate?.id === candidate.id
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md"
                  } ${voting ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {candidate.image_url ? (
                  <img
                    src={candidate.image_url}
                    alt={candidate.name}
                    className="mb-4 h-32 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="mb-4 flex h-32 w-full items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    No image
                  </div>
                )}
                <h3 className="text-lg font-semibold text-slate-900">{candidate.name}</h3>
                {selectedCandidate?.id === candidate.id && (
                  <p className="mt-2 text-sm text-indigo-600">Selected ✓</p>
                )}
              </button>
            ))}
          </div>

          {selectedCandidate && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Selected candidate:</p>
                  <p className="text-lg font-semibold text-slate-900">{selectedCandidate.name}</p>
                </div>
                <button
                  onClick={submitVote}
                  disabled={voting || hasVoted}
                  className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {hasVoted ? "Already Voted ✓" : voting ? "Submitting..." : "Submit Vote"}
                </button>
              </div>
              {proofStatus && (
                <div className="mt-4 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                  {proofStatus}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

