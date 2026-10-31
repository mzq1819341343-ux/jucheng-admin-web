import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type SalaryActor =
  | { ok: false; status: 401 | 500; error: string }
  | {
      ok: true;
      userId: string;
      profileId: string | null;
      role: string | null;
      supabase: Awaited<ReturnType<typeof createClient>>;
    };

/** 与 GET /api/salary/realtime 相同：Cookie 会话 + profiles.role，未配置视为未登录。 */
export async function readSalaryActor(): Promise<SalaryActor> {
  if (!isSupabaseConfigured()) {
    return { ok: false, status: 401, error: "unauthenticated" };
  }
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: "unauthenticated" };
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return { ok: false, status: 500, error: "role lookup failed" };
  }
  return {
    ok: true,
    userId: user.id,
    profileId: typeof profile?.id === "string" ? profile.id : null,
    role: typeof profile?.role === "string" ? profile.role : null,
    supabase,
  };
}
