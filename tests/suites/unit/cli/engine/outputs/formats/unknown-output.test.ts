import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { outputSchema } from '#cli/schemas/manifests/checks.ts';
import type { Finding } from '#cli/types/engine/tool-runs.ts';
import { CHECK_OUTPUTS, OUTPUT_PARSE_RESULTS } from '#tests/config/engine/outputs.ts';

function readParseResult(parse: () => Finding[]): { findings: readonly Finding[] } | { error: string } {
    try {
        return { findings: parse() };
    } catch (error) {
        return { error: (error as Error).message };
    }
}

test.each(
    CHECK_OUTPUTS.flatMap((output) =>
        (['empty', 'foreign'] as const).map((input) => ({ format: output.format, output, input })),
    ),
)(
    'the $format format reads $input output into its exact findings or its refusal',
    async ({ format, output, input }) => {
        await using sandbox = await testdir();
        const check = {
            id: 'sandbox/output',
            runs: 'files' as const,
            help: 'Correct the sandbox file.',
            output: outputSchema.parse(output),
        };
        const stdout = input === 'empty' ? '' : 'not the output of any tool {\n';
        expect(
            readParseResult(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })),
        ).toStrictEqual(OUTPUT_PARSE_RESULTS[format][input]);
    },
);
