export const JSCPD_IGNORED = ['**/*.md', '**/*.mdx'] as const;

/** An ES import statement. jscpd skips import lists, because they hold no copied logic. */
export const JSCPD_IMPORT_PATTERNS = [String.raw`import\s[^;]*?from\s*['"][^'"]+['"]\s*;`] as const;
