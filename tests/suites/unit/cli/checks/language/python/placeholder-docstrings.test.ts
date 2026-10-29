import { test } from 'bun:test';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';

import {
    PYTHON_MODULE_SANDBOX,
    PLACEHOLDER_DOCSTRING_CASES,
} from '#tests/config/checks/language/python/placeholder-docstrings.ts';

test.each([...PLACEHOLDER_DOCSTRING_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await using sandbox = await createSandbox(PYTHON_MODULE_SANDBOX);
        await assertCheckSample(sandbox, sample, PYTHON_MODULE_SANDBOX.cleanSource);
    },
);
