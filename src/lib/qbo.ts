import { Buffer } from "buffer";
import { getServerSupabaseClient } from "./supabase";

const QBO_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QBO_API_BASE = process.env.QBO_ENVIRONMENT === "production"
  ? "https://quickbooks.api.intuit.com"
  : "https://sandbox-quickbooks.api.intuit.com";

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

type QboTokenRow = {
  id: string;
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

async function getTokenRow(): Promise<QboTokenRow | null> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase.from("qbo_tokens").select("*").eq("id", "primary").maybeSingle();
  if (error) throw error;
  return data as QboTokenRow | null;
}

async function saveTokenRow(token: QboTokenResponse, state?: string) {
  const supabase = getServerSupabaseClient();
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  const refreshExpiresAt = new Date(Date.now() + token.x_refresh_token_expires_in * 1000).toISOString();

  const { error } = await supabase.from("qbo_tokens").upsert({
    id: "primary",
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    realm_id: token.realmId,
    token_type: token.token_type,
    expires_at: expiresAt,
    refresh_expires_at: refreshExpiresAt,
    state: state || null,
  });
  if (error) throw error;
  return { expiresAt, refreshExpiresAt };
}

function isExpiring(expiresAt: string | null, skewMs = 120_000) {
  if (!expiresAt) return true;
  return Date.parse(expiresAt) < Date.now() + skewMs;
}

export async function ensureAccessToken(): Promise<{ accessToken: string; realmId: string }> {
  const row = await getTokenRow();
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

export async function qboApiFetch<T>(realmId: string, path: string, init: RequestInit = {}): Promise<T> {
  const url = `${QBO_API_BASE}${path}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QBO API error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function authorizedQboFetch<T>(path: string, init: RequestInit = {}) {
  const { accessToken, realmId } = await ensureAccessToken();
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
