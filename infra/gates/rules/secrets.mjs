import { finding } from "../lib/context.mjs";
export const id = "secrets";
export const gate = "build";
const TEXT = /\.(m?[jt]sx?|json|ya?ml|toml|md|txt|env|example|html|css|sh|tf|tfvars|hcl|ini|cfg|conf|xml|csv)$/i;
const PATTERNS = [
  [/-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, "a private key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "an AWS access key id"],
  [/\bsk-[A-Za-z0-9]{20,}\b/, "an OpenAI-style API key"],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, "a GitHub token"],
  [/\bAccountKey=[A-Za-z0-9+/=]{40,}/, "an Azure storage account key"],
  [/\bSharedAccessSignature=|[?&]sig=[A-Za-z0-9%+/=]{20,}/, "an Azure SAS token"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, "a Slack token"],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/, "a JWT"],
  [/(?:client_?secret|password|passwd|api[_-]?key|secret)\s*[:=]\s*["']?[A-Za-z0-9~._-]{16,}["']?/i, "a credential-shaped assignment"],
];

export function run(ctx) {
  const f = [];
  for (const rel of ctx.files) {
    const base = rel.split("/").pop();
    if (base === ".env" || (base.startsWith(".env.") && base !== ".env.example")) {
      const gi = ctx.exists(".gitignore") ? ctx.read(".gitignore") : "";
      if (!/^\s*\.env(\*|\.\*)?\s*$/m.test(gi)) f.push(finding(id, "block", `${rel} exists and .gitignore does not exclude .env files. Local secrets must never be committed.`, rel));
      continue; // never scan the contents of a .env file; that would print them
    }
    if (!TEXT.test(rel) || rel === "package-lock.json") continue;
    let text; try { text = ctx.read(rel); } catch { continue; }
    if (text.length > 1_000_000) continue;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const [re, what] of PATTERNS) {
        if (re.test(lines[i]) && !/REPLACE_|example|placeholder|<[^>]+>|\$\{/.test(lines[i])) {
          f.push(finding(id, "block", `${rel}:${i + 1} looks like ${what}. Secrets belong in the vault, referenced from app.yaml \`secrets:\`, never in the repo.`, rel));
          break;
        }
      }
    }
  }
  return f;
}
