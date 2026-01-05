import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase";
import { z } from "zod";

const candidateSchema = z.object({
  electionId: z.string(),
  name: z.string(),
  imageUrl: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = getSupabaseServerClient();

  if (req.method === "GET") {
    const { electionId } = req.query;
    
    if (!electionId) {
      return res.status(400).json({ error: "electionId required" });
    }

    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("election_id", electionId)
      .order("created_at", { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ candidates: data || [] });
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const parsed = candidateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const payload = parsed.data;
  const { data, error } = await supabase
    .from("candidates")
    .insert({
      election_id: payload.electionId,
      name: payload.name,
      image_url: payload.imageUrl || null,
    })
    .select("*")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ candidate: data });
}


