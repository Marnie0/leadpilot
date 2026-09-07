/// <reference types="vite/client" />

/**
 * Typed access to the build-time environment.
 * `DEV` is what gates the console stack-trace echo in `lib/api-client.ts`.
 */
interface ImportMetaEnv {
  /** Overrides the dev-server proxy target for `/api`. See vite.config.ts. */
  readonly VITE_DEV_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
