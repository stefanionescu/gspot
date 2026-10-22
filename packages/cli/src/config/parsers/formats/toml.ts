/** File edits use TOML 1.0 inline tables without trailing commas. */
export const PATCH_FORMAT = { inlineTableStart: 2, bracketSpacing: false, trailingComma: false } as const;
