// Middleware server function: wajib login (cookie sesi HttpOnly).
// Konteks yang diberikan: { db, userId, email, isAdmin }.
import { createMiddleware } from "@tanstack/react-start";

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { readSession } = await import("./session.server");
  const { db } = await import("../db/pgrest.server");

  const session = readSession();
  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const { data: isAdmin } = await db.rpc("has_role", {
    _user_id: session.sub,
    _role: "admin",
  });

  return next({
    context: {
      db,
      userId: session.sub,
      email: session.email,
      isAdmin: Boolean(isAdmin),
    },
  });
});
