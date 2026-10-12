export const VALUE_KINDS = new Set(['String', 'Integer', 'Float', 'Boolean', 'DateTime', 'InlineArray', 'InlineTable']);

/** Shared configuration edits use TOML 1.0 inline tables without trailing commas. */
export const PATCH_FORMAT = { inlineTableStart: 2, bracketSpacing: false, trailingComma: false } as const;

/** Native generated TOML uses table headers and compact arrays. */
