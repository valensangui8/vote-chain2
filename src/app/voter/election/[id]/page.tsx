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
import { CountdownTimer } from "@/app/components/CountdownTimer";

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
  const [txHashForDisplay, setTxHashForDisplay] = useState<string | null>(null);
  const [showReRegisterAction, setShowReRegisterAction] = useState(false);

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
    if (!user?.id) return;

    const seedKey = `voter_seed_${user.id}`;
    let savedSeed = localStorage.getItem(seedKey);

    const oldSeed = localStorage.getItem("voter_seed");
    if (!savedSeed && oldSeed) {
      savedSeed = oldSeed;
      localStorage.setItem(seedKey, savedSeed);
      localStorage.removeItem("voter_seed");
    }

    if (!savedSeed) {
      savedSeed = Math.random().toString(36).substring(2);
      localStorage.setItem(seedKey, savedSeed);
    }

    try {
      const id = createIdentity(savedSeed);
      setIdentity(id);
      setCommitment(getCommitment(id).toString());
    } catch {
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
    } catch {
      // Ignore load errors
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
    setShowReRegisterAction(false);
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

      // Retry logic to handle race condition where events aren't indexed immediately
      let logs: any[] = [];
      let retryCount = 0;
      const maxRetries = 5;
      
      while (retryCount < maxRetries) {
        logs = await provider.getLogs({
          address: contracts.semaphore,
          topics: [
            ethers.id("MemberAdded(uint256,uint256,uint256,uint256)"),
            ethers.toBeHex(groupId, 32), // groupId is indexed
          ],
          fromBlock,
          toBlock: "latest",
        });

        const myCommitmentBigInt = getCommitment(identity);
        const foundInLogs = logs.some((log) => {
          try {
            const parsed = semaphoreInterface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
            return BigInt(parsed?.args[2]).toString() === myCommitmentBigInt.toString();
          } catch {
            return false;
          }
        });

        if (foundInLogs || logs.length > 0) {
          if (foundInLogs) break;
          if (retryCount > 0) {
            break;
          }
        }

        if (retryCount < maxRetries - 1) {
          const waitTime = (retryCount + 1) * 2000;
          setProofStatus(`Waiting for blockchain events to be indexed... (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        retryCount++;
      }

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
        .sort((a, b) => a.index - b.index)
        .map((item) => item.commitment);

      if (!commitments.length) {
        throw new Error("No members found on-chain for this election group. Please accept the invitation first.");
      }

      const depth = 20;
      const group = createGroupFromCommitments(commitments, depth);
      const externalNullifier = BigInt(election.external_nullifier);

      const myCommitment = getCommitment(identity).toString();
      const isInGroup = commitments.some((c: bigint) => c.toString() === myCommitment);

      if (!isInGroup) {
        throw new Error(
          `Your identity commitment is not registered on-chain yet for this election. ` +
          `Go back to the voter dashboard, click the 🔄 Re-register button for this election and try voting again.`
        );
      }

      const candidateIndex = candidates.findIndex((c) => c.id === selectedCandidate.id) + 1;
      const signalBig = BigInt(candidateIndex);

      setProofStatus("Generating zk proof...");
      const { fullProof } = await buildProof({
        identity,
        group,
        signal: signalBig,
        externalNullifier,
      });

      const semaphoreProof = {
        merkleTreeDepth: BigInt(fullProof.merkleTreeDepth),
        merkleTreeRoot: BigInt(fullProof.merkleTreeRoot),
        nullifier: BigInt(fullProof.nullifier),
        message: signalBig,
        scope: externalNullifier,
        points: fullProof.points.map((p: string | bigint) => BigInt(p)) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
      };

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
          signalBig,
          semaphoreProof,
        ],
      });

      setTxHashForDisplay(txHash);
      setProofStatus("✓ Vote submitted! Copy your transaction hash below to verify on Etherscan. It will only be shown once on this screen.");
      setHasVoted(true);
      setShowReRegisterAction(false);

      localStorage.setItem(`voted_${election.id}`, "true");

      try {
        const emailRes = await fetch("/api/votes/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            electionId: election.id,
            voterEmail: user?.email?.address || "",
          }),
        });
      } catch {
        // Email failure should not affect vote
      }

      try {
        const saveRes = await fetch("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            electionId: election.id,
            nullifierHash: semaphoreProof.nullifier.toString(),
            signal: semaphoreProof.message.toString(),
          }),
        });
        if (!saveRes.ok) await saveRes.json();
      } catch {
        // Vote already on-chain; Supabase sync is secondary
      }
    } catch (err: any) {
      const errorMessage = err?.message?.toLowerCase() || "";
      const errorReason = err?.reason?.toLowerCase() || "";
      const errorData = JSON.stringify(err?.data || "").toLowerCase();
      const needsReRegister =
        errorMessage.includes("identity commitment is not registered") ||
        errorMessage.includes("no members found on-chain");

      if (needsReRegister) {
        localStorage.setItem(`reregister_needed_${election.id}`, "true");
        setShowReRegisterAction(true);
      }

      if (
        errorMessage.includes("nullifieralreadyused") ||
        errorMessage.includes("already used") ||
        errorReason.includes("nullifieralreadyused") ||
        errorReason.includes("already used") ||
        errorData.includes("nullifieralreadyused")
      ) {
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
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10 mt-20">
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
        <div className="rounded-2xl border border-slate-200 mt-20 glass p-12 text-center">
          <p className="text-slate-600">This election has ended.</p>
          <button
            onClick={() => router.push("/voter")}
            className="mt-4 rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-500"
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

      {txHashForDisplay && (
        <div className="mt-6 glass rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-indigo-200">Transaction hash (shown only once)</p>
              <p className="text-xs text-indigo-200/80">Copy and save this hash now to verify your vote on Etherscan. If you refresh or leave, it will not be shown again.</p>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-indigo-500/30 bg-black/30 p-3 font-mono text-sm text-indigo-100">
              <div className="flex-1 break-all">{txHashForDisplay}</div>
              <button
                onClick={() => txHashForDisplay && navigator.clipboard.writeText(txHashForDisplay)}
                title="Copy hash"
                className="cursor-pointer rounded-md border border-indigo-500/40 bg-indigo-500/10 p-2 text-indigo-100 hover:border-indigo-300 hover:text-indigo-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => txHashForDisplay && navigator.clipboard.writeText(txHashForDisplay)}
                className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Copy hash
              </button>
              <a
                href={`https://sepolia.etherscan.io/tx/${txHashForDisplay}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-indigo-500/40 px-4 py-2 text-sm font-semibold text-indigo-100 hover:border-indigo-300 hover:text-indigo-50"
              >
                Verify on Etherscan →
              </a>
            </div>
            <p className="text-xs text-amber-200">
              This is the only on-screen copy of your transaction hash. We do not email it or store it alongside your identity.
            </p>
          </div>
        </div>
      )}

      <header className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">Election</p>
            <h1 className="text-3xl font-bold text-white mt-2">{election.name}</h1>
            <p className="text-sm text-slate-400 mt-2">
              {hasVoted ? "You can view the candidates below" : "Select a candidate to cast your anonymous vote"}
            </p>
          </div>
          {election.ends_at && (
            <div className="glass rounded-xl p-4 border border-indigo-500/20 min-w-[180px]">
              <p className="text-xs text-slate-400 mb-1">Time Remaining</p>
              <CountdownTimer 
                endsAt={election.ends_at}
                startsAt={election.starts_at}
                className="text-lg font-semibold"
                showSeconds={true}
              />
            </div>
          )}
        </div>
      </header>

      {candidates.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 p-12 text-center">
          <div className="mx-auto h-16 w-16 text-slate-600 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-slate-300 font-medium mb-1">No candidates available</p>
          <p className="text-sm text-slate-400">The organizer hasn't added any candidates yet.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-400 mb-4">
            {hasVoted ? "You've already voted. Candidates are shown below." : "Select a candidate to cast your vote"}
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {candidates.map((candidate, index) => (
              <button
                key={candidate.id}
                onClick={() => !hasVoted && !voting && setSelectedCandidate(candidate)}
                disabled={voting || hasVoted}
                className={`glass rounded-2xl border-2 p-6 text-left transition-all duration-200 ${
                  selectedCandidate?.id === candidate.id
                    ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20 scale-[1.02]"
                    : "border-white/10 bg-white/5 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 hover:scale-[1.02]"
                } ${voting || hasVoted ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {candidate.image_url ? (
                  <img
                    src={candidate.image_url}
                    alt={candidate.name}
                    className="mb-4 h-32 w-full rounded-lg object-cover border border-white/10"
                  />
                ) : (
                  <div className="mb-4 flex h-32 w-full items-center justify-center rounded-lg bg-slate-700/50 border border-white/10 text-slate-500">
                    <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <h3 className="text-lg font-semibold text-white">{candidate.name}</h3>
                {selectedCandidate?.id === candidate.id && (
                  <p className="mt-2 text-sm text-indigo-400 flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Selected
                  </p>
                )}
              </button>
            ))}
          </div>

          {selectedCandidate && !hasVoted && (
            <div className="glass rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Selected candidate:</p>
                  <p className="text-lg font-semibold text-white">{selectedCandidate.name}</p>
                </div>
                <button
                  onClick={submitVote}
                  disabled={voting || hasVoted}
                  className="rounded-lg bg-indigo-600 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-500 hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-indigo-500/20"
                >
                  {hasVoted ? (
                    "Already Voted ✓"
                  ) : voting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting Vote...
                    </span>
                  ) : (
                    "Submit Vote"
                  )}
                </button>
              </div>
              {proofStatus && (
                <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                  proofStatus.includes("✓") || proofStatus.includes("successfully")
                    ? "bg-green-500/10 border border-green-500/20 text-green-300"
                    : proofStatus.includes("Failed") || proofStatus.includes("Error")
                    ? "bg-red-500/10 border border-red-500/20 text-red-300"
                    : "bg-indigo-500/10 border border-indigo-500/20 text-indigo-300"
                }`}>
                  <div className="flex items-start gap-2">
                    {proofStatus.includes("✓") || proofStatus.includes("successfully") ? (
                      <svg className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : proofStatus.includes("Failed") || proofStatus.includes("Error") ? (
                      <svg className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="animate-spin h-5 w-5 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    <span>{proofStatus}</span>
                  </div>
                  {showReRegisterAction && (
                    <div className="mt-3">
                      <button
                        onClick={() => router.push("/voter")}
                        className="rounded-lg bg-amber-600/80 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-amber-500"
                      >
                        Go to Dashboard to Re-register →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
