import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { parseOutput } from '#cli/engine/outputs/formats.ts';
import type { CheckStop } from '#cli/system/errors.ts';
import { CHECK_OUTPUTS } from '#tests/config/engine/outputs.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test.each(CHECK_OUTPUTS.flatMap(({ format, inputs }) => inputs.map((input) => ({ format, input }))))(
    'the $format format refuses $input output as an error of the check',
    async ({ format, input }) => {
        await using sandbox = await testdir();
        const check = {
            id: 'sandbox/output',
            runs: 'files' as const,
            output: { format },
        };
        const stdout = input === 'empty' ? '' : 'not the output of any tool {\n';
        expect(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(
            matchFields<CheckStop>({ name: 'CheckStop', status: 'error' }),
        );
    },
);
