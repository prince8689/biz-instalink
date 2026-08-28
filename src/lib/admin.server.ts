// Server-only admin helpers.

export async function assertAdmin(
  supabase: { rpc: (fn: never, args: never) => PromiseLike<{ data: unknown }> },
  userId: string,
): Promise<void> {
  const { data } = await supabase.rpc("has_role" as never, {
    _user_id: userId,
    _role: "admin",
  } as never);
  if (!data) throw new Error("Admin access required.");
}
