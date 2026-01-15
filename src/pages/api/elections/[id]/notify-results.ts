import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendResultsNotificationEmail } from "@/lib/email/results-notification";
import { z } from "zod";

const notifyResultsSchema = z.object({
    electionId: z.string().uuid(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { id: electionId } = req.query;

    if (!electionId || typeof electionId !== "string") {
        return res.status(400).json({ error: "Invalid election ID" });
    }

    try {
        const supabase = getSupabaseServerClient();

        // Fetch election details
        const { data: election, error: electionError } = await supabase
            .from("elections")
            .select("id, name, status")
            .eq("id", electionId)
            .single();

        if (electionError || !election) {
            return res.status(404).json({ error: "Election not found" });
        }

        // Verify election has ended
        if (election.status !== "ended") {
            return res.status(400).json({
                error: "Election must be ended before notifying voters",
                currentStatus: election.status
            });
        }

        // Get all voters who participated (accepted invitations)
        const { data: invitations, error: invitationsError } = await supabase
            .from("invitations")
            .select("invitee_email")
            .eq("election_id", electionId)
            .eq("status", "accepted");

        if (invitationsError) {
            throw invitationsError;
        }

        if (!invitations || invitations.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No voters to notify",
                emailsSent: 0,
                errors: []
            });
        }

        // Send email to each voter
        const results = {
            sent: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const invitation of invitations) {
            try {
                const result = await sendResultsNotificationEmail({
                    voterEmail: invitation.invitee_email,
                    electionName: election.name,
                    electionId: election.id,
                });

                if (result.success) {
                    results.sent++;
                } else {
                    results.failed++;
                    results.errors.push(`Failed to send to ${invitation.invitee_email}`);
                }
            } catch (emailError: any) {
                results.failed++;
                results.errors.push(`Error sending to ${invitation.invitee_email}: ${emailError.message}`);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Results notifications sent to ${results.sent} voters`,
            emailsSent: results.sent,
            emailsFailed: results.failed,
            errors: results.errors,
            totalVoters: invitations.length
        });

    } catch (error: any) {
        console.error("Error in results notification:", error);
        return res.status(500).json({
            error: "Internal server error",
            message: error.message
        });
    }
}
