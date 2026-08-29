import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAccount, type AccountState } from "@/lib/billing.functions";

/** Signed-in user's profile, role and weekly-plan state. */
export function useAccount() {
  const fetchAccount = useServerFn(getAccount);
  return useQuery<AccountState>({
    queryKey: ["account"],
    queryFn: () => fetchAccount(),
    staleTime: 30_000,
  });
}
