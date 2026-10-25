export const JSCPD_IMPORT_PATTERNS = [String.raw`import\s[^;]*?from\s*['"][^'"]+['"]\s*;`] as const;

export const JSCPD_IGNORED = ['**/*.md', '**/*.mdx'] as const;
