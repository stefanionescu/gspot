import { test } from 'bun:test';

import { DEBUGGER_SAMPLE, ESLINT_SANDBOX } from '#tests/config/integration/javascript.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

const eslintSandbox = shareInstalledSandbox({ ...ESLINT_SANDBOX, level: 'basic' });

test('javascript/eslint lints a project that has no TypeScript', async () => {
    await assertCheckSample(eslintSandbox(), DEBUGGER_SAMPLE);
});

test('javascript/import-cycles reports a cycle and skips a disable comment for a plugin it does not load', async () => {
    await assertCheckSample(eslintSandbox(), {
        check: 'javascript/import-cycles',
        files: {
            'src/first.js':
                "import { second } from './second.js';\n\n// eslint-disable-next-line acme/no-loops -- reason: the project loads acme.\nexport const first = second;\n",
            'src/second.js': "import { first } from './first.js';\n\nexport const second = first;\n",
        },
        expected: { file: 'src/first.js', line: 1, rule: 'import-x/no-cycle' },
        findings: [
            { file: 'src/first.js', line: 1, rule: 'import-x/no-cycle' },
            { file: 'src/second.js', line: 1, rule: 'import-x/no-cycle' },
        ],
        corrected: { files: { 'src/second.js': 'export const second = 2;\n' } },
    });
});
