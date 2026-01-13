"use client";

import { useEffect, useState } from "react";
import { Modal } from "../components/Modal";
import { TransactionProgressModal, type TransactionStep } from "../components/TransactionProgressModal";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { contracts } from "@/lib/ethers";
import { parseAbi } from "viem";
import { sendSmartWalletContractTx } from "@/lib/privy";
import { ethers } from "ethers";
import { generateOnChainElectionId, generateExternalNullifier } from "@/lib/utils/ids";

type Election = {
  id: string;
  name: string;
  status: "draft" | "active" | "ended";
  starts_at: string | null;
  ends_at: string | null;
  onchain_election_id: string;
  created_at: string;
};

type Candidate = {
  id: string;
  name: string;
  image_url: string | null;
  created_at: string;
  vote_count?: number;
};

type Invitation = {
  id: string;
  invitee_email: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

export default function OrganizerPage() {
  const { user, ready, authenticated, login } = usePrivy();
  const { client: smartWallet } = useSmartWallets();
  const [activeTab, setActiveTab] = useState<"dashboard" | "create" | "invite">("dashboard");
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [selectedElectionForInvite, setSelectedElectionForInvite] = useState<Election | null>(null);
  const [electionCandidates, setElectionCandidates] = useState<Candidate[]>([]);
  const [electionInvitations, setElectionInvitations] = useState<Invitation[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);

  // Form state
  const [electionName, setElectionName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [candidateImage, setCandidateImage] = useState("");
  const [inviteeEmail, setInviteeEmail] = useState("");
  
  // Bulk invite state
  const [inviteMode, setInviteMode] = useState<"single" | "bulk">("single");
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkResult, setBulkResult] = useState<{total: number, inserted: number, duplicates: number} | null>(null);
  
  const [newCandidates, setNewCandidates] = useState<Array<{ name: string; image: string }>>([]);

  // Modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [modalElection, setModalElection] = useState<Election | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  
  // Transaction progress tracking
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [transactionSteps, setTransactionSteps] = useState<TransactionStep[]>([]);

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

  // Helper functions for modals
  async function openDetailsModal(election: Election) {
    setModalElection(election);
    const candidates = await loadElectionDetails(election.id);

    // If election has ended, fetch results from contract
    if (hasElectionEnded(election)) {
      await fetchElectionResults(election, candidates);
    }

    setShowDetailsModal(true);
  }

  async function fetchElectionResults(election: Election, currentCandidates: Candidate[]) {
    if (!election.onchain_election_id) {
      console.warn("No onchain_election_id found for election:", election.id);
      return;
    }

    try {
      setLoadingResults(true);

      console.log("🔍 Fetching results for election:", {
        supabaseId: election.id,
        onchainElectionId: election.onchain_election_id,
        onchainElectionIdBigInt: BigInt(election.onchain_election_id).toString(),
        contractAddress: contracts.voting,
        rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
      });

      // Read candidates with vote counts from the contract
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
      // Using ABIs that match the actual contract - run `npm run compile` to regenerate
      const votingContract = new ethers.Contract(
        contracts.voting,
        [
          "function getCandidates(uint256 electionId) external view returns (tuple(uint256 id, string name, string image, uint256 voteCount)[])",
          "function elections(uint256) external view returns (uint256 id, uint256 groupId, uint256 externalNullifier, uint64 startsAt, uint64 endsAt, address owner, bool exists)"
        ],
        provider
      );

      // First, verify if election exists on-chain
      try {
        console.log("🔍 Checking if election exists on-chain...");
        const electionData = await votingContract.elections(BigInt(election.onchain_election_id));
        console.log("✓ Election exists on-chain:", {
          id: electionData.id?.toString(),
          groupId: electionData.groupId?.toString(),
          externalNullifier: electionData.externalNullifier?.toString(),
          exists: electionData.exists,
        });

        if (!electionData.exists) {
          console.error("❌ Election exists in mapping but not marked as existing");
          setToast("Election data corrupted on blockchain.");
          return;
        }
      } catch (electionErr: any) {
        console.error("❌ Election does not exist on-chain or error reading:", electionErr);
        setToast("Election not found on blockchain. It may not have been created properly.");
        return;
      }

      let onchainCandidates;
      try {
        console.log("🔍 Reading candidates from contract...");
        onchainCandidates = await votingContract.getCandidates(BigInt(election.onchain_election_id));
      } catch (decodeErr: any) {
        console.error("Error decoding contract response:", decodeErr);

        // If we get BAD_DATA error, it means no candidates exist on-chain for this election
        if (decodeErr.code === "BAD_DATA" || decodeErr.message?.includes("could not decode")) {
          console.warn("No candidates found on-chain for election:", election.onchain_election_id);
          console.warn("This election may have candidates in Supabase but not on the blockchain");
          setToast("No on-chain candidates found. Candidates must be added to the blockchain.");
          return;
        }
        throw decodeErr;
      }

      console.log("✓ Fetched election results from contract:", {
        electionId: election.onchain_election_id,
        candidateCount: onchainCandidates.length,
        results: onchainCandidates.map((c: any) => ({
          id: c.id.toString(),
          name: c.name,
          voteCount: c.voteCount.toString(),
        })),
      });

      // Update local state with contract data
      if (onchainCandidates.length > 0) {
        // Use the passed candidates list instead of state to avoid race conditions
        const updatedCandidates = currentCandidates.map((candidate, idx) => {
          const onchainData = onchainCandidates[idx];
          if (onchainData) {
            return {
              ...candidate,
              vote_count: Number(onchainData.voteCount),
            };
          }
          return candidate;
        });

        setElectionCandidates(updatedCandidates);
      } else {
        console.warn("No candidates returned from contract");
        setToast("No candidates found on blockchain");
      }
    } catch (err: any) {
      console.error("Failed to fetch election results from contract:", err);
      console.error("Error details:", {
        message: err.message,
        code: err.code,
        reason: err.reason,
      });
      setToast("Failed to load results from blockchain");
    } finally {
      setLoadingResults(false);
    }
  }

  function closeDetailsModal() {
    setShowDetailsModal(false);
    setModalElection(null);
  }

  function openInviteModal(election: Election) {
    setModalElection(election);
    loadElectionDetails(election.id);
    setShowInviteModal(true);
  }

  function closeInviteModal() {
    setShowInviteModal(false);
    setModalElection(null);
    setInviteeEmail("");
  }

  useEffect(() => {
    if (authenticated && user?.id) {
      loadSupabaseUser();
    }
  }, [authenticated, user?.id]);

  useEffect(() => {
    if (supabaseUserId) {
      loadElections();
    }
  }, [supabaseUserId]);

  useEffect(() => {
    if (selectedElection) {
      loadElectionDetails(selectedElection.id);
    } else {
      setElectionCandidates([]);
      setElectionInvitations([]);
    }
  }, [selectedElection]);

  async function loadSupabaseUser(): Promise<string | null> {
    if (!user?.id) {
      console.log("User not ready yet");
      return null;
    }
    try {
      const res = await fetch("/api/users/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privyUserId: user.id, role: "organizer" }),
      });
      const body = await res.json();
      if (res.ok && body.user) {
        setSupabaseUserId(body.user.id);
        return body.user.id;
      } else {
        console.error("Failed to load Supabase user:", body.error);
        setToast(`Failed to link user: ${body.error || "Unknown error"}`);
        return null;
      }
    } catch (err) {
      console.error("Failed to load Supabase user", err);
      setToast("Failed to link user to Supabase. Please refresh the page.");
      return null;
    }
  }

  async function loadElections() {
    if (!supabaseUserId) return;
    try {
      const res = await fetch(`/api/elections?ownerId=${supabaseUserId}`);
      const body = await res.json();
      if (res.ok) {
        setElections(body.elections || []);
      }
    } catch (err) {
      console.error("Failed to load elections", err);
    }
  }

  async function loadElectionDetails(electionId: string): Promise<Candidate[]> {
    try {
      console.log("Loading election details for:", electionId);

      // Load candidates
      const candRes = await fetch(`/api/candidates?electionId=${electionId}`);
      const candBody = await candRes.json();
      let candidates: Candidate[] = [];

      if (candRes.ok) {
        console.log("Loaded candidates:", candBody.candidates);
        candidates = candBody.candidates || [];
        setElectionCandidates(candidates);
      } else {
        console.error("Failed to load candidates:", candBody.error);
      }

      // Load invitations
      const invRes = await fetch(`/api/invitations?electionId=${electionId}`);
      const invBody = await invRes.json();
      if (invRes.ok) {
        console.log("Loaded invitations:", invBody.invitations);
        setElectionInvitations(invBody.invitations || []);
      } else {
        console.error("Failed to load invitations:", invBody.error);
      }

      return candidates;
    } catch (err) {
      console.error("Failed to load election details", err);
      return [];
    }
  }

  // Helper to fetch invitations for an election
  async function fetchInvitations(electionId: string) {
    try {
      const invRes = await fetch(`/api/invitations?electionId=${electionId}`);
      const invBody = await invRes.json();
      if (invRes.ok) {
        setElectionInvitations(invBody.invitations || []);
      } else {
        console.error("Failed to load invitations:", invBody.error);
      }
    } catch (err) {
      console.error("Error fetching invitations:", err);
    }
  }

  function addCandidateToList() {
    if (!candidateName.trim()) {
      setToast("Candidate name required");
      return;
    }
    setNewCandidates([...newCandidates, { name: candidateName, image: candidateImage }]);
    setCandidateName("");
    setCandidateImage("");
  }

  function removeCandidateFromList(index: number) {
    setNewCandidates(newCandidates.filter((_, i) => i !== index));
  }

  async function ensureAuth() {
    if (!ready) throw new Error("Privy not ready yet");
    if (!authenticated) {
      await login();
      throw new Error("Please retry after signing in");
    }
    if (!smartWallet) throw new Error("Smart wallet not ready yet");
  }

  async function createElection() {
    try {
      await ensureAuth();
    } catch (err: any) {
      setToast(err.message || "Authentication required");
      return;
    }

    if (!electionName.trim()) {
      setToast("Election name required");
      return;
    }

    // Ensure Supabase user is loaded
    let userId = supabaseUserId;
    if (!userId) {
      setToast("Linking user to Supabase...");
      userId = await loadSupabaseUser();
      if (!userId) {
        setToast("Failed to link user. Please refresh the page and try again.");
        return;
      }
    }

    try {
      setBusy(true);
      setToast("Creating election on-chain...");

      // Auto-generate IDs
      const onchainElectionId = generateOnChainElectionId();
      const externalNullifier = generateExternalNullifier();

      const electionIdBig = BigInt(onchainElectionId);
      const externalNullifierBig = BigInt(externalNullifier);

      // 1) Register group on Semaphore v4 (returns groupId automatically)
      setToast("Registering election group on blockchain...");
      const groupManagerAbi = parseAbi([
        "function registerElectionGroup(uint256 electionId,uint256 externalNullifier) returns (uint256)",
        "function getGroupId(uint256 electionId) view returns (uint256)",
      ]);
      const registerTxHash = await sendSmartWalletContractTx({
        smartWallet: smartWallet!,
        to: contracts.groupManager as `0x${string}`,
        abi: groupManagerAbi,
        functionName: "registerElectionGroup",
        args: [electionIdBig, externalNullifierBig],
      });
      console.log("✓ Group registration tx sent:", registerTxHash);

      // Wait for confirmation
      await waitForTransaction(registerTxHash, "registerElectionGroup");
      console.log("✓✓ Group registration CONFIRMED!");

      // Get the groupId that was created by Semaphore
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
      const groupManagerContract = new ethers.Contract(
        contracts.groupManager,
        groupManagerAbi,
        provider
      );
      const groupIdBig = await groupManagerContract.getGroupId(electionIdBig);
      console.log("✓ Got groupId from contract:", groupIdBig.toString());

      // 2) Create election
      setToast("Creating election on blockchain...");
      const startsUnix = startsAt ? Math.floor(new Date(startsAt).getTime() / 1000) : 0;
      const endsUnix = endsAt ? Math.floor(new Date(endsAt).getTime() / 1000) : 0;

      const votingAbi = parseAbi([
        "function createElection(uint256 electionId,uint256 groupId,uint256 externalNullifier,uint64 startsAt,uint64 endsAt,bool isPublic)",
      ]);
      const createElectionTxHash = await sendSmartWalletContractTx({
        smartWallet: smartWallet!,
        to: contracts.voting as `0x${string}`,
        abi: votingAbi,
        functionName: "createElection",
        args: [electionIdBig, groupIdBig, externalNullifierBig, BigInt(startsUnix), BigInt(endsUnix), isPublic],
      });
      console.log("✓ Election creation tx sent:", createElectionTxHash);

      // Wait for confirmation
      await waitForTransaction(createElectionTxHash, "createElection");
      console.log("✓✓ Election creation CONFIRMED!");

      // 3) Sync to Supabase
      if (!userId) {
        throw new Error("User not linked to Supabase. Please refresh the page.");
      }

      // Normalize dates: empty strings should be null
      // Convert datetime-local (local time) to ISO string (UTC) for Supabase
      let normalizedStartsAt: string | null = null;
      let normalizedEndsAt: string | null = null;

      if (startsAt && startsAt.trim()) {
        // datetime-local gives us local time, convert to UTC ISO string
        const localDate = new Date(startsAt);
        normalizedStartsAt = localDate.toISOString();
      }

      if (endsAt && endsAt.trim()) {
        // datetime-local gives us local time, convert to UTC ISO string
        const localDate = new Date(endsAt);
        normalizedEndsAt = localDate.toISOString();
      }

      console.log("Creating election with dates:", {
        originalStartsAt: startsAt,
        originalEndsAt: endsAt,
        normalizedStartsAt,
        normalizedEndsAt,
        now: new Date().toISOString(),
        localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      const res = await fetch("/api/elections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: electionName,
          ownerId: userId,
          startsAt: normalizedStartsAt,
          endsAt: normalizedEndsAt,
          onchainElectionId,
          onchainGroupId: groupIdBig.toString(),
          externalNullifier,
          isPublic: isPublic,
          status: normalizedStartsAt && new Date(normalizedStartsAt).getTime() <= new Date().getTime() ? "active" : "draft",
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Failed to sync election");
      }

      const createdElection = body.election;

      if (!createdElection || !createdElection.id) {
        throw new Error("Election created but ID not returned. Please refresh and try again.");
      }

      console.log("✅ Election created in Supabase:", {
        supabaseId: createdElection.id,
        onchainElectionId: createdElection.onchain_election_id,
        onchainGroupId: createdElection.onchain_group_id,
        generatedElectionId: onchainElectionId,
        match: createdElection.onchain_election_id === onchainElectionId,
      });

      // 4) Add candidates if any
       if (newCandidates.length > 0) {
        if (!createdElection.id) {
          throw new Error("Created election ID is missing, cannot add candidates.");
        }
        setToast(`Adding ${newCandidates.length} candidate(s) to blockchain...`);
        
        // Prepare arrays for batch function
        const names = newCandidates.map(c => c.name);
        const images = newCandidates.map(c => c.image || "");

        console.log("📝 Adding candidates via BATCH function:", {
          electionId: onchainElectionId,
          electionIdBig: electionIdBig.toString(),
          supabaseOnchainId: createdElection.onchain_election_id,
          contractAddress: contracts.voting,
          candidateCount: newCandidates.length,
          names,
        });

        try {
          // Use the new addCandidates batch function (1 transaction instead of N)
          const txHash = await sendSmartWalletContractTx({
            smartWallet: smartWallet!,
            to: contracts.voting as `0x${string}`,
            abi: parseAbi(["function addCandidates(uint256 electionId, string[] names, string[] images)"]),
            functionName: "addCandidates",
            args: [electionIdBig, names, images],
          });
          console.log(`✓ Batch addCandidates tx sent (${newCandidates.length} candidates):`, txHash);

          // Wait for confirmation
          setToast(`Waiting for all ${newCandidates.length} candidates to be confirmed...`);
          await waitForTransaction(txHash, `addCandidates(${newCandidates.length} candidates)`);
          console.log(`✓✓ All ${newCandidates.length} candidates CONFIRMED on blockchain!`);

          // Now sync all candidates to Supabase
          setToast("Saving candidates to database...");
          for (const candidate of newCandidates) {
            const candidatePayload = {
              electionId: createdElection.id,
              name: candidate.name,
              ...(candidate.image && candidate.image.trim() ? { imageUrl: candidate.image.trim() } : {}),
            };

            const candRes = await fetch("/api/candidates", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(candidatePayload),
            });

            if (!candRes.ok) {
              console.warn(`⚠️ Failed to sync candidate ${candidate.name} to database (but it's on-chain)`);
            } else {
              console.log(`✓ Candidate ${candidate.name} saved to Supabase`);
            }
          }

          setToast("All candidates added successfully!");
        } catch (err: any) {
          console.error("❌ Error adding candidates:", err);
          setToast(`Failed to add candidates: ${err.message}`);
          throw err;
        }
      }

      setToast("Election created successfully!");
      setElectionName("");
      setStartsAt("");
      setEndsAt("");
      setIsPublic(false);
      setNewCandidates([]);
      setActiveTab("dashboard");

      // Reload elections and select the newly created one
      await loadElections();

      // Find and select the newly created election
      // Wait a bit to ensure all data is saved
      await new Promise(resolve => setTimeout(resolve, 1000));

      const updatedRes = await fetch(`/api/elections?ownerId=${userId}`);
      const updatedBody = await updatedRes.json();
      if (updatedRes.ok && updatedBody.elections) {
        const newElection = updatedBody.elections.find((e: Election) => e.id === createdElection.id);
        if (newElection) {
          console.log("Selecting newly created election:", newElection.id);
          setSelectedElection(newElection);
          // Load details with a small delay to ensure candidates are saved
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadElectionDetails(newElection.id);
        } else {
          console.error("Could not find newly created election in list");
        }
      }
    } catch (err: any) {
      setToast(err?.reason || err?.message || "Failed to create election");
    } finally {
      setBusy(false);
    }
  }

  async function addCandidate() {
    if (!selectedElection) {
      setToast("Please select an election first");
      return;
    }
    if (!candidateName.trim()) {
      setToast("Candidate name required");
      return;
    }

    try {
      await ensureAuth();
      setBusy(true);
      setToast("Adding candidate to blockchain...");

      const votingAbi = parseAbi(["function addCandidate(uint256 electionId,string name,string image)"]);
      const txHash = await sendSmartWalletContractTx({
        smartWallet: smartWallet!,
        to: contracts.voting as `0x${string}`,
        abi: votingAbi,
        functionName: "addCandidate",
        args: [BigInt(selectedElection.onchain_election_id), candidateName, candidateImage || ""],
      });
      console.log("✓ Candidate tx sent:", txHash);

      // Wait for confirmation
      setToast(`Waiting for candidate "${candidateName}" to be confirmed...`);
      await waitForTransaction(txHash, `addCandidate(${candidateName})`);
      console.log("✓✓ Candidate CONFIRMED on blockchain!");

      setToast("Saving candidate to database...");
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          electionId: selectedElection.id,
          name: candidateName,
          imageUrl: candidateImage,
        }),
      });
      if (!res.ok) throw new Error("Failed to sync candidate");

      setToast("Candidate added!");
      setCandidateName("");
      setCandidateImage("");
      loadElectionDetails(selectedElection.id);
    } catch (err: any) {
      setToast(err?.reason || err?.message || "Failed to add candidate");
    } finally {
      setBusy(false);
    }
  }

  async function sendInvitation(election?: Election) {
    // Use provided election or fall back to selectedElectionForInvite
    const targetElection = election || selectedElectionForInvite;

    if (!targetElection) {
      setToast("Please select an election first");
      return;
    }
    if (!inviteeEmail.trim() || !inviteeEmail.includes("@")) {
      setToast("Valid email required");
      return;
    }

    // Ensure Supabase user is loaded
    let userId = supabaseUserId;
    if (!userId) {
      userId = await loadSupabaseUser();
      if (!userId) {
        setToast("Failed to link user. Please refresh the page and try again.");
        return;
      }
    }

    try {
      setBusy(true);
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          electionId: targetElection.id,
          inviteeEmail: inviteeEmail.trim().toLowerCase(),
          inviterId: userId,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to send invitation");

      setToast(`Invitation sent to ${inviteeEmail}`);
      setInviteeEmail("");

      // Reload invitations for the election
      if (targetElection.id) {
        await loadElectionDetails(targetElection.id);
      }
    } catch (err: any) {
      setToast(err.message || "Failed to send invitation");
    } finally {
      setBusy(false);
    }
  }

  function getTimeRemaining(endsAt: string | null): string {
    if (!endsAt) return "No end date";
    const end = new Date(endsAt);
    const now = new Date();
    if (end < now) return "Ended";
    const diff = end.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  }

  function isElectionActive(election: Election): boolean {
    const now = new Date();
    const nowTime = now.getTime();

    // Normalize dates: handle null, undefined, and empty strings
    const endsAt = election.ends_at && typeof election.ends_at === "string" ? election.ends_at.trim() : election.ends_at;
    const startsAt = election.starts_at && typeof election.starts_at === "string" ? election.starts_at.trim() : election.starts_at;



    // If status is explicitly "ended", it's not active
    if (election.status === "ended") {
      return false;
    }

    // Check if election has ended (compare with time)
    // Only check if ends_at exists and is not empty
    if (endsAt && endsAt !== "" && endsAt !== "null") {
      const endDate = new Date(endsAt);
      const endTime = endDate.getTime();

      // Check if date is valid
      if (isNaN(endTime)) {
      } else {

        // Compare timestamps to ensure we're checking time, not just date
        if (endTime <= nowTime) {
          return false;
        }
      }
    } else {
    }

    // Check if election hasn't started yet (compare with time)
    // Only check if starts_at exists and is not empty
    if (startsAt && startsAt !== "" && startsAt !== "null") {
      const startDate = new Date(startsAt);
      const startTime = startDate.getTime();

      // Check if date is valid
      if (isNaN(startTime)) {
      } else {

        // Compare timestamps to ensure we're checking time, not just date
        if (startTime > nowTime) {
          return false;
        }
      }
    } else {
    }

    // If we get here, the election is active:
    // - It hasn't ended (or has no end date)
    // - It has started (or has no start date)
    // - Status is not "ended"
    return true;
  }

  function hasElectionEnded(election: Election): boolean {
    const now = new Date();
    const nowTime = now.getTime();

    // If status is explicitly "ended", it's ended
    if (election.status === "ended") return true;

    // Check if election has ended (compare with time)
    if (election.ends_at) {
      const endsAt = typeof election.ends_at === "string" ? election.ends_at.trim() : election.ends_at;
      if (endsAt && endsAt !== "" && endsAt !== "null") {
        const endDate = new Date(endsAt);
        const endTime = endDate.getTime();
        if (!isNaN(endTime) && endTime <= nowTime) {
          return true;
        }
      }
    }

    return false;
  }

  function hasElectionStarted(election: Election): boolean {
    const now = new Date();
    const nowTime = now.getTime();

    // If no start date, consider it started
    if (!election.starts_at) return true;

    const startsAt = typeof election.starts_at === "string" ? election.starts_at.trim() : election.starts_at;
    if (startsAt && startsAt !== "" && startsAt !== "null") {
      const startDate = new Date(startsAt);
      const startTime = startDate.getTime();
      if (!isNaN(startTime) && startTime <= nowTime) {
        return true;
      }
    }

    return false;
  }

  const activeElections = elections.filter((e) => isElectionActive(e));
  const pendingElections = elections.filter((e) => !hasElectionStarted(e) && !hasElectionEnded(e));
  const endedElections = elections.filter((e) => hasElectionEnded(e));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 py-10 mt-16">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">Organizer Dashboard</p>
        <h1 className="text-3xl font-bold text-indigo-400">Manage Your Elections</h1>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => {
            setActiveTab("dashboard");
            setSelectedElection(null);
          }}
          className={`px-4 py-2 text-sm font-medium transition ${activeTab === "dashboard"
            ? "border-b-2 border-indigo-600 text-indigo-400"
            : "text-slate-400 hover:text-white"
            }`}
        >
          My Elections
        </button>
        <button
          onClick={() => setActiveTab("create")}
          className={`px-4 py-2 text-sm font-medium transition ${activeTab === "create"
            ? "border-b-2 border-indigo-600 text-indigo-400"
            : "text-slate-400 hover:text-white"
            }`}
        >
          Create Election
        </button>
        <button
          onClick={() => {
            setActiveTab("invite");
            setSelectedElectionForInvite(null);
          }}
          className={`px-4 py-2 text-sm font-medium transition ${activeTab === "invite"
            ? "border-b-2 border-indigo-600 text-indigo-400"
            : "text-slate-400 hover:text-white"
            }`}
        >
          Invite Voters
        </button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {elections.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
              <p className="text-slate-400">No elections yet. Create your first one!</p>
            </div>
          ) : (
            <>
              {/* Active Elections */}
              {activeElections.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-indigo-400 mb-4">Active Elections</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {activeElections.map((election) => (
                      <div
                        key={election.id}
                        className={`rounded-2xl border-2 p-6 shadow-sm cursor-pointer transition ${selectedElection?.id === election.id
                          ? "border-indigo-500 bg-indigo-500/10"
                          : "border-white/10 bg-white/5 hover:shadow-md"
                          }`}
                        onClick={() => openDetailsModal(election)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-white">{election.name}</h3>
                            <p className="mt-1 text-sm text-slate-400">
                              {getTimeRemaining(election.ends_at)}
                            </p>
                            {election.starts_at && (
                              <p className="mt-1 text-xs text-slate-400">
                                Started: {new Date(election.starts_at).toLocaleString(undefined, {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                                })}
                              </p>
                            )}
                          </div>
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                            Active
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Elections */}
              {pendingElections.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">Pending Elections</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {pendingElections.map((election) => (
                      <div
                        key={election.id}
                        className={`rounded-2xl border-2 p-6 shadow-sm cursor-pointer transition ${selectedElection?.id === election.id
                          ? "border-indigo-500 bg-indigo-500/10"
                          : "border-white/10 bg-white/5 hover:shadow-md"
                          }`}
                        onClick={() => openDetailsModal(election)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-white">{election.name}</h3>
                            <p className="mt-1 text-sm text-slate-400">
                              {election.starts_at
                                ? `Starts: ${new Date(election.starts_at).toLocaleString(undefined, {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                                })}`
                                : "No start date"}
                            </p>
                            {election.ends_at && (
                              <p className="mt-1 text-xs text-slate-400">
                                Ends: {new Date(election.ends_at).toLocaleString(undefined, {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                                })}
                              </p>
                            )}
                          </div>
                          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                            Pending
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ended Elections */}
              {endedElections.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-indigo-400 mb-4">Ended Elections</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {endedElections.map((election) => (
                      <div
                        key={election.id}
                        className={`rounded-2xl border-2 p-6 shadow-sm cursor-pointer transition ${selectedElection?.id === election.id
                          ? "border-indigo-500 bg-indigo-500/10"
                          : "border-white/10 bg-white/5 hover:shadow-md"
                          }`}
                        onClick={() => openDetailsModal(election)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white">{election.name}</h3>
                            <p className="mt-1 text-sm text-slate-400">
                              Ended {election.ends_at ? new Date(election.ends_at).toLocaleString(undefined, {
                                dateStyle: 'short',
                                timeStyle: 'short',
                                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                              }) : "N/A"}
                            </p>
                          </div>
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                            Ended
                          </span>
                        </div>
                        {/* Quick access to results */}
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `/results/${election.id}`;
                            }}
                            className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 flex items-center justify-center gap-2"
                          >
                            📊 View Results
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Election Details */}
              {selectedElection && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white">{selectedElection.name}</h3>
                      <p className="text-sm text-slate-400 mt-1">
                        Created: {new Date(selectedElection.created_at).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedElection(null)}
                      className="text-sm text-slate-500 hover:text-slate-300"
                    >
                      Close
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mt-6">
                    {/* Candidates */}
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-3">Candidates ({electionCandidates.length})</h4>
                      {electionCandidates.length === 0 ? (
                        <p className="text-sm text-slate-400">No candidates yet</p>
                      ) : (
                        <div className="space-y-2">
                          {electionCandidates.map((candidate) => (
                            <div key={candidate.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                              {candidate.image_url && (
                                <img
                                  src={candidate.image_url}
                                  alt={candidate.name}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              )}
                              <span className="text-sm font-medium text-white">{candidate.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Invitations */}
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-3">
                        Invitations ({electionInvitations.length})
                      </h4>
                      {electionInvitations.length === 0 ? (
                        <p className="text-sm text-slate-400">No invitations sent yet</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-xs text-slate-400 mb-2">
                            Accepted: {electionInvitations.filter((i) => i.status === "accepted").length} |
                            Pending: {electionInvitations.filter((i) => i.status === "pending").length}
                          </div>
                          {electionInvitations.slice(0, 5).map((invitation) => (
                            <div key={invitation.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                              <span className="text-sm text-slate-300">{invitation.invitee_email}</span>
                              <span
                                className={`text-xs px-2 py-1 rounded ${invitation.status === "accepted"
                                  ? "bg-green-100 text-green-800"
                                  : invitation.status === "pending"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-white/10 text-slate-200"
                                  }`}
                              >
                                {invitation.status}
                              </span>
                            </div>
                          ))}
                          {electionInvitations.length > 5 && (
                            <p className="text-xs text-slate-500 mt-2">
                              +{electionInvitations.length - 5} more
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add Candidate Form */}
                  {isElectionActive(selectedElection) && (
                    <div className="mt-6 pt-6 border-t border-white/10">
                      <h4 className="text-sm font-semibold text-white mb-3">Add Candidate</h4>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="Candidate name"
                          value={candidateName}
                          onChange={(e) => setCandidateName(e.target.value)}
                        />
                        <input
                          className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="Image URL (optional)"
                          value={candidateImage}
                          onChange={(e) => setCandidateImage(e.target.value)}
                        />
                        <button
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500/100 disabled:opacity-60"
                          onClick={addCandidate}
                          disabled={busy}
                        >
                          {busy ? "Adding..." : "Add"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create Tab */}
      {activeTab === "create" && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-white mb-4">Create New Election</h3>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              Election Name
              <input
                className="mt-1 w-full rounded-lg border border-white/20 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                value={electionName}
                onChange={(e) => setElectionName(e.target.value)}
                placeholder="e.g. Board Election 2025"
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-slate-300">
                Starts At
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-white/20 px-3 py-2 text-sm text-white"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium text-slate-300">
                Ends At
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-white/20 px-3 py-2 text-sm text-white"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </label>
            </div>

            {/* Public/Private Selection - Improved clarity */}
            <div className="pt-4 border-t border-white/10">
              <h4 className="text-sm font-semibold text-white mb-3">Results Visibility</h4>
              <p className="text-xs text-slate-400 mb-4">Choose who can see the election results after voting ends</p>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Private Option */}
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                    !isPublic
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      !isPublic ? "border-purple-500" : "border-slate-500"
                    }`}>
                      {!isPublic && (
                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🔒</span>
                        <span className={`text-sm font-semibold ${!isPublic ? "text-purple-300" : "text-slate-300"}`}>
                          Private
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Only <strong>participants who voted</strong> and the <strong>organizer</strong> can see results
                      </p>
                    </div>
                  </div>
                </button>

                {/* Public Option */}
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                    isPublic
                      ? "border-green-500 bg-green-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isPublic ? "border-green-500" : "border-slate-500"
                    }`}>
                      {isPublic && (
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🌍</span>
                        <span className={`text-sm font-semibold ${isPublic ? "text-green-300" : "text-slate-300"}`}>
                          Public
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        <strong>Anyone</strong> can see the results, even without participating
                      </p>
                    </div>
                  </div>
                </button>
              </div>
              
              {/* Additional info based on selection */}
              <div className={`mt-3 rounded-lg p-3 border ${
                isPublic 
                  ? "bg-green-500/5 border-green-500/20" 
                  : "bg-purple-500/5 border-purple-500/20"
              }`}>
                <p className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-base">{isPublic ? "ℹ️" : "🔐"}</span>
                  <span>
                    {isPublic 
                      ? "This election will appear in the public elections page and anyone can view results" 
                      : "This election is private. Only invited voters who participated and you can see results"}
                  </span>
                </p>
              </div>
            </div>

            {/* Candidates Section */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h4 className="text-sm font-semibold text-white">Candidates</h4>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                  placeholder="Candidate name"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addCandidateToList()}
                />
                <input
                  className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                  placeholder="Image URL (optional)"
                  value={candidateImage}
                  onChange={(e) => setCandidateImage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addCandidateToList()}
                />
                <button
                  type="button"
                  className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/50"
                  onClick={addCandidateToList}
                >
                  Add
                </button>
              </div>

              {newCandidates.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-slate-400 font-medium">
                    {newCandidates.length} candidate{newCandidates.length !== 1 ? "s" : ""} added:
                  </p>
                  {newCandidates.map((candidate, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        {candidate.image && (
                          <img
                            src={candidate.image}
                            alt={candidate.name}
                            className="w-8 h-8 rounded-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                        <span className="text-sm font-medium text-white">{candidate.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCandidateFromList(index)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400">
                Add candidates now or add them later. At least one candidate is recommended.
              </p>
            </div>

            <button
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500/100 disabled:opacity-60"
              onClick={createElection}
              disabled={busy}
            >
              {busy ? "Creating..." : "Create Election"}
            </button>
            <p className="text-xs text-slate-400">
              IDs will be auto-generated. You can invite voters after creation.
            </p>
          </div>
        </div>
      )}

      {/* Invite Tab */}
      {activeTab === "invite" && (
        <div className="space-y-6">
          {!selectedElectionForInvite ? (
            <>
              <h2 className="text-xl font-semibold text-indigo-400">Select an Election to Invite Voters</h2>
              {activeElections.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                  <p className="text-slate-400">No active elections. Create one first!</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {activeElections.map((election) => (
                    <div
                      key={election.id}
                      onClick={() => openInviteModal(election)}
                      className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm cursor-pointer transition hover:border-indigo-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{election.name}</h3>
                          <p className="mt-1 text-sm text-slate-400">
                            {getTimeRemaining(election.ends_at)}
                          </p>
                        </div>
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                          Active
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  Invite Voters: {selectedElectionForInvite.name}
                </h2>
                <button
                  onClick={() => setSelectedElectionForInvite(null)}
                  className="text-sm text-slate-500 hover:text-slate-300"
                >
                  Change Election
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
                {/* Invite Mode Toggle */}
                <div className="flex gap-4 mb-6 border-b border-white/10 pb-4">
                  <button
                    onClick={() => { setInviteMode("single"); setBulkResult(null); }}
                    className={`text-sm font-medium transition ${inviteMode === "single" ? "text-indigo-400 border-b-2 border-indigo-400 -mb-[17px]" : "text-slate-400 hover:text-white"}`}
                  >
                    Single Invite
                  </button>
                  <button
                    onClick={() => { setInviteMode("bulk"); setBulkResult(null); }}
                    className={`text-sm font-medium transition ${inviteMode === "bulk" ? "text-indigo-400 border-b-2 border-indigo-400 -mb-[17px]" : "text-slate-400 hover:text-white"}`}
                  >
                    Bulk Invite
                  </button>
                </div>

                {inviteMode === "single" ? (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                        placeholder="voter@example.com"
                        value={inviteeEmail}
                        onChange={(e) => setInviteeEmail(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && sendInvitation()}
                      />
                      <button
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500/100"
                        onClick={() => sendInvitation()}
                        disabled={busy}
                      >
                        {busy ? "Sending..." : "Send Invitation"}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Voters will receive an invitation and can join using their Privy email.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Paste email addresses (separated by commas, spaces, or new lines)
                        </label>
                        <textarea
                          className="w-full h-32 rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-500 font-mono"
                          placeholder={"alice@example.com\nbob@example.com, charlie@example.com"}
                          value={bulkEmails}
                          onChange={(e) => setBulkEmails(e.target.value)}
                        />
                      </div>
                      
                      {bulkResult && (
                        <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-4 mb-4">
                          <h4 className="text-sm font-semibold text-indigo-300 mb-2">Results</h4>
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-xl font-bold text-white">{bulkResult.total}</p>
                              <p className="text-xs text-slate-400">Total Valid</p>
                            </div>
                            <div>
                              <p className="text-xl font-bold text-green-400">{bulkResult.inserted}</p>
                              <p className="text-xs text-slate-400">Sent</p>
                            </div>
                            <div>
                              <p className="text-xl font-bold text-amber-400">{bulkResult.duplicates}</p>
                              <p className="text-xs text-slate-400">Duplicates</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500/100 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={async () => {
                          if (!bulkEmails.trim()) return;
                          
                          setBusy(true);
                          setBulkResult(null);
                          
                          // Parse emails
                          const emails = bulkEmails
                            .split(/[\s,]+/)
                            .map(e => e.trim())
                            .filter(e => e && e.includes("@"));
                            
                          if (emails.length === 0) {
                            setToast("No valid emails found");
                            setBusy(false);
                            return;
                          }
                          
                          try {
                            setToast(`Processing ${emails.length} emails...`);
                            const res = await fetch("/api/invitations/batch", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                electionId: selectedElectionForInvite!.id,
                                emails
                              }),
                            });
                            
                            const data = await res.json();
                            
                            if (!res.ok) {
                              throw new Error(data.error || "Failed to send batch invites");
                            }
                            
                            setBulkResult({
                              total: data.total,
                              inserted: data.inserted,
                              duplicates: data.duplicates
                            });
                            
                            setToast(`Successfully sent ${data.inserted} invitations!`);
                            setBulkEmails(""); // Clear input on success
                            fetchInvitations(selectedElectionForInvite!.id); // Refresh list
                          } catch (err: any) {
                            setToast("Error: " + err.message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                        disabled={busy || !bulkEmails.trim()}
                      >
                        {busy ? "Processing..." : `Send Bulk Invitations`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Election Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={closeDetailsModal}
        title={modalElection?.name || "Election Details"}
        size="lg"
      >
        {modalElection && (
          <div className="space-y-6">
            {/* Election Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {isElectionActive(modalElection) ? (
                    <span className="text-green-600">Active</span>
                  ) : hasElectionEnded(modalElection) ? (
                    <span className="text-red-600">Ended</span>
                  ) : (
                    <span className="text-amber-600">Pending</span>
                  )}
                </p>
              </div>
              <div className="rounded-lg bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Time Remaining</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {isElectionActive(modalElection) ? getTimeRemaining(modalElection.ends_at) : hasElectionEnded(modalElection) ? "Ended" : "Not started"}
                </p>
              </div>
              <div className="rounded-lg bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Starts At</p>
                <p className="mt-1 text-sm text-white">
                  {modalElection.starts_at ? new Date(modalElection.starts_at).toLocaleString() : "Not set"}
                </p>
              </div>
              <div className="rounded-lg bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ends At</p>
                <p className="mt-1 text-sm text-white">
                  {modalElection.ends_at ? new Date(modalElection.ends_at).toLocaleString() : "Not set"}
                </p>
              </div>
            </div>

            {/* Candidates */}
            <div>
              <h3 className="text-lg font-semibold text-indigo-400 mb-3">Candidates ({electionCandidates.length})</h3>
              {electionCandidates.length === 0 ? (
                <p className="text-sm text-slate-400">No candidates added yet</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {electionCandidates.map((candidate, idx) => (
                    <div key={candidate.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                      {candidate.image_url ? (
                        <img src={candidate.image_url} alt={candidate.name} className="h-12 w-12 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 text-slate-400 text-xs font-semibold">
                          {idx + 1}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-white">{candidate.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invited Voters */}
            <div>
              <h3 className="text-lg font-semibold text-indigo-400 mb-3">Invited Voters ({electionInvitations.length})</h3>
              {electionInvitations.length === 0 ? (
                <p className="text-sm text-slate-400">No voters invited yet</p>
              ) : (
                <div className="space-y-2">
                  {electionInvitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                      <div>
                        <p className="text-sm font-medium text-white">{inv.invitee_email}</p>
                        <p className="text-xs text-slate-400">Invited {new Date(inv.created_at).toLocaleDateString()}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${inv.status === "accepted"
                          ? "bg-green-100 text-green-800"
                          : inv.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                          }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Results (if ended) */}
            {hasElectionEnded(modalElection) && electionCandidates.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-indigo-400 mb-3">
                  Election Results
                  {loadingResults && <span className="ml-2 text-sm text-slate-400">(Loading from blockchain...)</span>}
                </h3>
                {loadingResults ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {electionCandidates.map((candidate, idx) => {
                      const totalVotes = electionCandidates.reduce((sum, c) => sum + (c.vote_count || 0), 0);
                      const voteCount = candidate.vote_count || 0;
                      const percentage = totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : "0";

                      return (
                        <div key={candidate.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {candidate.image_url ? (
                                <img
                                  src={candidate.image_url}
                                  alt={candidate.name}
                                  className="h-8 w-8 rounded-lg object-cover"
                                />
                              ) : (
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-sm font-semibold text-indigo-400">
                                  {idx + 1}
                                </span>
                              )}
                              <span className="font-medium text-white">{candidate.name}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-white">{voteCount} votes</p>
                              <p className="text-xs text-slate-400">{percentage}%</p>
                            </div>
                          </div>
                          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-600 transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="mt-4 rounded-lg bg-indigo-500/10 p-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-indigo-400">
                            {electionCandidates.reduce((sum, c) => sum + (c.vote_count || 0), 0)}
                          </p>
                          <p className="text-xs text-slate-400">Total Votes</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-indigo-400">{electionInvitations.filter(i => i.status === "accepted").length}</p>
                          <p className="text-xs text-slate-400">Voters Joined</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-indigo-400">
                            {electionInvitations.length > 0
                              ? (
                                (electionCandidates.reduce((sum, c) => sum + (c.vote_count || 0), 0) /
                                  electionInvitations.filter(i => i.status === "accepted").length) *
                                100
                              ).toFixed(0)
                              : 0}
                            %
                          </p>
                          <p className="text-xs text-slate-400">Turnout</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 border-t border-slate-200 pt-4">
              {hasElectionEnded(modalElection) && (
                <button
                  onClick={() => {
                    closeDetailsModal();
                    window.location.href = `/results/${modalElection.id}`;
                  }}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500"
                >
                  📊 View Full Results
                </button>
              )}
              {!hasElectionEnded(modalElection) && (
                <button
                  onClick={() => {
                    closeDetailsModal();
                    openInviteModal(modalElection);
                  }}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500/100"
                >
                  Invite Voters
                </button>
              )}
              <button
                onClick={closeDetailsModal}
                className={`rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 ${hasElectionEnded(modalElection) ? "flex-1" : ""
                  }`}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Invite Voters Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={closeInviteModal}
        title={`Invite Voters: ${modalElection?.name || ""}`}
        size="md"
      >
        {modalElection && (
          <div className="space-y-6">
            <div className="rounded-lg bg-indigo-500/10 p-4">
              <p className="text-sm text-indigo-900">
                <strong>Election:</strong> {modalElection.name}
              </p>
              <p className="text-xs text-indigo-400 mt-1">
                Voters will receive an email invitation and can join using their Privy account
              </p>
            </div>

            {/* Invite Mode Toggle */}
            <div className="flex gap-4 border-b border-white/10 pb-3">
              <button
                onClick={() => { setInviteMode("single"); setBulkResult(null); }}
                className={`text-sm font-medium transition ${inviteMode === "single" ? "text-indigo-400 border-b-2 border-indigo-400 -mb-[13px]" : "text-slate-400 hover:text-white"}`}
              >
                Single Invite
              </button>
              <button
                onClick={() => { setInviteMode("bulk"); setBulkResult(null); }}
                className={`text-sm font-medium transition ${inviteMode === "bulk" ? "text-indigo-400 border-b-2 border-indigo-400 -mb-[13px]" : "text-slate-400 hover:text-white"}`}
              >
                Bulk Invite
              </button>
            </div>

            {inviteMode === "single" ? (
              <>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Voter Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteeEmail}
                    onChange={(e) => setInviteeEmail(e.target.value)}
                    placeholder="voter@example.com"
                    onKeyPress={(e) => e.key === "Enter" && sendInvitation(modalElection)}
                    className="w-full rounded-lg border border-white/20 px-4 py-2 text-sm text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <button
                  onClick={() => sendInvitation(modalElection)}
                  disabled={busy || !inviteeEmail.trim()}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500/100 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy ? "Sending..." : "Send Invitation"}
                </button>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Paste email addresses (separated by commas, spaces, or new lines)
                    </label>
                    <textarea
                      className="w-full h-32 rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-500 font-mono"
                      placeholder={"alice@example.com\nbob@example.com, charlie@example.com"}
                      value={bulkEmails}
                      onChange={(e) => setBulkEmails(e.target.value)}
                    />
                  </div>
                  
                  {bulkResult && (
                    <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-4">
                      <h4 className="text-sm font-semibold text-indigo-300 mb-2">Results</h4>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xl font-bold text-white">{bulkResult.total}</p>
                          <p className="text-xs text-slate-400">Total Valid</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-green-400">{bulkResult.inserted}</p>
                          <p className="text-xs text-slate-400">Sent</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-amber-400">{bulkResult.duplicates}</p>
                          <p className="text-xs text-slate-400">Duplicates</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500/100 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={async () => {
                      if (!bulkEmails.trim()) return;
                      
                      setBusy(true);
                      setBulkResult(null);
                      
                      // Parse emails
                      const emails = bulkEmails
                        .split(/[\s,]+/)
                        .map(e => e.trim())
                        .filter(e => e && e.includes("@"));
                        
                      if (emails.length === 0) {
                        setToast("No valid emails found");
                        setBusy(false);
                        return;
                      }
                      
                      try {
                        setToast(`Processing ${emails.length} emails...`);
                        const res = await fetch("/api/invitations/batch", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            electionId: modalElection.id,
                            emails
                          }),
                        });
                        
                        const data = await res.json();
                        
                        if (!res.ok) {
                          throw new Error(data.error || "Failed to send batch invites");
                        }
                        
                        setBulkResult({
                          total: data.total,
                          inserted: data.inserted,
                          duplicates: data.duplicates
                        });
                        
                        setToast(`Successfully sent ${data.inserted} invitations!`);
                        setBulkEmails(""); // Clear input on success
                        fetchInvitations(modalElection.id); // Refresh list
                      } catch (err: any) {
                        setToast("Error: " + err.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={busy || !bulkEmails.trim()}
                  >
                    {busy ? "Processing..." : `Send Bulk Invitations`}
                  </button>
                </div>
              </>
            )}

            {/* Current Invitations */}
            {electionInvitations.length > 0 && (
              <div className="border-t border-white/10 pt-4">
                <h4 className="text-sm font-semibold text-white mb-3">Current Invitations ({electionInvitations.length})</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {electionInvitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{inv.invitee_email}</p>
                        <p className="text-xs text-slate-400">{new Date(inv.created_at).toLocaleDateString()}</p>
                      </div>
                      <span
                        className={`ml-3 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap ${inv.status === "accepted"
                          ? "bg-green-100 text-green-800"
                          : inv.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                          }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
