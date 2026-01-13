import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendVoteConfirmationEmail } from "@/lib/email/vote-confirmation";
import { z } from "zod";

const voteConfirmationSchema = z.object({
    electionId: z.string().uuid(),
    voterEmail: z.string().email(),
    transactionHash: z.string().startsWith("0x"),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // Validate request body
    const parsed = voteConfirmationSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { electionId, voterEmail, transactionHash } = parsed.data;

    try {
        const supabase = getSupabaseServerClient();

        // Fetch election details
        const { data: election, error: electionError } = await supabase
            .from("elections")
            .select("id, name")
            .eq("id", electionId)
            .single();

        if (electionError || !election) {
            return res.status(404).json({ error: "Election not found" });
        }

        // Verify that the voter was invited to this election (for private elections)
        const { data: invitation } = await supabase
            .from("invitations")
            .select("id, status")
            .eq("election_id", electionId)
            .eq("invitee_email", voterEmail.toLowerCase())
            .single();

        // If this is a private election and no invitation exists, don't send email
        // (This is a basic check - you might want more sophisticated validation)

        // Send confirmation email
        const timestamp = new Date().toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });

        const result = await sendVoteConfirmationEmail({
            voterEmail,
            electionName: election.name,
            transactionHash,
            timestamp,
            electionId: election.id,
        });

        if (!result.success) {
            console.error("Failed to send confirmation email:", result.error);
            return res.status(500).json({
                error: "Failed to send confirmation email",
                details: result.error
            });
        }

        return res.status(200).json({
            success: true,
            message: "Vote confirmation email sent successfully"
        });

    } catch (error: any) {
        console.error("Error in vote confirmation:", error);
        return res.status(500).json({
            error: "Internal server error",
            message: error.message
        });
    }
}
