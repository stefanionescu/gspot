export const SORT_LEVELS = [
    { level: 'recommended', severity: 0, enabled: false } as const,
    { level: 'all', severity: 2, enabled: true } as const,
];

export const SORT_RULES = [
    'perfectionist/sort-imports',
    'perfectionist/sort-named-imports',
    'perfectionist/sort-exports',
    'perfectionist/sort-named-exports',
];

export const SORT_CASES = [
    {
        name: 'side-effect boundary',
        source: "import { long } from 'long';\nimport 'effect';\nimport a from 'a';\n",
        fixed: "import a from 'a';\nimport 'effect';\nimport { long } from 'long';\n",
    },
    {
        name: 'comment attachment',
        source: "// File header\nimport { z } from 'z';\n// Keep me with b\nimport { bbb } from 'bbb';\nimport a from 'a';\n",
        fixed: "// File header\n// Keep me with b\nimport a from 'a';\nimport { z } from 'z';\nimport { bbb } from 'bbb';\n",
    },
    {
        name: 'export order',
        source: "export { longer } from 'longer';\nexport { a } from 'a';\n",
        fixed: "export { a } from 'a';\nexport { longer } from 'longer';\n",
    },
    { name: 'names', source: "import { bbb, a, cc } from 'x';\n", fixed: "import { a, cc, bbb } from 'x';\n" },
    {
        name: 'groups',
        source: "import {\n long,\n longer,\n} from 'multi';\nimport a from 'a';\n",
        fixed: "import a from 'a';\n\nimport {\n long,\n longer,\n} from 'multi';\n",
    },
    { name: 'exports', source: 'export { bbb, a, cc };\n', fixed: 'export { a, cc, bbb };\n' },
    {
        name: 'bare',
        source: "import 'long-side-effect';\nimport 'a';\n",
        fixed: "import 'long-side-effect';\nimport 'a';\n",
    },
    {
        name: 'header',
        source: "// File header\nimport { bb } from 'bb';\nimport { aa } from 'aa';\n",
        fixed: "// File header\nimport { aa } from 'aa';\nimport { bb } from 'bb';\n",
    },
];
