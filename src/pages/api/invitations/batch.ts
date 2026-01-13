import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase";
import { z } from "zod";

const createBatchInvitationSchema = z.object({
    electionId: z.string().uuid(),
    emails: z.array(z.string().email()),
    inviterId: z.string().uuid().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const supabase = getSupabaseServerClient();
    const parsed = createBatchInvitationSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { electionId, emails, inviterId } = parsed.data;

    // Filter out empty or duplicate emails from the input
    const uniqueEmails = [...new Set(emails.map(e => e.toLowerCase()))];

    try {
        // 1. Check which ones already exist
        const { data: existing, error: fetchError } = await supabase
            .from("invitations")
            .select("invitee_email")
            .eq("election_id", electionId)
            .in("invitee_email", uniqueEmails);

        if (fetchError) {
            throw fetchError;
        }

        const existingEmails = new Set(existing?.map(i => i.invitee_email) || []);

        // 2. Filter out already invited
        const newEmails = uniqueEmails.filter(email => !existingEmails.has(email));

        if (newEmails.length === 0) {
            return res.status(200).json({
                total: uniqueEmails.length,
                inserted: 0,
                duplicates: uniqueEmails.length,
                ignored: 0
            });
        }

        // 3. Prepare bulk insert
        const invitationsToInsert = newEmails.map(email => ({
            election_id: electionId,
            invitee_email: email,
            inviter_id: inviterId || null,
            status: "pending",
        }));

        // 4. Perform bulk insert
        const { data: inserted, error: insertError } = await supabase
            .from("invitations")
            .insert(invitationsToInsert)
            .select();

        if (insertError) {
            throw insertError;
        }

        return res.status(200).json({
            total: uniqueEmails.length,
            inserted: inserted?.length || 0,
            duplicates: existingEmails.size,
            ignored: uniqueEmails.length - newEmails.length - existingEmails.size // should be 0 generally
        });

    } catch (err: any) {
        console.error("Batch invite error:", err);
        return res.status(500).json({ error: err.message || "Failed to process batch invitations" });
    }
}
