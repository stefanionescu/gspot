import { join } from 'node:path';
import type { Mock } from 'bun:test';
import type { TestdirResult } from 'testdirs';
import * as tools from '#cli/tools/inspect.ts';
import { test, spyOn, expect } from 'bun:test';
import { toPosix } from '#cli/platform/paths.ts';
import { testdir, createFileTree } from 'testdirs';
import type { CheckSpec } from '#cli/types/kits.ts';
import { commitAll } from '#tests/harness/cli/git.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import type { inspectTool } from '#cli/tools/inspect.ts';
import { scopeInput } from '#tests/harness/cli/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import type { EngineInput } from '#cli/types/execution/execution.ts';
import { envTypesFresh, headersSyntax } from '#cli/checks/platform/cloudflare.ts';
import { statSync, chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const CLOUDFLARE_TYPES_GENERATOR = `import { readFileSync, writeFileSync } from 'node:fs';
const content = readFileSync('bindings.txt', 'utf8');
writeFileSync(process.argv[2], content);
writeFileSync('generated-note.txt', 'Generator output');
if (content === 'failure') { console.error('Types generation failed'); process.exitCode = 1; }
`;

const CLOUDFLARE_TYPES_SCOPES = ['', 'workers/api'];

// A planted Worker whose generator stands in for wrangler types: `bindings.txt` is what it writes, or the failure.
async function plant(
    scope: string,
    bindings: string,
): Promise<{
    directory: TestdirResult;
    path: (name: string) => string;
    target: string;
    edited: string;
    mode: number;
    spec: CheckSpec;
    input: EngineInput;
    locate: Mock<typeof inspectTool>;
}> {
    const directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': policyOf(['cloudflare']),
        [join(scope, 'package.json')]: '{"private":true}\n',
        [join(scope, 'cloudflare-env.d.ts')]: '// Committed types\n',
        [join(scope, 'bindings.txt')]: bindings,
        [join(scope, 'types')]: CLOUDFLARE_TYPES_GENERATOR,
    });
    commitAll(directory.path);
    const target = join(directory.path, join(scope, 'cloudflare-env.d.ts'));
    const edited = '// Developer types\n';
    writeFileSync(target, edited);
    chmodSync(target, 0o640);
    const session = await openSession(directory.path);
    const spec = session.manifests.get('cloudflare')!.checks.find((entry) => entry.name === 'cloudflare/types-fresh')!;
    const input = scopeInput(session, spec);
    const locate = spyOn(tools, 'inspectTool').mockReturnValue({
        name: 'wrangler',
        state: 'host',
        path: process.execPath,
    });
    return {
        directory,
        path: (name: string) => join(scope, name),
        target,
        edited,
        mode: statSync(target).mode,
        spec,
        input,
        locate,
    };
}

// The developer's edit, its mode, and the absence of generator side effects, whatever the generator did.
function expectPreserved({
    directory,
    path,
    target,
    edited,
    mode,
}: {
    directory: TestdirResult;
    path: (name: string) => string;
    target: string;
    edited: string;
    mode: number;
    spec: CheckSpec;
    input: EngineInput;
    locate: Mock<typeof inspectTool>;
}): void {
    expect(readFileSync(target, 'utf8')).toBe(edited);
    expect(statSync(target).mode).toBe(mode);
    expect(existsSync(join(directory.path, path('generated-note.txt')))).toBe(false);
}

test.each(CLOUDFLARE_TYPES_SCOPES)(
    'Cloudflare types in %s report a failed generation and preserve source',
    async (scope) => {
        const planted = await plant(scope, 'failure');
        await using directory = planted.directory;
        try {
            expect(await rejection(envTypesFresh(planted.input))).toContain('Types generation failed');
            expectPreserved(planted);
            expect(readFileSync(join(directory.path, planted.path('bindings.txt')), 'utf8')).toBe('failure');
        } finally {
            planted.locate.mockRestore();
        }
    },
);

test.each(CLOUDFLARE_TYPES_SCOPES)(
    'Cloudflare types in %s report stale types, accept regenerated ones, and preserve source',
    async (scope) => {
        const planted = await plant(scope, '// Generated types\n');
        await using directory = planted.directory;
        try {
            expect(await envTypesFresh(planted.input)).toStrictEqual([
                {
                    check: planted.spec.name,
                    file: toPosix(planted.path('cloudflare-env.d.ts')),
                    line: 1,
                    rule: 'stale',
                    message: 'wrangler types writes this file differently. Run it and commit the result.',
                    fixable: false,
                },
            ]);
            writeFileSync(join(directory.path, planted.path('bindings.txt')), planted.edited);
            expect(await envTypesFresh(planted.input)).toStrictEqual([]);
            expectPreserved(planted);
        } finally {
            planted.locate.mockRestore();
        }
    },
);

test('Cloudflare header checks report only files in their owning scope', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': policyOf(['cloudflare'], '[[scope]]\npath = "workers/api"\nkits = ["cloudflare"]\n'),
        _headers: '  Invalid header\n',
        'workers/api/_headers': '/*\n  X-Frame-Options: DENY\n',
    });
    const session = await openSession(directory.path);
    const spec = session.manifests.get('cloudflare')!.checks.find((entry) => entry.name === 'cloudflare/headers')!;
    const input = scopeInput(session, spec);
    const found = headersSyntax(input);
    expect(found).toStrictEqual([
        {
            check: spec.name,
            file: '_headers',
            line: 1,
            rule: 'syntax',
            message: 'This header sits under no path.',
            fixable: false,
        },
    ]);
    expect(headersSyntax({ ...input, scope: 'workers/api' })).toStrictEqual([]);
    writeFileSync(join(directory.path, '_headers'), '/*\n  X-Frame-Options: DENY\n');
    const corrected = await openSession(directory.path);
    expect(headersSyntax(scopeInput(corrected, spec))).toStrictEqual([]);
});
