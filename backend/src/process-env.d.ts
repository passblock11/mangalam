/**
 * Minimal `process.env` typings for Edge + shared server code.
 * Avoids relying on @types/node during Vercel's production install / typecheck.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    SUPABASE_JWT_SECRET?: string;
  }
}

declare const process: { env: NodeJS.ProcessEnv };
