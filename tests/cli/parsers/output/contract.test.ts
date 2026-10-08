// Every output format a manifest can name holds one contract. Empty output is no finding or a GspotError. Output of
// another shape is a GspotError, never another error.
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { GspotError } from '#cli/platform/public.ts';
import { parseOutput } from '#cli/parsers/output/public.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';
import { BASE_CHECK } from '#tests/config/cli/execution/command/findings.ts';
import { FOREIGN, OUTPUTS, JSON_FORMATS } from '#tests/config/cli/parsers/output/contract.ts';

// What the parser did with the output for a check of that format: the findings, or the error it threw.
function parsed(output: NonNullable<CheckDeclaration['output']>, stdout: string, root: string): unknown {
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
    try {
        return parseOutput(check, stdout, '', { root: root, cwd: root });
    } catch (error) {
        return error;
    }
}

test.each(OUTPUTS.map((output) => [output.format, output] as const))(
    'the %s format reads empty output as nothing or a GspotError',
    async (_format, output) => {
        await using sandbox = await testdir();
        expect(parsed(output, '', sandbox.path)).toSatisfy(
            (value) => (Array.isArray(value) && value.length === 0) || value instanceof GspotError,
        );
    },
);

test.each(
    OUTPUTS.filter((output) => JSON_FORMATS.has(output.format)).map((output) => [output.format, output] as const),
)('the %s format refuses output that is not JSON as a GspotError', async (_format, output) => {
    await using sandbox = await testdir();
    expect(parsed(output, FOREIGN, sandbox.path)).toBeInstanceOf(GspotError);
});

test.each(
    OUTPUTS.filter((output) => !JSON_FORMATS.has(output.format) && output.format !== 'none').map(
        (output) => [output.format, output] as const,
    ),
)('the %s format reads a line no pattern matches as nothing or a GspotError', async (_format, output) => {
    await using sandbox = await testdir();
    expect(parsed(output, FOREIGN, sandbox.path)).toSatisfy(
        (value) => Array.isArray(value) || value instanceof GspotError,
    );
});
