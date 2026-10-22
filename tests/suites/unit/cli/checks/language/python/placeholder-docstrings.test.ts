import { test, expect } from 'bun:test';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

import {
    CLEAN_PYTHON_MODULE,
    PYTHON_MODULE_SANDBOX,
    PLACEHOLDER_DOCSTRING_CASES,
} from '#tests/config/checks/language/python/placeholder-docstrings.ts';

test.each([...PLACEHOLDER_DOCSTRING_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    const plan = {
        ...PYTHON_MODULE_SANDBOX,
        cleanSource: CLEAN_PYTHON_MODULE,
    };
    await using sandbox = await createSandbox(plan);
    const result = await runCheckSample(sandbox, entry, plan);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
