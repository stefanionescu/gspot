// Extracts every check id the architecture names into check-ids.txt.
// A check id is `kind/name` inside backticks, optionally followed by a rule name.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../architecture/", import.meta.url).pathname;
const OUT = new URL("./check-ids.txt", import.meta.url).pathname;
const KINDS = new Set([
  "typescript", "javascript", "python", "swift", "bash", "sql", "css", "html", "markdown",
  "nextjs", "express", "fastapi", "supabase", "postgres", "cloudflare", "docker", "nginx", "xcode",
  "vitest", "pytest", "zod", "drizzle", "trpc", "tanstack-query", "zustand", "react-hook-form", "i18n",
  "structure", "naming", "prose", "secrets", "vulnerabilities", "dependencies", "licenses", "commits",
  "duplication", "formatting", "docs", "config-files", "static-site", "integrity", "security", "assets",
  "spelling", "coverage", "gspot", "package-json", "sync",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (entry.endsWith(".md")) out.push(path);
  }
  return out;
}

const ids = new Set<string>();
for (const file of walk(ROOT)) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/`([a-z][a-z-]*)\/([a-z0-9][a-z0-9.-]*)`/g)) {
    if (KINDS.has(match[1])) ids.add(`${match[1]}/${match[2]}`);
  }
}
// Rules inside a tool check are cited as `<check> <rule>`; the lint accepts any rule after a known check.
const sorted = [...ids].sort();
writeFileSync(OUT, sorted.join("\n") + "\n");
console.log(`${sorted.length} check ids written to check-ids.txt`);
