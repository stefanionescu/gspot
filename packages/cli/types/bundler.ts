// Types of what bundler-audit prints as JSON.

/** One gem bundler-audit names. */
export type AuditedGem = { name: string; version: string };

/** One advisory of the Ruby advisory database. */
export type GemAdvisory = { id: string; title: string; patched_versions?: string[] };

/** What bundler-audit check --format json prints. A result names a gem and its advisory, or a source over plain HTTP. */
export type AuditedGems = {
    results: { type: string; source?: string; gem?: AuditedGem; advisory?: GemAdvisory }[];
};
