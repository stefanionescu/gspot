/** Shared configuration edits use TOML 1.0 inline tables without trailing commas. */
const PATCH_FORMAT = { inlineTableStart: 2, bracketSpacing: false, trailingComma: false } as const;

/** Native generated TOML uses table headers and compact arrays. */

export { PATCH_FORMAT };
