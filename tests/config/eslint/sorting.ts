export const SORT_LEVELS = [
    { level: 'recommended', severity: 0 },
    { level: 'all', severity: 2 },
] as const;

export const SORT_RULES = [
    'perfectionist/sort-imports',
    'perfectionist/sort-named-imports',
    'perfectionist/sort-exports',
    'perfectionist/sort-named-exports',
] as const;

export const SORT_CASES = [
    { source: "import { bbb, a, cc } from 'x';\n", fixed: "import { a, cc, bbb } from 'x';\n" },
    { source: 'export { bbb, a, cc };\n', fixed: 'export { a, cc, bbb };\n' },
    {
        source: `// File header
import { bb } from 'bb';
import { aa } from 'aa';
`,
        fixed: `// File header
import { aa } from 'aa';
import { bb } from 'bb';
`,
    },
] as const;
