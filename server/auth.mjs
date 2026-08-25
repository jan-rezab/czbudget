import crypto from "node:crypto";

const PROJECT_ID = process.env.IDENTITY_PLATFORM_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "czbudget-janrezab";
const API_KEY = process.env.IDENTITY_PLATFORM_API_KEY || "";
const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || "https://publicspendingdata.org").replace(/\/$/, "");
const CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const CLOCK_SKEW_SECONDS = 60;
const SESSION_COOKIE = "psd_session";
const REFRESH_COOKIE = "psd_refresh";

let certificateCache = { expiresAt: 0, certificates: {} };

export class AuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function decodeBase64Url(value) {
  return Buffer.from(value, "base64url");
}

function parseCacheMaxAge(value) {
  const match = /(?:^|,)\s*max-age=(\d+)/i.exec(value || "");
  return match ? Number(match[1]) : 3600;
}

async function getCertificates(force = false) {
  if (!force && Date.now() < certificateCache.expiresAt && Object.keys(certificateCache.certificates).length) {
    return certificateCache.certificates;
  }
  const response = await fetch(CERT_URL, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new AuthError(503, "identity_unavailable", "Identity verification is temporarily unavailable.");
  const certificates = await response.json();
  certificateCache = {
    certificates,
    expiresAt: Date.now() + parseCacheMaxAge(response.headers.get("cache-control")) * 1000,
  };
  return certificates;
}

export async function verifyIdToken(token, { requireVerified = true } = {}) {
  if (process.env.NODE_ENV === "test" && process.env.AUTH_DISABLED_FOR_TESTS === "1") {
    return { sub: "test-user", user_id: "test-user", email: "test@example.test", email_verified: true };
  }
  if (!token) throw new AuthError(401, "authentication_required", "A valid login or Bearer token is required.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new AuthError(401, "invalid_token", "The identity token is malformed.");

  let header;
  let claims;
  try {
    header = JSON.parse(decodeBase64Url(parts[0]).toString("utf8"));
    claims = JSON.parse(decodeBase64Url(parts[1]).toString("utf8"));
  } catch {
    throw new AuthError(401, "invalid_token", "The identity token is malformed.");
  }

  if (header.alg !== "RS256" || !header.kid) throw new AuthError(401, "invalid_token", "The identity token uses an unsupported signature.");
  let certificates = await getCertificates();
  let certificate = certificates[header.kid];
  if (!certificate) {
    certificates = await getCertificates(true);
    certificate = certificates[header.kid];
    if (!certificate) throw new AuthError(401, "invalid_token", "The identity token signing key is unknown.");
  }
  const validSignature = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    certificate,
    decodeBase64Url(parts[2]),
  );
  if (!validSignature) throw new AuthError(401, "invalid_token", "The identity token signature is invalid.");

  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== PROJECT_ID || claims.iss !== `https://securetoken.google.com/${PROJECT_ID}`) {
    throw new AuthError(401, "invalid_token", "The identity token was issued for another project.");
  }
  if (!claims.sub || typeof claims.sub !== "string" || claims.sub.length > 128) {
    throw new AuthError(401, "invalid_token", "The identity token subject is invalid.");
  }
  if (!Number.isFinite(claims.exp) || claims.exp < now - CLOCK_SKEW_SECONDS) {
    throw new AuthError(401, "token_expired", "The identity token has expired.");
  }
  if (!Number.isFinite(claims.iat) || claims.iat > now + CLOCK_SKEW_SECONDS) {
    throw new AuthError(401, "invalid_token", "The identity token issue time is invalid.");
  }
  if (requireVerified && claims.email_verified !== true) {
    throw new AuthError(403, "email_not_verified", "Verify your email address before accessing the API.");
  }
  return claims;
}

function parseCookies(request) {
  const cookies = {};
  for (const part of (request.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

export function requestToken(request) {
  const authorization = request.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7).trim();
  return parseCookies(request)[SESSION_COOKIE] || "";
}

function cookie(name, value, maxAge, path = "/") {
  const secure = process.env.NODE_ENV === "production" || PUBLIC_ORIGIN.startsWith("https://");
  return `${name}=${encodeURIComponent(value)}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function setLoginCookies(response, idToken, refreshToken, expiresIn = 3600) {
  response.setHeader("Set-Cookie", [
    cookie(SESSION_COOKIE, idToken, Math.max(60, Number(expiresIn) - 60)),
    cookie(REFRESH_COOKIE, refreshToken, 60 * 60 * 24 * 30, "/auth"),
  ]);
}

function clearLoginCookies(response) {
  response.setHeader("Set-Cookie", [cookie(SESSION_COOKIE, "", 0), cookie(REFRESH_COOKIE, "", 0, "/auth")]);
}

async function identityRequest(action, body) {
  if (!API_KEY) throw new AuthError(503, "identity_not_configured", "Identity Platform is not configured for this deployment.");
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${action}?key=${encodeURIComponent(API_KEY)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const upstream = payload?.error?.message || "IDENTITY_REQUEST_FAILED";
    const code = upstream.split(" : ")[0].toLowerCase();
    const status = ["email_exists", "weak_password"].includes(code) ? 409 : ["email_not_found", "invalid_password", "invalid_login_credentials"].includes(code) ? 401 : 400;
    throw new AuthError(status, code, friendlyIdentityMessage(code));
  }
  return payload;
}

async function refreshRequest(refreshToken) {
  if (!API_KEY) throw new AuthError(503, "identity_not_configured", "Identity Platform is not configured for this deployment.");
  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(API_KEY)}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new AuthError(401, "invalid_refresh_token", "Your session can no longer be refreshed. Sign in again.");
  return payload;
}

function friendlyIdentityMessage(code) {
  const messages = {
    email_exists: "An account already exists for this email address.",
    weak_password: "Choose a stronger password with at least six characters.",
    email_not_found: "The email address or password is incorrect.",
    invalid_password: "The email address or password is incorrect.",
    invalid_login_credentials: "The email address or password is incorrect.",
    too_many_attempts_try_later: "Too many attempts. Please try again later.",
    user_disabled: "This account has been disabled.",
  };
  return messages[code] || "The identity request could not be completed.";
}

function validEmail(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requireCredentials(body) {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!validEmail(email)) throw new AuthError(400, "invalid_email", "Enter a valid email address.");
  if (password.length < 6 || password.length > 128) throw new AuthError(400, "invalid_password", "Password must be between 6 and 128 characters.");
  return { email, password };
}

export async function handleAuth(request, response, pathname, body, sendJSON) {
  response.setHeader("Cache-Control", "no-store");
  if (pathname === "/auth/register" && request.method === "POST") {
    const credentials = requireCredentials(body);
    const account = await identityRequest("accounts:signUp", { ...credentials, returnSecureToken: true });
    await identityRequest("accounts:sendOobCode", {
      requestType: "VERIFY_EMAIL",
      idToken: account.idToken,
      continueUrl: `${PUBLIC_ORIGIN}/developers/login?verified=1`,
    });
    return sendJSON(response, 201, { data: { email: credentials.email, verification_required: true, message: "Account created. Check your inbox to verify your email." } });
  }

  if (pathname === "/auth/login" && request.method === "POST") {
    const credentials = requireCredentials(body);
    const account = await identityRequest("accounts:signInWithPassword", { ...credentials, returnSecureToken: true });
    const claims = await verifyIdToken(account.idToken, { requireVerified: false });
    if (claims.email_verified !== true) throw new AuthError(403, "email_not_verified", "Check your inbox and verify your email before signing in.");
    setLoginCookies(response, account.idToken, account.refreshToken, account.expiresIn);
    return sendJSON(response, 200, {
      data: {
        token_type: "Bearer",
        id_token: account.idToken,
        refresh_token: account.refreshToken,
        expires_in: Number(account.expiresIn),
        user: { id: claims.user_id || claims.sub, email: claims.email, email_verified: true },
      },
    });
  }

  if (pathname === "/auth/refresh" && request.method === "POST") {
    const refreshToken = body.refresh_token || parseCookies(request)[REFRESH_COOKIE];
    if (!refreshToken) throw new AuthError(401, "refresh_token_required", "A refresh token is required.");
    const account = await refreshRequest(refreshToken);
    const claims = await verifyIdToken(account.id_token);
    setLoginCookies(response, account.id_token, account.refresh_token, account.expires_in);
    return sendJSON(response, 200, {
      data: {
        token_type: "Bearer",
        id_token: account.id_token,
        refresh_token: account.refresh_token,
        expires_in: Number(account.expires_in),
        user: { id: claims.user_id || claims.sub, email: claims.email, email_verified: true },
      },
    });
  }

  if (pathname === "/auth/verification/resend" && request.method === "POST") {
    const credentials = requireCredentials(body);
    const account = await identityRequest("accounts:signInWithPassword", { ...credentials, returnSecureToken: true });
    const claims = await verifyIdToken(account.idToken, { requireVerified: false });
    if (claims.email_verified === true) return sendJSON(response, 200, { data: { email: credentials.email, already_verified: true } });
    await identityRequest("accounts:sendOobCode", {
      requestType: "VERIFY_EMAIL",
      idToken: account.idToken,
      continueUrl: `${PUBLIC_ORIGIN}/developers/login?verified=1`,
    });
    return sendJSON(response, 200, { data: { email: credentials.email, verification_sent: true } });
  }

  if (pathname === "/auth/password/reset" && request.method === "POST") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!validEmail(email)) throw new AuthError(400, "invalid_email", "Enter a valid email address.");
    try {
      await identityRequest("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email, continueUrl: `${PUBLIC_ORIGIN}/developers/login` });
    } catch (error) {
      if (!(error instanceof AuthError) || !["email_not_found", "user_not_found"].includes(error.code)) throw error;
    }
    return sendJSON(response, 200, { data: { message: "If an account exists, a password reset email has been sent." } });
  }

  if (pathname === "/auth/logout" && request.method === "POST") {
    clearLoginCookies(response);
    return sendJSON(response, 200, { data: { signed_out: true } });
  }

  if (pathname === "/auth/me" && request.method === "GET") {
    const claims = await verifyIdToken(requestToken(request));
    return sendJSON(response, 200, { data: { id: claims.user_id || claims.sub, email: claims.email, email_verified: true } });
  }

  return false;
}
