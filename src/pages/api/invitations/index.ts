import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase";
import { z } from "zod";

const createInvitationSchema = z.object({
  electionId: z.string().uuid(),
  inviteeEmail: z.string().email(),
  inviterId: z.string().uuid().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = getSupabaseServerClient();

  if (req.method === "POST") {
    const parsed = createInvitationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { electionId, inviteeEmail, inviterId } = parsed.data;

    // TODO: Verify inviter is organizer of this election (via Privy JWT)
    const { data, error } = await supabase
      .from("invitations")
      .insert({
        election_id: electionId,
        invitee_email: inviteeEmail.toLowerCase(),
        inviter_id: inviterId || null,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ invitation: data });
  }

  if (req.method === "GET") {
    const { electionId, email, status } = req.query;

    let query = supabase.from("invitations").select("*, elections(*)");

    if (electionId) {
      query = query.eq("election_id", electionId);
    }
    if (email) {
      query = query.eq("invitee_email", (email as string).toLowerCase());
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ invitations: data });
  }

  res.status(405).json({ error: "Method not allowed" });
}

