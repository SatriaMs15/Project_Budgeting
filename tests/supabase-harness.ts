import { vi } from "vitest";

/**
 * A stand-in for the supabase-js query builder.
 *
 * Every builder method returns `this` and the object is thenable, so an
 * `await supabase.from(t).insert(x)` resolves to whatever the test configured.
 * Each call is recorded so a test can assert on the payload that would have
 * reached Postgres — which is the real subject of an action test.
 */
export type Recorded = {
  table: string;
  op: string;
  payload?: unknown;
  filters: [string, unknown][];
  options?: unknown;
};

export type HarnessState = {
  calls: Recorded[];
  /** Result for the next read, by table. Defaults to empty. */
  data: Record<string, unknown>;
  /** Force an error for a given "table.op", e.g. "transactions.insert". */
  errors: Record<string, { message: string; code?: string }>;
  user: { id: string } | null;
};

export function createHarness(): HarnessState {
  return { calls: [], data: {}, errors: {}, user: { id: "user-1" } };
}

class Query {
  private record: Recorded;
  constructor(
    private state: HarnessState,
    table: string,
  ) {
    this.record = { table, op: "select", filters: [] };
    this.state.calls.push(this.record);
  }
  private set(op: string, payload?: unknown, options?: unknown) {
    this.record.op = op;
    this.record.payload = payload;
    this.record.options = options;
    return this;
  }
  insert(payload: unknown) {
    return this.set("insert", payload);
  }
  update(payload: unknown) {
    return this.set("update", payload);
  }
  upsert(payload: unknown, options?: unknown) {
    return this.set("upsert", payload, options);
  }
  delete() {
    return this.set("delete");
  }
  select(cols?: string, opts?: unknown) {
    this.record.op = this.record.op === "select" ? "select" : this.record.op;
    this.record.options = opts ?? this.record.options;
    void cols;
    return this;
  }
  eq(col: string, val: unknown) {
    this.record.filters.push([col, val]);
    return this;
  }
  lte(col: string, val: unknown) {
    this.record.filters.push([col, val]);
    return this;
  }
  gte(col: string, val: unknown) {
    this.record.filters.push([col, val]);
    return this;
  }
  lt(col: string, val: unknown) {
    this.record.filters.push([col, val]);
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  maybeSingle() {
    this.record.op = "maybeSingle";
    return this;
  }
  private result() {
    const key = `${this.record.table}.${this.record.op}`;
    const error = this.state.errors[key] ?? this.state.errors[this.record.table];
    if (error) return { data: null, error, count: null };
    const data = this.state.data[this.record.table];
    return {
      data: data ?? (this.record.op === "maybeSingle" ? null : []),
      error: null,
      count: Array.isArray(data) ? data.length : 0,
    };
  }
  then(resolve: (v: unknown) => unknown) {
    return Promise.resolve(this.result()).then(resolve);
  }
}

export function makeClient(state: HarnessState) {
  return {
    from: (table: string) => new Query(state, table),
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
    },
  };
}

/** Build a FormData from a plain object; undefined values are omitted. */
export function form(fields: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) fd.set(k, v);
  }
  return fd;
}

/** Append repeated fields, as the import review screen submits them. */
export function multiForm(rows: Record<string, string>[]): FormData {
  const fd = new FormData();
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) fd.append(k, v);
  }
  return fd;
}

export const revalidateSpy = vi.fn();
