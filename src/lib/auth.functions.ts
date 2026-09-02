// Server functions autentikasi mandiri (tanpa layanan pihak ketiga).
import { createServerFn } from "@tanstack/react-start";

export type CurrentUser = { id: string; email: string; name: string; roles: string[] } | null;

export const signIn = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string }) => input)
  .handler(async ({ data }) => {
    const { authenticate } = await import("./auth/users-v2.server");
    const { createSessionToken, setSessionCookie } = await import("./auth/session.server");
    const user = await authenticate(data.email, data.password);
    setSessionCookie(createSessionToken({ sub: user.id, email: user.email, name: user.name }));
    return user;
  });

export const signUp = createServerFn({ method: "POST" })
  .validator(
    (input: { email: string; password: string; name?: string; phone?: string; role?: "buyer" | "agent" }) => input,
  )
  .handler(async ({ data }) => {
    const { createUser } = await import("./auth/users-v2.server");
    const { createSessionToken, setSessionCookie } = await import("./auth/session.server");
    const user = await createUser({
      email: data.email,
      password: data.password,
      ...(data.name ? { name: data.name } : {}),
      ...(data.phone ? { phone: data.phone } : {}),
      role: data.role ?? "buyer",
    });
    setSessionCookie(createSessionToken({ sub: user.id, email: user.email, name: user.name }));
    return user;
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { clearSessionCookie } = await import("./auth/session.server");
  clearSessionCookie();
  return { ok: true };
});

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async (): Promise<CurrentUser> => {
  const { readSession } = await import("./auth/session.server");
  const session = readSession();
  if (!session) return null;
  const { getUserRoles, getProfileName } = await import("./auth/users-v2.server");
  return {
    id: session.sub,
    email: session.email,
    name: (await getProfileName(session.sub)) || session.name,
    roles: await getUserRoles(session.sub),
  };
});

export const changeMyPassword = createServerFn({ method: "POST" })
  .validator((input: { currentPassword: string; newPassword: string }) => input)
  .handler(async ({ data }) => {
    const { readSession } = await import("./auth/session.server");
    const session = readSession();
    if (!session) throw new Error("Unauthorized");
    const { changePassword } = await import("./auth/users-v2.server");
    return changePassword(session.sub, data.currentPassword, data.newPassword);
  });
