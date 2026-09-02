import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getCurrentUser, signOut as signOutFn, type CurrentUser } from "@/lib/auth.functions";

export const CURRENT_USER_KEY = ["current-user"] as const;

export function useAuth() {
  const queryClient = useQueryClient();
  const fetchUser = useServerFn(getCurrentUser);
  const doSignOut = useServerFn(signOutFn);

  const { data, isLoading } = useQuery<CurrentUser>({
    queryKey: CURRENT_USER_KEY,
    queryFn: () => fetchUser(),
    staleTime: 60_000,
    retry: false,
  });

  const user = data ?? null;

  return {
    user,
    session: user ? { user } : null,
    roles: user?.roles ?? [],
    isAdmin: Boolean(user?.roles.includes("admin")),
    loading: isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY }),
    signOut: async () => {
      await doSignOut();
      queryClient.setQueryData(CURRENT_USER_KEY, null);
      await queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
    },
  };
}
