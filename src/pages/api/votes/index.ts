import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase";
import { z } from "zod";

const voteSchema = z.object({
  electionId: z.string().uuid(),
  nullifierHash: z.string(),
  signal: z.string(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const parsed = voteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const supabase = getSupabaseServerClient();
  const { electionId, nullifierHash, signal } = parsed.data;

  const { error: insertError } = await supabase.from("votes").insert({
    election_id: electionId,
    nullifier_hash: nullifierHash,
    signal,
  });

  if (insertError) {
    res.status(500).json({ error: insertError.message });
    return;
  }

  res.status(200).json({ ok: true });
}


