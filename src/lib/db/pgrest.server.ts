// Lapisan kompatibilitas: API bergaya PostgREST (seperti supabase-js) di atas
// koneksi PostgreSQL langsung (`pg`). Hanya dipakai di server.
//
// Didukung: from().select()/insert()/update()/upsert()/delete(),
// filter eq/neq/gt/gte/lt/lte/in/is/like/ilike/or, order/limit/range,
// single/maybeSingle, count exact + head, embed relasi (one & many),
// dan rpc() untuk fungsi database.
import { getPool, hasDirectPostgresConfig } from "./pool.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Rel = { table: string; type: "one" | "many"; localKey: string; foreignKey: string };

/** Peta relasi antar tabel: `${tabelInduk}:${tabelTarget}` */
const RELATIONS: Record<string, Rel> = {
  "properties:categories": { table: "categories", type: "one", localKey: "category_id", foreignKey: "id" },
  "properties:profiles": { table: "profiles", type: "one", localKey: "agent_id", foreignKey: "id" },
  "properties:property_images": { table: "property_images", type: "many", localKey: "id", foreignKey: "property_id" },
  "properties:property_facilities": { table: "property_facilities", type: "many", localKey: "id", foreignKey: "property_id" },
  "property_facilities:facilities": { table: "facilities", type: "one", localKey: "facility_id", foreignKey: "id" },
  "property_images:properties": { table: "properties", type: "one", localKey: "property_id", foreignKey: "id" },
  "services:categories": { table: "categories", type: "one", localKey: "category_id", foreignKey: "id" },
  "favorites:properties": { table: "properties", type: "one", localKey: "property_id", foreignKey: "id" },
  "inquiries:properties": { table: "properties", type: "one", localKey: "property_id", foreignKey: "id" },
  "schedules:properties": { table: "properties", type: "one", localKey: "property_id", foreignKey: "id" },
  "reports:properties": { table: "properties", type: "one", localKey: "property_id", foreignKey: "id" },
  "user_roles:profiles": { table: "profiles", type: "one", localKey: "user_id", foreignKey: "id" },
};

type ParsedSelect = { columns: string[]; embeds: ParsedEmbed[] };
type ParsedEmbed = { alias: string; table: string; inner: boolean; select: ParsedSelect };

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseSelect(select: string): ParsedSelect {
  const columns: string[] = [];
  const embeds: ParsedEmbed[] = [];
  for (const part of splitTopLevel(select)) {
    const open = part.indexOf("(");
    if (open === -1) {
      columns.push(part);
      continue;
    }
    const head = part.slice(0, open);
    const body = part.slice(open + 1, part.lastIndexOf(")"));
    const [maybeAlias, maybeTarget] = head.includes(":") ? head.split(":") : [undefined, head];
    let target = (maybeTarget ?? "").trim();
    const inner = target.endsWith("!inner");
    if (inner) target = target.slice(0, -"!inner".length);
    embeds.push({
      alias: (maybeAlias ?? target).trim(),
      table: target,
      inner,
      select: parseSelect(body),
    });
  }
  return { columns, embeds };
}

const ident = (name: string) => `"${name.replace(/"/g, "")}"`;

type Ctx = { params: unknown[] };
const bind = (ctx: Ctx, value: unknown) => `$${ctx.params.push(value)}`;

/** Ekspresi JSON untuk baris embed (dipakai di subquery). */
function embedJsonExpr(embed: ParsedEmbed, alias: string, ctx: Ctx): string {
  const entries: string[] = [];
  const useAll = embed.select.columns.includes("*");
  if (useAll) entries.push(`to_jsonb(${ident(alias)}.*)`);
  for (const col of embed.select.columns) {
    if (col === "*") continue;
    entries.push(`jsonb_build_object('${col}', ${ident(alias)}.${ident(col)})`);
  }
  for (const child of embed.select.embeds) {
    const rel = RELATIONS[`${embed.table}:${child.table}`];
    if (!rel) throw new Error(`Relasi tidak dikenal: ${embed.table} -> ${child.table}`);
    entries.push(`jsonb_build_object('${child.alias}', ${embedSubquery(child, rel, alias, ctx)})`);
  }
  if (!entries.length) return `'{}'::jsonb`;
  return entries.join(" || ");
}

/** Subquery untuk satu embed relatif terhadap alias induk. */
function embedSubquery(embed: ParsedEmbed, rel: Rel, parentAlias: string, ctx: Ctx): string {
  const alias = `e_${Math.random().toString(36).slice(2, 8)}`;
  const json = embedJsonExpr(embed, alias, ctx);
  const on =
    rel.type === "one"
      ? `${ident(alias)}.${ident(rel.foreignKey)} = ${ident(parentAlias)}.${ident(rel.localKey)}`
      : `${ident(alias)}.${ident(rel.foreignKey)} = ${ident(parentAlias)}.${ident(rel.localKey)}`;
  if (rel.type === "one") {
    return `(SELECT ${json} FROM ${ident(rel.table)} ${ident(alias)} WHERE ${on} LIMIT 1)`;
  }
  return `(SELECT COALESCE(jsonb_agg(x.v), '[]'::jsonb) FROM (SELECT ${json} AS v FROM ${ident(rel.table)} ${ident(alias)} WHERE ${on}) x)`;
}

type Filter =
  | { kind: "cmp"; column: string; op: string; value: unknown }
  | { kind: "in"; column: string; values: unknown[] }
  | { kind: "is"; column: string; value: null | boolean }
  | { kind: "or"; raw: string };

const OPS: Record<string, string> = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "LIKE",
  ilike: "ILIKE",
};

export type PgRestResult<T> = { data: T; error: { message: string } | null; count: number | null };

class QueryBuilder<T = any> implements PromiseLike<PgRestResult<T>> {
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private selectStr = "*";
  private filters: Filter[] = [];
  private orders: { column: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private offsetN = 0;
  private payload: Record<string, unknown>[] = [];
  private conflictTarget: string | null = null;
  private ignoreDuplicates = false;
  private rowMode: "many" | "single" | "maybe" = "many";
  private wantCount = false;
  private headOnly = false;

  constructor(private table: string) {}

  select(select = "*", options?: { count?: "exact"; head?: boolean }) {
    if (this.mode === "select") this.selectStr = select;
    else this.selectStr = select;
    if (options?.count) this.wantCount = true;
    if (options?.head) this.headOnly = true;
    return this as unknown as QueryBuilder<any[]>;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.mode = "insert";
    this.payload = Array.isArray(values) ? values : [values];
    this.selectStr = "";
    return this;
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ) {
    this.mode = "upsert";
    this.payload = Array.isArray(values) ? values : [values];
    this.conflictTarget = options?.onConflict ?? null;
    this.ignoreDuplicates = options?.ignoreDuplicates ?? false;
    this.selectStr = "";
    return this;
  }

  update(values: Record<string, unknown>) {
    this.mode = "update";
    this.payload = [values];
    this.selectStr = "";
    return this;
  }

  delete() {
    this.mode = "delete";
    this.selectStr = "";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: "cmp", column, op: "eq", value });
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push({ kind: "cmp", column, op: "neq", value });
    return this;
  }
  gt(column: string, value: unknown) {
    this.filters.push({ kind: "cmp", column, op: "gt", value });
    return this;
  }
  gte(column: string, value: unknown) {
    this.filters.push({ kind: "cmp", column, op: "gte", value });
    return this;
  }
  lt(column: string, value: unknown) {
    this.filters.push({ kind: "cmp", column, op: "lt", value });
    return this;
  }
  lte(column: string, value: unknown) {
    this.filters.push({ kind: "cmp", column, op: "lte", value });
    return this;
  }
  like(column: string, value: string) {
    this.filters.push({ kind: "cmp", column, op: "like", value });
    return this;
  }
  ilike(column: string, value: string) {
    this.filters.push({ kind: "cmp", column, op: "ilike", value });
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push({ kind: "in", column, values: values ?? [] });
    return this;
  }
  is(column: string, value: null | boolean) {
    this.filters.push({ kind: "is", column, value });
    return this;
  }
  or(raw: string) {
    this.filters.push({ kind: "or", raw });
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, asc: options?.ascending !== false });
    return this;
  }
  limit(count: number) {
    this.limitN = count;
    return this;
  }
  range(from: number, to: number) {
    this.offsetN = from;
    this.limitN = to - from + 1;
    return this;
  }
  single() {
    this.rowMode = "single";
    return this as unknown as QueryBuilder<any>;
  }
  maybeSingle() {
    this.rowMode = "maybe";
    return this as unknown as QueryBuilder<any>;
  }

  // ---- kompilasi SQL ----

  private columnRef(column: string, rootAlias: string, joins: Map<string, string>): string {
    if (column.includes(".")) {
      const [prefix, ...rest] = column.split(".");
      const joinAlias = joins.get(prefix!);
      if (joinAlias) return `${ident(joinAlias)}.${ident(rest.join("."))}`;
    }
    return `${ident(rootAlias)}.${ident(column)}`;
  }

  private whereSql(ctx: Ctx, rootAlias: string, joins: Map<string, string>): string {
    const parts: string[] = [];
    for (const filter of this.filters) {
      if (filter.kind === "cmp") {
        const op = OPS[filter.op] ?? "=";
        parts.push(`${this.columnRef(filter.column, rootAlias, joins)}::text ${op} ${bind(ctx, filter.value)}::text`);
      } else if (filter.kind === "in") {
        if (!filter.values.length) {
          parts.push("false");
          continue;
        }
        const list = filter.values.map((v) => `${bind(ctx, v)}::text`).join(", ");
        parts.push(`${this.columnRef(filter.column, rootAlias, joins)}::text IN (${list})`);
      } else if (filter.kind === "is") {
        const ref = this.columnRef(filter.column, rootAlias, joins);
        parts.push(filter.value === null ? `${ref} IS NULL` : `${ref} IS ${filter.value ? "TRUE" : "FALSE"}`);
      } else {
        const ors = splitTopLevel(filter.raw).map((clause) => {
          const first = clause.indexOf(".");
          const second = clause.indexOf(".", first + 1);
          const column = clause.slice(0, first);
          const op = clause.slice(first + 1, second);
          const value = clause.slice(second + 1);
          const sqlOp = OPS[op] ?? "=";
          return `${this.columnRef(column, rootAlias, joins)}::text ${sqlOp} ${bind(ctx, value)}::text`;
        });
        if (ors.length) parts.push(`(${ors.join(" OR ")})`);
      }
    }
    return parts.length ? `WHERE ${parts.join(" AND ")}` : "";
  }

  private returningSql(): string {
    if (!this.selectStr) return "";
    const parsed = parseSelect(this.selectStr);
    if (parsed.columns.includes("*") || !parsed.columns.length) return "RETURNING *";
    return `RETURNING ${parsed.columns.map((c) => ident(c)).join(", ")}`;
  }

  private buildSelect(): { text: string; params: unknown[]; countText?: string; countParams?: unknown[] } {
    const ctx: Ctx = { params: [] };
    const rootAlias = "t";
    const parsed = parseSelect(this.selectStr || "*");
    const joins: Map<string, string> = new Map();
    const joinSql: string[] = [];
    const fields: string[] = [];

    if (parsed.columns.includes("*") || (!parsed.columns.length && !parsed.embeds.length)) {
      fields.push(`${ident(rootAlias)}.*`);
    }
    for (const col of parsed.columns) {
      if (col === "*") continue;
      fields.push(`${ident(rootAlias)}.${ident(col)}`);
    }

    for (const embed of parsed.embeds) {
      const rel = RELATIONS[`${this.table}:${embed.table}`];
      if (!rel) throw new Error(`Relasi tidak dikenal: ${this.table} -> ${embed.table}`);
      if (rel.type === "one") {
        const alias = `j_${embed.alias}`;
        joins.set(embed.alias, alias);
        joinSql.push(
          `${embed.inner ? "INNER" : "LEFT"} JOIN ${ident(rel.table)} ${ident(alias)} ON ${ident(alias)}.${ident(
            rel.foreignKey,
          )} = ${ident(rootAlias)}.${ident(rel.localKey)}`,
        );
        const json = embedJsonExpr(embed, alias, ctx);
        fields.push(
          `CASE WHEN ${ident(alias)}.${ident(rel.foreignKey)} IS NULL THEN NULL ELSE ${json} END AS ${ident(embed.alias)}`,
        );
      } else {
        fields.push(`${embedSubquery(embed, rel, rootAlias, ctx)} AS ${ident(embed.alias)}`);
      }
    }

    const where = this.whereSql(ctx, rootAlias, joins);
    const from = `FROM ${ident(this.table)} ${ident(rootAlias)} ${joinSql.join(" ")}`;
    const orderBy = this.orders.length
      ? `ORDER BY ${this.orders
          .map((o) => `${this.columnRef(o.column, rootAlias, joins)} ${o.asc ? "ASC" : "DESC"} NULLS LAST`)
          .join(", ")}`
      : "";
    const limit = this.rowMode !== "many" ? "LIMIT 1" : this.limitN != null ? `LIMIT ${Number(this.limitN)}` : "";
    const offset = this.offsetN ? `OFFSET ${Number(this.offsetN)}` : "";

    const text = `SELECT ${fields.join(", ")} ${from} ${where} ${orderBy} ${limit} ${offset}`;
    const params = [...ctx.params];

    if (!this.wantCount) return { text, params };

    const countCtx: Ctx = { params: [] };
    const countWhere = this.whereSql(countCtx, rootAlias, joins);
    const countText = `SELECT COUNT(*)::int AS count FROM ${ident(this.table)} ${ident(rootAlias)} ${joinSql.join(
      " ",
    )} ${countWhere}`;
    return { text, params, countText, countParams: countCtx.params };
  }

  private buildWrite(): { text: string; params: unknown[] } {
    const ctx: Ctx = { params: [] };
    const returning = this.returningSql();

    if (this.mode === "insert" || this.mode === "upsert") {
      const keys = Array.from(new Set(this.payload.flatMap((row) => Object.keys(row))));
      const valuesSql = this.payload
        .map((row) => `(${keys.map((k) => bind(ctx, row[k] ?? null)).join(", ")})`)
        .join(", ");
      let conflict = "";
      if (this.mode === "upsert") {
        const target = this.conflictTarget
          ? `(${this.conflictTarget
              .split(",")
              .map((c) => ident(c.trim()))
              .join(", ")})`
          : "";
        conflict = this.ignoreDuplicates
          ? `ON CONFLICT ${target} DO NOTHING`
          : `ON CONFLICT ${target} DO UPDATE SET ${keys
              .map((k) => `${ident(k)} = EXCLUDED.${ident(k)}`)
              .join(", ")}`;
      }
      const text = `INSERT INTO ${ident(this.table)} (${keys.map(ident).join(", ")}) VALUES ${valuesSql} ${conflict} ${returning}`;
      return { text, params: ctx.params };
    }

    if (this.mode === "update") {
      const row = this.payload[0] ?? {};
      const sets = Object.keys(row).map((k) => `${ident(k)} = ${bind(ctx, row[k] ?? null)}`);
      const where = this.whereSql(ctx, this.table, new Map());
      if (!where) throw new Error("UPDATE tanpa filter ditolak");
      const text = `UPDATE ${ident(this.table)} AS ${ident(this.table)} SET ${sets.join(", ")} ${where} ${returning}`;
      return { text, params: ctx.params };
    }

    const where = this.whereSql(ctx, this.table, new Map());
    if (!where) throw new Error("DELETE tanpa filter ditolak");
    return {
      text: `DELETE FROM ${ident(this.table)} AS ${ident(this.table)} ${where} ${returning}`,
      params: ctx.params,
    };
  }

  private async run(): Promise<PgRestResult<T>> {
    const pool = getPool();
    try {
      let rows: Record<string, unknown>[] = [];
      let count: number | null = null;

      if (this.mode === "select") {
        const built = this.buildSelect();
        if (built.countText) {
          const res = await pool.query(built.countText, (built.countParams ?? []) as never[]);
          count = Number(res.rows[0]?.count ?? 0);
        }
        if (!this.headOnly) {
          const res = await pool.query(built.text, built.params as never[]);
          rows = res.rows as Record<string, unknown>[];
        }
      } else {
        const built = this.buildWrite();
        const res = await pool.query(built.text, built.params as never[]);
        rows = (res.rows ?? []) as Record<string, unknown>[];
      }

      if (this.rowMode === "single") {
        if (!rows.length) return { data: null as T, error: { message: "Data tidak ditemukan" }, count };
        return { data: rows[0] as T, error: null, count };
      }
      if (this.rowMode === "maybe") {
        return { data: (rows[0] ?? null) as T, error: null, count };
      }
      return { data: rows as T, error: null, count };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[db]", message);
      return { data: (this.rowMode === "many" ? [] : null) as T, error: { message }, count: null };
    }
  }

  then<R1 = PgRestResult<T>, R2 = never>(
    onfulfilled?: ((value: PgRestResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/** Klien database bergaya supabase-js, tanpa layanan eksternal. */
const postgresDb = {
  from(table: string) {
    return new QueryBuilder(table);
  },
  async rpc(fn: string, args: Record<string, unknown> = {}) {
    const keys = Object.keys(args);
    const params = keys.map((k) => args[k]);
    const call = keys.length
      ? `${ident(fn)}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(", ")})`
      : `${ident(fn)}()`;
    try {
      const res = await getPool().query(`SELECT public.${call} AS value`, params as never[]);
      return { data: res.rows[0]?.value ?? null, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[db.rpc]", message);
      return { data: null, error: { message } };
    }
  },
};

type DatabaseClient = typeof postgresDb;

function useDirectPostgres(): boolean {
  return hasDirectPostgresConfig();
}

/**
 * Gunakan PostgreSQL langsung di cPanel, dan Lovable Cloud selama preview
 * ketika kredensial PostgreSQL mandiri belum tersedia.
 */
export const db = new Proxy(postgresDb, {
  get(target, property, receiver) {
    if (useDirectPostgres()) return Reflect.get(target, property, receiver);
    return Reflect.get(supabaseAdmin as unknown as DatabaseClient, property, supabaseAdmin);
  },
});

export type Db = DatabaseClient;
