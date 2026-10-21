// A category key has two parts after the language: naming.<language>.<category>.<setting>.
export const CATEGORY_KEY_PARTS = 2;

export const LANGUAGE_GROUP_TABLES = new Set(['limits', 'naming']);

// Defaults of single values from these configuration groups win over the defaults of other groups.
export const OVERRIDING_GROUPS = new Set<string>(['framework', 'platform', 'library', 'database']);
