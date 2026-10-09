// Each format has one native outcome for empty output and output from a different tool.
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { GspotError } from '#cli/platform/public.ts';
import { parseOutput } from '#cli/parsers/output/public.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';
import { BASE_CHECK } from '#tests/config/cli/execution/command/findings.ts';

import {
    FOREIGN,
    OUTPUTS,
    EMPTY_ERRORS,
    JSON_FORMATS,
    LINE_FINDINGS,
} from '#tests/config/cli/parsers/output/contract.ts';

test.each(OUTPUTS.flatMap((output) => ['empty', 'foreign'].map((input) => ({ format: output.format, output, input }))))(
    'the $format format has one outcome for $input output',
    async ({ output, input }) => {
        await using sandbox = await testdir();
        const check: CheckDeclaration = {
            ...BASE_CHECK,
            name: 'sandbox/output',
            summary: 'Reads the output of a sandbox tool.',
            example: 'sandbox',
            why: 'The output contract holds for every format.',
            help: 'Correct the sandbox file.',
            output,
        };
        delete check.command;
        let result: unknown;
        try {
            result = parseOutput(check, input === 'empty' ? '' : FOREIGN, '', {
                root: sandbox.path,
                cwd: sandbox.path,
            });
        } catch (error) {
            result = error;
        }
        const fails = (input === 'empty' ? EMPTY_ERRORS : JSON_FORMATS).has(output.format);
        if (fails) expect(result).toBeInstanceOf(GspotError);
        else expect(result).toStrictEqual(input === 'foreign' && output.format === 'lines' ? LINE_FINDINGS : []);
    },
);
