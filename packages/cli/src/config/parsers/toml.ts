// The strings of a TOML file, read whole: triple-quoted ones span lines, and a backslash escapes inside a
// basic string.
export const TOML_STRINGS = /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'[^'\n]*'/u;

export const BARE_KEY = /^[\w-]+$/u;

/** TOML syntax nodes named by the parser's private enum. */
export const NODE_KINDS = [
    'Document',
    'Table',
    'TableKey',
    'TableArray',
    'TableArrayKey',
    'KeyValue',
    'Key',
    'String',
    'Integer',
    'Float',
    'Boolean',
    'DateTime',
    'InlineArray',
    'InlineItem',
    'InlineTable',
    'Comment',
] as const;

export const NODE_KIND_SET = new Set<string>(NODE_KINDS);

export const VALUE_KINDS = new Set(['String', 'Integer', 'Float', 'Boolean', 'DateTime', 'InlineArray', 'InlineTable']);

/** Shared configuration edits use TOML 1.0 inline tables without trailing commas. */
export const PATCH_FORMAT = { inlineTableStart: 2, bracketSpacing: false, trailingComma: false };
