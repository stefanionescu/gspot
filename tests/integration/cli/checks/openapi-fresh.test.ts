import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { rejection } from '#tests/support/expectations.ts';
import { openapiFresh } from '#cli/checks/express/openapi.ts';
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import type { OpenapiPlanted as Planted } from '#tests/types/integration/cli/checks.ts';
import { OPENAPI_FRESH_GENERATOR, OPENAPI_FRESH_POLICY } from '#tests/constants/integration/cli/checks.ts';

// A planted Express project whose generator writes the document from schema.json and fails when the schema says so.
async function plant(schema: string): Promise<Planted> {
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
    const spec = session.manifests.get('express')!.checks.find((entry) => entry.analysis === 'openapi-fresh')!;
    const input = engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === '')!,
        spec: spec,
        files: session.repository.files,
    });
    return { directory, document, edited, mode: statSync(document).mode, spec, input };
}

// The dirty document, the untracked file, and the absence of generator side effects, whatever the generator did.
function expectPreserved({ directory, document, edited, mode }: Planted): void {
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
