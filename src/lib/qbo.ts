import { Buffer } from "buffer";

const QBO_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

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
