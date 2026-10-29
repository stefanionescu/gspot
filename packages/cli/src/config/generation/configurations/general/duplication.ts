export const JSCPD_IMPORT_PATTERNS = [
    String.raw`import\s[^;]*?from\s*['"][^'"]+['"]\s*;`,
    String.raw`(?:^|\n)[\t ]*(?:from[\t ]+(?:\\\r?\n[\t ]*)*[\w.]+[\t ]+(?:\\\r?\n[\t ]*)*)?import[\t ]+(?:\\\r?\n[\t ]*)*(?:\([^;)]*\)|(?:\\\r?\n|[^;\r\n])*)`,
] as const;

export const JSCPD_IGNORED = ['**/*.md', '**/*.mdx'] as const;

export const JSCPD_CHECK = 'duplication/jscpd';
