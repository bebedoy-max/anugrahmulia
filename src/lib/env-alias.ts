// Maps user-provided APP_SUPABASE_* secrets onto the SUPABASE_* names the
// generated Supabase clients read. Runs before any Supabase client is created.
const pairs: Array<[string, string]> = [
  ["SUPABASE_URL", "APP_SUPABASE_URL"],
  ["SUPABASE_PUBLISHABLE_KEY", "APP_SUPABASE_PUBLISHABLE_KEY"],
  ["SUPABASE_ANON_KEY", "APP_SUPABASE_PUBLISHABLE_KEY"],
  ["SUPABASE_SERVICE_ROLE_KEY", "APP_SUPABASE_SERVICE_ROLE_KEY"],
];

try {
  if (typeof process !== "undefined" && process.env) {
    for (const [target, source] of pairs) {
      if (!process.env[target] && process.env[source]) {
        process.env[target] = process.env[source];
      }
    }
  }
} catch {
  // process.env may be immutable in some runtimes; clients still fall back.
}

export {};
