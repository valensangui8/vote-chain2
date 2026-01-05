import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase";
import { z } from "zod";

const userSchema = z.object({
  privyUserId: z.string(),
  role: z.enum(["admin", "organizer", "voter"]).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let privyUserId: string | undefined;

  if (req.method === "GET") {
    privyUserId = req.query.privyUserId as string;
  } else if (req.method === "POST") {
    const parsed = userSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    privyUserId = parsed.data.privyUserId;
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!privyUserId) {
    return res.status(400).json({ error: "privyUserId required" });
  }

  const supabase = getSupabaseServerClient();

  // Try to find existing user
  let { data: user, error } = await supabase
    .from("users")
    .select("id, privy_user_id, role")
    .eq("privy_user_id", privyUserId)
    .single();

  // If not found, create one
  if (error || !user) {
    let role = "voter";
    if (req.method === "POST") {
      const parsed = userSchema.safeParse(req.body);
      if (parsed.success && parsed.data.role) {
        role = parsed.data.role;
      } else {
        // Default to organizer if accessing from organizer page
        role = "organizer";
      }
    }

    const { data: newUser, error: createError } = await supabase
      .from("users")
      .upsert(
        { privy_user_id: privyUserId, role },
        { onConflict: "privy_user_id" }
      )
      .select("id, privy_user_id, role")
      .single();

    if (createError) {
      return res.status(500).json({ error: createError.message });
    }

    return res.status(200).json({ user: newUser });
  }

  return res.status(200).json({ user });
}

