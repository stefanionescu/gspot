// Every output format a manifest can name holds one contract. Empty output is no finding or a GspotError. Output of
// another shape is a GspotError, never another error.
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import type { CheckSpec } from '#cli/types/kits.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { parseOutput } from '#cli/execution/tool/formats.ts';

// One output setting per format. Each carries the patterns or fields its format needs.
const OUTPUTS: NonNullable<CheckSpec['output']>[] = [
    { format: 'regex', pattern: String.raw`^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$` },
    {
        format: 'grouped',
        file_pattern: String.raw`^(?<file>\S.*):$`,
        pattern: String.raw`^\s+(?<line>\d+): (?<message>.*)$`,
    },
    { format: 'lines' },
    { format: 'none' },
    { format: 'json', fields: { file: 'file', line: 'line', rule: 'rule', message: 'message' } },
    { format: 'eslint-json' },
    { format: 'typos-json' },
    { format: 'trufflehog-json' },
    { format: 'markdownlint-json' },
];
const JSON_FORMATS = new Set(['json', 'eslint-json', 'typos-json', 'trufflehog-json', 'markdownlint-json']);
const FOREIGN = 'not the output of any tool {\n';

// What the parser did with the output for a check of that format: the findings, or the error it threw.
function parsed(output: NonNullable<CheckSpec['output']>, stdout: string, root: string): unknown {
    const spec: CheckSpec = {
        name: 'sandbox/output',
        level: 'recommended',
        stage: 'commit',
        runs: 'per-file-list',
        summary: 'Reads the output of a sandbox tool.',
        example: 'sandbox',
        why: 'The output contract holds for every format.',
        help: 'Correct the sandbox file.',
        output,
    };
    try {
        return parseOutput(spec, stdout, '', root);
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
