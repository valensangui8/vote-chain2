import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase";
import { z } from "zod";

const voteSchema = z.object({
  electionId: z.string().uuid(), // Supabase election ID (UUID)
  nullifierHash: z.string(),
  signal: z.string(),
  txHash: z.string().optional(), // Blockchain transaction hash
  // NOTE: voterPrivyUserId intentionally NOT accepted to preserve voter anonymity
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const parsed = voteSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error("❌ Vote API validation error:", parsed.error.flatten());
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const supabase = getSupabaseServerClient();
  const { electionId, nullifierHash, signal, txHash } = parsed.data;

  console.log("📝 Saving vote to Supabase (anonymous):", {
    electionId,
    nullifierHash: nullifierHash.substring(0, 20) + "...",
    signal,
    txHash: txHash?.substring(0, 20) + "...",
  });

  // Save vote record to Supabase (vote already submitted to blockchain from frontend)
  // NOTE: We do NOT store voter identity to preserve anonymity
  const { error: insertError } = await supabase.from("votes").insert({
    election_id: electionId,
    // voter_privy_user_id intentionally NOT stored for anonymity
    nullifier_hash: nullifierHash,
    signal,
    tx_hash: txHash || null,
  });

  if (insertError) {
    console.error("❌ Failed to save vote to Supabase:", insertError);
    res.status(500).json({ error: insertError.message });
    return;
  }

  console.log("✓ Vote saved to Supabase successfully");
  res.status(200).json({ ok: true });
}


