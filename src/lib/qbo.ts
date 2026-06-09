import { Buffer } from "buffer";
import { getServerSupabaseClient } from "./supabase";
import fs from "fs";
import path from "path";

const QBO_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QBO_API_BASE = process.env.QBO_ENVIRONMENT === "production"
  ? "https://quickbooks.api.intuit.com"
  : "https://sandbox-quickbooks.api.intuit.com";
const QBO_MIN_INTERVAL_MS = Number.parseInt(process.env.QBO_MIN_INTERVAL_MS || "600", 10);
const QBO_MAX_RETRIES = Number.parseInt(process.env.QBO_MAX_RETRIES || "2", 10);
const QBO_RETRY_BASE_MS = Number.parseInt(process.env.QBO_RETRY_BASE_MS || "500", 10);

let qboQueue: Promise<unknown> = Promise.resolve();
let nextAllowedAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enqueueQbo<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const now = Date.now();
    const delay = Math.max(0, nextAllowedAt - now);
    if (delay > 0) {
      await sleep(delay);
    }
    nextAllowedAt = Date.now() + Math.max(0, QBO_MIN_INTERVAL_MS);
    return fn();
  };
  qboQueue = qboQueue.then(run, run);
  return qboQueue as Promise<T>;
}

export function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return val;
}

export function buildAuthorizeUrl(state: string) {
  const clientId = requireEnv("QBO_CLIENT_ID");
  const redirectUri = requireEnv("QBO_REDIRECT_URI");
  const scope = encodeURIComponent("com.intuit.quickbooks.accounting openid profile email");
  return `${QBO_AUTH_URL}?client_id=${encodeURIComponent(clientId)}&response_type=code&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
}

export type QboTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
  realmId?: string;
};

export type QboTokenRow = {
  id: string;
  user_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  realm_id: string | null;
  token_type: string | null;
  expires_at: string | null;
  refresh_expires_at: string | null;
  state: string | null;
};

export async function exchangeCodeForToken(code: string, realmId: string | null): Promise<QboTokenResponse> {
  const clientId = requireEnv("QBO_CLIENT_ID");
  const clientSecret = requireEnv("QBO_CLIENT_SECRET");
  const redirectUri = requireEnv("QBO_REDIRECT_URI");

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${res.statusText} - ${text}`);
  }

  const data = (await res.json()) as QboTokenResponse;
  if (realmId && !data.realmId) {
    data.realmId = realmId;
  }
  return data;
}

export async function refreshAccessToken(refreshToken: string): Promise<QboTokenResponse> {
  const clientId = requireEnv("QBO_CLIENT_ID");
  const clientSecret = requireEnv("QBO_CLIENT_SECRET");
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${res.statusText} - ${text}`);
  }

  return (await res.json()) as QboTokenResponse;
}

const TOKEN_FILE = path.join(process.cwd(), ".data", "qbo_tokens.json");

function ensureDataDir() {
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function readTokenFile(): Promise<QboTokenRow | null> {
  try {
    const buf = await fs.promises.readFile(TOKEN_FILE, "utf8");
    const json = JSON.parse(buf);
    return json as QboTokenRow;
  } catch {
    return null;
  }
}

async function writeTokenFile(row: QboTokenRow): Promise<void> {
  ensureDataDir();
  await fs.promises.writeFile(TOKEN_FILE, JSON.stringify(row, null, 2));
}

export async function getTokenRow(userId?: string): Promise<QboTokenRow | null> {
  try {
    const supabase = getServerSupabaseClient();
    if (userId) {
      const userRow = await supabase
        .from("qbo_tokens")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // If user-specific lookup works and has data, use it.
      if (!userRow.error && userRow.data) {
        return userRow.data as QboTokenRow;
      }
      // If user-specific lookup errors (common with RLS when anon key is used),
      // intentionally continue to primary fallback.
    }

    const primaryRow = await supabase
      .from("qbo_tokens")
      .select("*")
      .eq("id", "primary")
      .maybeSingle();

    if (primaryRow.error) throw primaryRow.error;
    return primaryRow.data as QboTokenRow | null;
  } catch (err) {
    // Fallback to local file storage when Supabase is unreachable
    return await readTokenFile();
  }
}

export async function saveTokenRow(token: QboTokenResponse, state?: string, userId?: string) {
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  const refreshExpiresAt = new Date(Date.now() + token.x_refresh_token_expires_in * 1000).toISOString();
  const payload: QboTokenRow = {
    id: userId || "primary",
    user_id: userId || null,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    realm_id: token.realmId || null,
    token_type: token.token_type,
    expires_at: expiresAt,
    refresh_expires_at: refreshExpiresAt,
    state: state || null,
  };

  try {
    const supabase = getServerSupabaseClient();
    const { error } = await supabase.from("qbo_tokens").upsert(payload);
    if (error) throw error;
  } catch (err) {
    // Fallback to local file storage when Supabase is unreachable
    await writeTokenFile(payload);
  }
  return { expiresAt, refreshExpiresAt };
}

function isExpiring(expiresAt: string | null, skewMs = 120_000) {
  if (!expiresAt) return true;
  return Date.parse(expiresAt) < Date.now() + skewMs;
}

export async function ensureAccessToken(userId?: string): Promise<{ accessToken: string; realmId: string }> {
  const row = await getTokenRow(userId);
  if (!row || !row.access_token || !row.refresh_token || !row.realm_id) {
    throw new Error("No stored QuickBooks tokens or realmId. Connect QuickBooks first.");
  }

  if (!isExpiring(row.expires_at)) {
    return { accessToken: row.access_token, realmId: row.realm_id };
  }

  // refresh
  const refreshed = await refreshAccessToken(row.refresh_token);
  if (!refreshed.realmId && row.realm_id) {
    refreshed.realmId = row.realm_id;
  }
  await saveTokenRow(refreshed, row.state || undefined);
  return { accessToken: refreshed.access_token, realmId: refreshed.realmId! };
}

function extractTid(res: Response) {
  return res.headers.get("intuit_tid") || res.headers.get("Intuit-Tid") || undefined;
}

export class QboApiError extends Error {
  status: number;
  statusText: string;
  url: string;
  tid?: string;
  body?: string;

  constructor(params: { status: number; statusText: string; url: string; tid?: string; body?: string }) {
    const tidLabel = params.tid ? ` (tid ${params.tid})` : "";
    super(`QBO API error ${params.status}${tidLabel}: ${params.body || params.statusText}`);
    this.name = "QboApiError";
    this.status = params.status;
    this.statusText = params.statusText;
    this.url = params.url;
    this.tid = params.tid;
    this.body = params.body;
  }
}

async function qboApiFetchRaw(realmId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${QBO_API_BASE}${path}`;

  return enqueueQbo(async () => {
    for (let attempt = 0; attempt <= QBO_MAX_RETRIES; attempt += 1) {
      const res = await fetch(url, init);
      const tid = extractTid(res);

      if (res.ok) {
        return res;
      }

      if (res.status === 429 && attempt < QBO_MAX_RETRIES) {
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) * 1000 : undefined;
        const backoffMs = retryAfterMs ?? Math.round(QBO_RETRY_BASE_MS * Math.pow(2, attempt) + Math.random() * 150);
        console.warn("QBO rate limited, retrying", {
          attempt: attempt + 1,
          backoffMs,
          url,
          tid,
        });
        await sleep(backoffMs);
        continue;
      }

      const text = await res.text();
      console.error("QBO API error", {
        status: res.status,
        statusText: res.statusText,
        url,
        tid,
        body: text,
      });
      throw new QboApiError({ status: res.status, statusText: res.statusText, url, tid, body: text });
    }

    throw new QboApiError({
      status: 429,
      statusText: "Too Many Requests",
      url,
      body: "QBO rate limit retries exhausted",
    });
  });
}

export async function qboApiFetch<T>(realmId: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await qboApiFetchRaw(realmId, path, init);
  return (await res.json()) as T;
}

export async function authorizedQboFetch<T>(path: string, init: RequestInit = {}, userId?: string) {
  const { accessToken, realmId } = await ensureAccessToken(userId);
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");
  if (init.body) {
    headers.set("Content-Type", "application/json");
  }
  return qboApiFetch<T>(realmId, `/v3/company/${realmId}${path}`, {
    ...init,
    headers,
  });
}

/**
 * Like authorizedQboFetch but bypasses the rate-limit queue — safe to call in
 * parallel when you need multiple results at once (e.g., dashboard summary).
 * QBO allows ~500 req/min, so a handful of parallel calls is fine.
 */
export async function authorizedQboFetchDirect<T>(
  path: string,
  init: RequestInit = {},
  userId?: string
): Promise<T> {
  const { accessToken, realmId } = await ensureAccessToken(userId);
  const url = `${QBO_API_BASE}/v3/company/${realmId}${path}`;
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");

  for (let attempt = 0; attempt <= QBO_MAX_RETRIES; attempt++) {
    const res = await fetch(url, { ...init, headers });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 && attempt < QBO_MAX_RETRIES) {
      await sleep(QBO_RETRY_BASE_MS * Math.pow(2, attempt));
      continue;
    }
    const text = await res.text();
    throw new QboApiError({ status: res.status, statusText: res.statusText, url, body: text });
  }
  throw new QboApiError({ status: 429, statusText: "Too Many Requests", url: `${QBO_API_BASE}${path}`, body: "Retries exhausted" });
}

export async function authorizedQboFetchRaw(path: string, init: RequestInit = {}, userId?: string) {
  const { accessToken, realmId } = await ensureAccessToken(userId);
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (init.body) {
    headers.set("Content-Type", "application/json");
  }
  return qboApiFetchRaw(realmId, `/v3/company/${realmId}${path}`, {
    ...init,
    headers,
  });
}
