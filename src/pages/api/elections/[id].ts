import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = getSupabaseServerClient();
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("elections")
      .select("*, candidates(*), votes(*)")
      .eq("id", id)
      .single();
    if (error) return res.status(404).json({ error: error.message });
    return res.status(200).json({ election: data });
  }

  res.status(405).json({ error: "Method not allowed" });
}


