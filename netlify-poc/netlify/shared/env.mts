/** Read an env var in a Netlify function or in a local test. */
export function env(name: string, fallback = ""): string {
  const g = globalThis as unknown as { Netlify?: { env: { get(k: string): string | undefined } } };
  return g.Netlify?.env.get(name) ?? process.env[name] ?? fallback;
}
export const APP = () => env("APP_NAME", "netlify-poc");
