import { test } from 'bun:test';
import { expectSampleFix } from '#tests/setup/cli/samples.ts';

import {
    PYTHON_MODULE_SANDBOX,
    PLACEHOLDER_DOCSTRING_CASES,
} from '#tests/config/checks/language/python/placeholder-docstrings.ts';

test.each([...PLACEHOLDER_DOCSTRING_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await expectSampleFix(PYTHON_MODULE_SANDBOX, sample);
    },
);
