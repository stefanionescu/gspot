import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { PYTHON_MODULE_SANDBOX, PLACEHOLDER_DOCSTRING_CASES } from '#tests/config/configurations/python.ts';

test.each([...PLACEHOLDER_DOCSTRING_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await using sandbox = await createSandbox(PYTHON_MODULE_SANDBOX);
        await assertCheckSample(sandbox, sample, PYTHON_MODULE_SANDBOX.cleanSource);
    },
);

test.each(['Class that holds an order.', 'Class for orders.', 'A class of orders.'])(
    'python/placeholder-docstrings reports the class docstring %s',
    async (docstring) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['python'], { level: 'all' }),
            'model.py': `class Order:\n    """${docstring}"""\n`,
        });
        const findings = await runSandboxCheck(sandbox.path, 'python/placeholder-docstrings');
        expect(findings.map(({ line }) => line)).toStrictEqual([1]);
    },
);
