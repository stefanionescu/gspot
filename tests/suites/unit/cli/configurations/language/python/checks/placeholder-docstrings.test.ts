import { expect, test } from 'bun:test';

import { PLACEHOLDER_DOCSTRING_CASES, PYTHON_MODULE_SANDBOX } from '#tests/config/configurations/python.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([...PLACEHOLDER_DOCSTRING_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await using sandbox = await createSandbox(PYTHON_MODULE_SANDBOX);
        await assertCheckSample(sandbox, sample, PYTHON_MODULE_SANDBOX.cleanSource);
    },
);

test.each<{ docstring: string; lines: number[] }>([
    { docstring: 'Class that holds an order.', lines: [1] },
    { docstring: 'Class for orders.', lines: [1] },
    { docstring: 'A class of orders.', lines: [1] },
    { docstring: 'Classifies orders by region.', lines: [] },
])(
    'python/placeholder-docstrings reports the class docstring $docstring on lines $lines',
    async ({ docstring, lines }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['python'], { level: 'all' }),
            'model.py': `class Order:\n    """${docstring}"""\n`,
        });
        const findings = await runSandboxCheck(sandbox.path, 'python/placeholder-docstrings');
        expect(findings.map(({ line }) => line)).toStrictEqual(lines);
    },
);
