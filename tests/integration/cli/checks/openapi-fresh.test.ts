import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { openapiFresh } from '#cli/checks/express/openapi.ts';
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const POLICY =
    'version = 1\nconfigurations = ["express"]\n[tools.openapi]\ndocument = "openapi.json"\nproduced_by = "bun generate.ts \\\"\\\" \\\"two words\\\""\n';
const GENERATOR = `import { readFileSync, writeFileSync } from 'node:fs';
if (process.argv[2] !== '' || process.argv[3] !== 'two words') throw new Error('Lost command arguments');
writeFileSync('openapi.json', readFileSync('schema.json'));
writeFileSync('side-effect.txt', 'Generator output');
if (readFileSync('schema.json', 'utf8').includes('fail')) {
    console.error('Generation failed');
    process.exitCode = 1;
}
`;

for (const isFailure of [false, true]) {
    test(`OpenAPI freshness preserves dirty and untracked input when generation ${isFailure ? 'fails' : 'succeeds'}`, async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': POLICY,
            'package.json': '{"private":true}\n',
            'openapi.json': '{"version":1}\n',
            'schema.json': isFailure ? '{"fail":true}\n' : '{"version":3}\n',
            'generate.ts': GENERATOR,
        });
        commitAll(directory.path);
        const document = join(directory.path, 'openapi.json');
        const edited = '{"version":2}\n';
        writeFileSync(document, edited);
        chmodSync(document, 0o640);
        const mode = statSync(document).mode;
        writeFileSync(join(directory.path, '0009_manual.sql'), '-- Untracked manual migration\n');
        const session = await openSession(directory.path);
        const spec = session.manifests.get('express')!.checks.find((entry) => entry.analysis === 'openapi-fresh')!;
        const input = engineInput(session, {
            scope: session.scopes.find((entry) => entry.scope.path === '')!,
            spec: spec,
            files: session.repository.files,
        });
        if (isFailure) await expect(openapiFresh(input)).rejects.toThrow('Generation failed');
        else {
            expect(await openapiFresh(input)).toStrictEqual([
                {
                    check: spec.name,
                    file: 'openapi.json',
                    line: 1,
                    rule: 'stale',
                    message: 'Running bun generate.ts "" "two words" changes this document; commit what it writes.',
                    fixable: false,
                },
            ]);
            writeFileSync(join(directory.path, 'schema.json'), edited);
            expect(await openapiFresh(input)).toStrictEqual([]);
        }
        expect(readFileSync(document, 'utf8')).toBe(edited);
        expect(statSync(document).mode).toBe(mode);
        expect(readFileSync(join(directory.path, '0009_manual.sql'), 'utf8')).toBe('-- Untracked manual migration\n');
        expect(existsSync(join(directory.path, 'side-effect.txt'))).toBe(false);
    });
}
