import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase";
import { ethers } from "ethers";
import { contracts } from "@/lib/ethers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const supabase = getSupabaseServerClient();
    const { id } = req.query;
    const { userId } = req.query; // Optional: Privy user ID for access control

    if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Missing election id" });
    }

    try {
        // 1. Fetch election from database
        const { data: election, error: electionError } = await supabase
            .from("elections")
            .select("*, candidates(*)")
            .eq("id", id)
            .single();

        if (electionError || !election) {
            return res.status(404).json({ error: "Election not found" });
        }


        // 2. Check access control for private elections
        if (!election.is_public) {
            // For private elections, verify the user is either:
            // a) The organizer
            // b) A participant (has an accepted invitation)

            if (!userId) {
                return res.status(403).json({
                    error: "This is a private election. Please log in to view results.",
                    isPrivate: true,
                    requiresAuth: true
                });
            }

            // Get Supabase user ID from Privy user ID
            const { data: user } = await supabase
                .from("users")
                .select("id")
                .eq("privy_user_id", userId)
                .single();

            console.log("🔍 Access check:", {
                privyUserId: userId,
                supabaseUserId: user?.id,
                electionOwnerId: election.owner_id,
                userFound: !!user
            });

            if (!user) {
                return res.status(403).json({
                    error: "User not found",
                    isPrivate: true
                });
            }

            // Check if user is the organizer
            const isOrganizer = election.owner_id === user.id;

            // Check if user participated (has an accepted invitation)
            const { data: invitation } = await supabase
                .from("invitations")
                .select("status")
                .eq("election_id", id)
                .eq("invitee_privy_user_id", userId)
                .eq("status", "accepted")
                .single();

            const hasParticipated = !!invitation;


            console.log("🔍 Access decision:", {
                isOrganizer,
                hasParticipated,
                willAllow: isOrganizer || hasParticipated
            });

            if (!isOrganizer && !hasParticipated) {
                console.log("❌ BLOCKING ACCESS - Not organizer and not participant");
                return res.status(403).json({
                    error: "You are not authorized to view the results of this private election. Only participants and the organizer can view results.",
                    isPrivate: true,
                    notParticipant: true
                });
            }

            console.log("✅ ACCESS GRANTED - Proceeding to fetch results");
        }

        // 3. Fetch results from blockchain
        if (!election.onchain_election_id) {
            return res.status(400).json({ error: "Election not deployed on-chain" });
        }

        const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
        const votingContract = new ethers.Contract(
            contracts.voting,
            [
                "function getCandidates(uint256 electionId) external view returns (tuple(uint256 id, string name, string image, uint256 voteCount)[])",
                "function isElectionPublic(uint256 electionId) external view returns (bool)"
            ],
            provider
        );

        // Fetch candidates with vote counts from blockchain
        const onchainCandidates = await votingContract.getCandidates(
            BigInt(election.onchain_election_id)
        );

        // Format results
        const results = onchainCandidates.map((candidate: any) => ({
            id: candidate.id.toString(),
            name: candidate.name,
            image: candidate.image,
            voteCount: Number(candidate.voteCount),
        }));

        // Calculate total votes and percentages
        const totalVotes = results.reduce((sum: number, c: any) => sum + c.voteCount, 0);
        const resultsWithPercentage = results.map((candidate: any) => ({
            ...candidate,
            percentage: totalVotes > 0 ? (candidate.voteCount / totalVotes) * 100 : 0,
        }));

        // Find winner(s)
        const maxVotes = Math.max(...results.map((c: any) => c.voteCount), 0);
        const winners = results.filter((c: any) => c.voteCount === maxVotes && maxVotes > 0);

        return res.status(200).json({
            election: {
                id: election.id,
                name: election.name,
                isPublic: election.is_public,
                status: election.status,
                startsAt: election.starts_at,
                endsAt: election.ends_at,
                onchainElectionId: election.onchain_election_id,
            },
            results: resultsWithPercentage,
            totalVotes,
            winners: winners.map((w: any) => ({
                id: w.id,
                name: w.name,
            })),
            hasWinner: winners.length === 1,
            isTie: winners.length > 1,
        });
    } catch (err: any) {
        console.error("Error fetching election results:", err);
        return res.status(500).json({
            error: err.message || "Failed to fetch election results"
        });
    }
}
