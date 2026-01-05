import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase";
import { z } from "zod";

const createSchema = z.object({
  name: z.string(),
  ownerId: z.string().optional(),
  semaphoreGroupId: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  isPublic: z.boolean().optional(),
  onchainElectionId: z.string(),
  onchainGroupId: z.string(),
  externalNullifier: z.string(),
  status: z.enum(["draft", "active", "ended"]).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = getSupabaseServerClient();

  if (req.method === "GET") {
    const { ownerId } = req.query;
    let query = supabase.from("elections").select("*").order("created_at", { ascending: false });
    
    if (ownerId) {
      query = query.eq("owner_id", ownerId);
    }
    
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ elections: data });
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const payload = parsed.data;
    const { data, error } = await supabase
      .from("elections")
      .insert({
        name: payload.name,
        owner_id: payload.ownerId ?? null,
        semaphore_group_id: payload.semaphoreGroupId,
        onchain_election_id: payload.onchainElectionId,
        onchain_group_id: payload.onchainGroupId,
        external_nullifier: payload.externalNullifier,
        starts_at: payload.startsAt,
        ends_at: payload.endsAt,
        is_public: payload.isPublic ?? false,
        status: payload.status ?? "draft",
      })
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ election: data });
  }

  res.status(405).json({ error: "Method not allowed" });
}


