import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { fresh } from '#cli/checks/tool/openapi.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import type { OpenapiProject } from '#tests/types/cli/checks/tool/openapi.ts';
import { statSync, chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { OPENAPI_FRESH_GENERATOR } from '#tests/config/cli/checks/tool/openapi-fresh.ts';

const OPENAPI_FRESH_POLICY = buildPolicy(['express'], {
    tables: '[tools.openapi]\ndocument = "openapi.json"\ngenerate = "bun generate.ts \\"\\" \\"two words\\""\n',
});

// A test Express project whose generator writes the document from schema.json and fails when the schema says so.
async function applyChanges(schema: string): Promise<OpenapiProject> {
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
    const input = buildEngineInput(session, spec.name);
    return { directory, document, edited, mode: statSync(document).mode, spec, input };
}

// The dirty document, the untracked file, and the absence of generator side effects, whatever the generator did.
function expectPreserved({ directory, document, edited, mode }: OpenapiProject): void {
    expect(readFileSync(document, 'utf8')).toBe(edited);
    expect(statSync(document).mode).toBe(mode);
    expect(readFileSync(join(directory.path, '0009_manual.sql'), 'utf8')).toBe('-- Untracked manual migration\n');
    expect(existsSync(join(directory.path, 'side-effect.txt'))).toBe(false);
}

test('OpenAPI freshness reports a failed generation and preserves dirty and untracked input', async () => {
    const testRepository = await applyChanges('{"fail":true}\n');
    await using directory = testRepository.directory;
    expect(await rejection(fresh(testRepository.input))).toContain('Generation failed');
    expectPreserved(testRepository);
    expect(directory.path).toBe(testRepository.directory.path);
});

test('OpenAPI freshness reports a stale document, accepts the regenerated one, and preserves input', async () => {
    const testRepository = await applyChanges('{"version":3}\n');
    await using directory = testRepository.directory;
    expect(await fresh(testRepository.input)).toStrictEqual([
        {
            check: testRepository.spec.name,
            file: 'openapi.json',
            line: 1,
            rule: 'stale',
            message: 'Running bun generate.ts "" "two words" changes this document; commit what it writes.',
            fixable: false,
        },
    ]);
    writeFileSync(join(directory.path, 'schema.json'), testRepository.edited);
    expect(await fresh(testRepository.input)).toStrictEqual([]);
    expectPreserved(testRepository);
});
