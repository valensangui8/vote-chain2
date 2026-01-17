import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase";
import { z } from "zod";

const acceptSchema = z.object({
  // NOTE: We intentionally do NOT store commitmentHash in Supabase to preserve voter anonymity.
  // The commitment is only registered on-chain where it cannot be linked to email/identity.
  privyUserId: z.string().min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = getSupabaseServerClient();
  const { id } = req.query;

  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { privyUserId } = parsed.data;

  // Get invitation
  const { data: invitation, error: invError } = await supabase
    .from("invitations")
    .select("*, elections(*)")
    .eq("id", id)
    .single();

  if (invError || !invitation) {
    return res.status(404).json({ error: "Invitation not found" });
  }

  if (invitation.status !== "pending") {
    if (invitation.status === "accepted") {
      return res.status(200).json({
        invitation,
        // Return election on-chain IDs and election_id so frontend can re-register commitment
        election: {
          id: (invitation.elections as any).id,
          onchainElectionId: (invitation.elections as any).onchain_election_id,
          onchainGroupId: (invitation.elections as any).onchain_group_id,
        },
      });
    }
    return res.status(400).json({ error: "Invitation already processed" });
  }

  // Update invitation status
  // NOTE: We do NOT store commitment_hash to preserve voter anonymity.
  // The commitment only exists on-chain, unlinkable to email/identity.
  const { data: updated, error: updateError } = await supabase
    .from("invitations")
    .update({
      status: "accepted",
      invitee_privy_user_id: privyUserId,
      // commitment_hash intentionally NOT stored for anonymity
      accepted_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  return res.status(200).json({
    invitation: updated,
    // Return election on-chain IDs and election_id so frontend can add commitment and redirect
    election: {
      id: (invitation.elections as any).id,
      onchainElectionId: (invitation.elections as any).onchain_election_id,
      onchainGroupId: (invitation.elections as any).onchain_group_id,
    },
  });
}
