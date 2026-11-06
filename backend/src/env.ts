/**
 * Read env vars without relying on Node's `process` global (Vercel Edge / TS).
 * Node still exposes `globalThis.process`; Edge-style runtimes may not.
 */
export function env(name: string): string | undefined {
  const proc = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process;
  return proc?.env?.[name];
}
