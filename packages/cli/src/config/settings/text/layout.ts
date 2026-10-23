const SETTINGS_TOML_FORMAT = { updateOrder: true, bracketSpacing: true, trailingComma: false } as const;

export const TOML_ASSIGNMENT_FORMAT = { ...SETTINGS_TOML_FORMAT, inlineTableStart: 0 } as const;

export const TOML_HEADER_FORMAT = { ...SETTINGS_TOML_FORMAT, inlineTableStart: Number.MAX_SAFE_INTEGER } as const;

export const IGNORE_IDENTITY_FIELDS = ['check', 'rule', 'reason'] as const;
