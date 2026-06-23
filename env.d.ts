/// <reference types="vite/client" />
/// <reference types="@atcute/atproto" />
/// <reference types="@atcute/bluesky" />

interface ImportMetaEnv {
  /** OAuth `client_id` — the public URL of client-metadata.json (or a loopback client_id in dev). */
  readonly VITE_OAUTH_CLIENT_ID: string;
  /** OAuth redirect URI the authorization server sends the user back to. */
  readonly VITE_OAUTH_REDIRECT_URI: string;
  /** OAuth scope string. */
  readonly VITE_OAUTH_SCOPE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
