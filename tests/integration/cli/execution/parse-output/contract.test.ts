// Every output parser a manifest can name holds one contract. Empty output is no finding or a GspotError. Output
// of another shape is a GspotError, never another error.
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import type { CheckSpec } from '#cli/types/kits.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { parseOutput } from '#cli/execution/tool/formats.ts';

const JSON_FORMATS = new Set(['json', 'eslint-json', 'typos-json', 'trufflehog-json', 'markdownlint-json']);
const SPECS = [...kitManifests().values()]
    .flatMap((manifest) => manifest.checks)
    .filter((spec) => spec.output !== undefined)
    .map((spec): [string, CheckSpec] => [spec.name, spec]);

// What the parser did with the output: the findings, or the error it threw.
function parsed(spec: CheckSpec, stdout: string, root: string): { findings?: unknown[]; error?: unknown } {
    try {
        return { findings: parseOutput(spec, stdout, '', root) };
    } catch (error) {
        return { error };
    }
}

test.each(SPECS)('%s reads empty output as nothing or a GspotError', async (_name, spec) => {
    await using sandbox = await testdir();
    const empty = parsed(spec, '', sandbox.path);
    expect(empty.error === undefined ? empty.findings : empty.error).toSatisfy((value) =>
        Array.isArray(value) ? value.length === 0 : value instanceof GspotError,
    );
});

test.each(SPECS.filter(([, spec]) => JSON_FORMATS.has(spec.output?.format ?? '')))(
    '%s refuses output that is not JSON as a GspotError',
    async (_name, spec) => {
        await using sandbox = await testdir();
        expect(parsed(spec, 'not the output of any tool {\n', sandbox.path).error).toBeInstanceOf(GspotError);
    },
);

test.each(SPECS.filter(([, spec]) => !JSON_FORMATS.has(spec.output?.format ?? '')))(
    '%s reads a line no pattern matches as nothing or a GspotError',
    async (_name, spec) => {
        await using sandbox = await testdir();
        const foreign = parsed(spec, 'not the output of any tool {\n', sandbox.path);
        expect(foreign.error === undefined ? foreign.findings : foreign.error).toSatisfy(
            (value) => Array.isArray(value) || value instanceof GspotError,
        );
    },
);
