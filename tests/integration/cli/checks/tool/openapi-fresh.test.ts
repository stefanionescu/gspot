import { join } from 'node:path';
import { test, expect } from 'bun:test';
import type { TestdirResult } from 'testdirs';
import { testdir, createFileTree } from 'testdirs';
import type { CheckSpec } from '#cli/types/kits.ts';
import { commitAll } from '#tests/harness/cli/git.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { scopeInput } from '#tests/harness/cli/input.ts';
import { openapiFresh } from '#cli/checks/tool/openapi.ts';
import { rejection } from '#tests/harness/expectations.ts';
import type { EngineInput } from '#cli/types/execution/execution.ts';
import { statSync, chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const OPENAPI_FRESH_POLICY = policyOf(
    ['express'],
    '[tools.openapi]\ndocument = "openapi.json"\ngenerate = "bun generate.ts \\"\\" \\"two words\\""\n',
);

const OPENAPI_FRESH_GENERATOR = `import { readFileSync, writeFileSync } from 'node:fs';
if (process.argv[2] !== '' || process.argv[3] !== 'two words') throw new Error('Lost command arguments');
writeFileSync('openapi.json', readFileSync('schema.json'));
writeFileSync('side-effect.txt', 'Generator output');
if (readFileSync('schema.json', 'utf8').includes('fail')) {
    console.error('Generation failed');
    process.exitCode = 1;
}
`;

// A planted Express project whose generator writes the document from schema.json and fails when the schema says so.
async function plant(schema: string): Promise<{
    directory: TestdirResult;
    document: string;
    edited: string;
    mode: number;
    spec: CheckSpec;
    input: EngineInput;
}> {
    const directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': OPENAPI_FRESH_POLICY,
        'package.json': '{"private":true}\n',
        'openapi.json': '{"version":1}\n',
        'schema.json': schema,
        'generate.ts': OPENAPI_FRESH_GENERATOR,
    });
    commitAll(directory.path);
    const document = join(directory.path, 'openapi.json');
    const edited = '{"version":2}\n';
    writeFileSync(document, edited);
    chmodSync(document, 0o640);
    writeFileSync(join(directory.path, '0009_manual.sql'), '-- Untracked manual migration\n');
    const session = await openSession(directory.path);
    const spec = session.manifests.get('openapi')!.checks.find((entry) => entry.name === 'openapi/fresh')!;
    const input = scopeInput(session, spec);
    return { directory, document, edited, mode: statSync(document).mode, spec, input };
}

// The dirty document, the untracked file, and the absence of generator side effects, whatever the generator did.
function expectPreserved({
    directory,
    document,
    edited,
    mode,
}: {
    directory: TestdirResult;
    document: string;
    edited: string;
    mode: number;
    spec: CheckSpec;
    input: EngineInput;
}): void {
    expect(readFileSync(document, 'utf8')).toBe(edited);
    expect(statSync(document).mode).toBe(mode);
    expect(readFileSync(join(directory.path, '0009_manual.sql'), 'utf8')).toBe('-- Untracked manual migration\n');
    expect(existsSync(join(directory.path, 'side-effect.txt'))).toBe(false);
}

test('OpenAPI freshness reports a failed generation and preserves dirty and untracked input', async () => {
    const planted = await plant('{"fail":true}\n');
    await using directory = planted.directory;
    expect(await rejection(openapiFresh(planted.input))).toContain('Generation failed');
    expectPreserved(planted);
    expect(directory.path).toBe(planted.directory.path);
});

test('OpenAPI freshness reports a stale document, accepts the regenerated one, and preserves input', async () => {
    const planted = await plant('{"version":3}\n');
    await using directory = planted.directory;
    expect(await openapiFresh(planted.input)).toStrictEqual([
        {
            check: planted.spec.name,
            file: 'openapi.json',
            line: 1,
            rule: 'stale',
            message: 'Running bun generate.ts "" "two words" changes this document; commit what it writes.',
            fixable: false,
        },
    ]);
    writeFileSync(join(directory.path, 'schema.json'), planted.edited);
    expect(await openapiFresh(planted.input)).toStrictEqual([]);
    expectPreserved(planted);
});
