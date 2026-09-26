import { join } from 'node:path';
import * as tools from '#cli/tools/probe.ts';
import { rejects } from 'node:assert/strict';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { envTypesFresh, headersSyntax } from '#cli/checks/cloudflare.ts';
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const GENERATOR = `import { readFileSync, writeFileSync } from 'node:fs';
const content = readFileSync('bindings.txt', 'utf8');
writeFileSync(process.argv[2], content);
writeFileSync('generated-note.txt', 'Generator output');
if (content === 'failure') { console.error('Types generation failed'); process.exitCode = 1; }
`;

for (const scope of ['', 'workers/api']) {
    for (const isFailure of [false, true]) {
        test(`Cloudflare types in ${scope || 'root'} preserve source after ${isFailure ? 'failure' : 'success'}`, async () => {
            await using directory = await testdir();
            const path = (name: string) => join(scope, name);
            await createFileTree(directory.path, {
                'gspot.toml': 'version = 1\nconfigurations = ["cloudflare"]\n',
                [path('package.json')]: '{"private":true}\n',
                [path('cloudflare-env.d.ts')]: '// Committed types\n',
                [path('bindings.txt')]: isFailure ? 'failure' : '// Generated types\n',
                [path('types')]: GENERATOR,
            });
            commitAll(directory.path);
            const target = join(directory.path, path('cloudflare-env.d.ts'));
            const edited = '// Developer types\n';
            writeFileSync(target, edited);
            chmodSync(target, 0o640);
            const mode = statSync(target).mode;
            const session = await openSession(directory.path);
            const spec = session.manifests
                .get('cloudflare')!
                .checks.find((entry) => entry.analysis === 'cloudflare-env-types')!;
            const input = engineInput(session, {
                scope: session.scopes.find((entry) => entry.scope.path === '')!,
                spec: spec,
                files: session.repository.files,
            });
            const locate = spyOn(tools, 'probeTool').mockReturnValue({
                name: 'wrangler',
                state: 'host',
                path: process.execPath,
            });
            try {
                if (isFailure) await rejects(envTypesFresh(input), { message: /Types generation failed/u });
                else {
                    expect(await envTypesFresh(input)).toStrictEqual([
                        {
                            check: spec.name,
                            file: path('cloudflare-env.d.ts').replaceAll('\\', '/'),
                            line: 1,
                            rule: 'stale-types',
                            message: 'wrangler types writes this file differently. Run it and commit the result.',
                            fixable: false,
                        },
                    ]);
                    writeFileSync(join(directory.path, path('bindings.txt')), edited);
                    expect(await envTypesFresh(input)).toStrictEqual([]);
                }
                expect(readFileSync(target, 'utf8')).toBe(edited);
                expect(statSync(target).mode).toBe(mode);
                expect(existsSync(join(directory.path, path('generated-note.txt')))).toBe(false);
            } finally {
                locate.mockRestore();
            }
        });
    }
}

test('Cloudflare header checks report only files in their owning scope', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["cloudflare"]\n[[scope]]\npath = "workers/api"\nconfigurations = ["cloudflare"]\n',
        _headers: '  Invalid header\n',
        'workers/api/_headers': '/*\n  X-Frame-Options: DENY\n',
    });
    const session = await openSession(directory.path);
    const spec = session.manifests.get('cloudflare')!.checks.find((entry) => entry.analysis === 'cloudflare-headers')!;
    const input = engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === '')!,
        spec: spec,
        files: session.repository.files,
    });
    const found = await headersSyntax(input);
    expect(found).toStrictEqual([
        {
            check: spec.name,
            file: '_headers',
            line: 1,
            rule: 'headers-syntax',
            message: 'This header sits under no path.',
            fixable: false,
        },
    ]);
    expect(await headersSyntax({ ...input, scope: 'workers/api' })).toStrictEqual([]);
    writeFileSync(join(directory.path, '_headers'), '/*\n  X-Frame-Options: DENY\n');
    const corrected = await openSession(directory.path);
    expect(
        await headersSyntax(
            engineInput(corrected, {
                scope: corrected.scopes.find((entry) => entry.scope.path === '')!,
                spec,
                files: corrected.repository.files,
            }),
        ),
    ).toStrictEqual([]);
});
