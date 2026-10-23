import { RECEIPT_SOURCE } from '#tests/config/integration/checks/language/typescript/samples.ts';

export const TYPESCRIPT_CASES = [
    {
        check: 'javascript/eslint',
        files: {
            'src/orders/back.ts': `// An order module that reaches back into the entry.
import { receipt } from '#entry';

/** The entry receipt with the order label, as the order screen shows it. */
export const receiptLabel = \`Order: \${receipt}\`;
`,
        },
        expected: { file: 'src/orders/back.ts', rule: 'boundaries/dependencies', line: 2 },
        // The alias rule also asks the exact package.json import #entry for a file extension, which it cannot take.
        findings: [
            { file: 'src/orders/back.ts', rule: 'no-restricted-syntax', line: 2 },
            { file: 'src/orders/back.ts', rule: 'boundaries/dependencies', line: 2 },
        ],
    },
    {
        check: 'javascript/knip',
        files: {
            'src/orders/unused.ts': `// Nothing imports this.

/** A value nobody reads. */
export const unused = 1;
`,
        },
        expected: { file: 'src/orders/unused.ts', message: 'Unused file: src/orders/unused.ts' },
        corrected: {
            files: {
                'src/orders/unused.ts': `// Nothing imports this.

/** A value nobody reads. */
export const unused = 1;
`,
                'src/main.ts':
                    RECEIPT_SOURCE +
                    `
import { unused } from './orders/unused.js';
export const additional = unused;
`,
            },
        },
    },
] as const;
