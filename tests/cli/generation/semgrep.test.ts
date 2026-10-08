import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';

test('manual language choices include security output without selecting security separately', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash']),
        'sample.sh': 'echo sample\n',
    });
    const target = '.gspot/config/semgrep/bash.yml';
    const plainSession = await openSession(sandbox.path);
    const plainOutput = emitAll(plainSession);
    expect(plainOutput.files.find((file) => file.path === target)?.content).toContain('rules:');
    await writeFile(join(sandbox.path, 'gspot.toml'), buildPolicy(['bash', 'security']));
    const securitySession = await openSession(sandbox.path);
    const securityOutput = emitAll(securitySession);
    const generated = securityOutput.files.find((file) => file.path === target);
    expect(generated?.content).toBe(plainOutput.files.find((file) => file.path === target)?.content);
});

for (const level of ['recommended', 'all'] as const) {
    test(`Worker security rules cover src and edge rules retain configured paths at ${level}`, async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['cloudflare'], {
                level,
                tables: '[scope.api]\nconfigurations = ["supabase"]\n[scope.api.supabase]\nfunctions_folder = "edge"\n[scope.sibling]\nremoved_configurations = ["cloudflare"]\n',
            }),
            'src/worker.js': 'fetch(url.searchParams.get("target"));\n',
            'api/edge/handler.js': 'await req.json();\n',
            'sibling/edge/handler.js': 'await req.json();\n',
        });
        const session = await openSession(sandbox.path);
        const output = emitAll(session);
        const worker = output.files.find(({ path }) => path.endsWith('/semgrep/workers.yml'))!;
        const rules = parseDocument(worker.content);
        const identifiers =
            level === 'all'
                ? ['gspot.cloudflare.no-user-controlled-fetch', 'gspot.cloudflare.no-wildcard-cors-origin']
                : ['gspot.cloudflare.no-user-controlled-fetch'];
        expect(identifiers.map((_, index) => rules.getIn(['rules', index, 'id']))).toStrictEqual(identifiers);
        expect(identifiers.map((_, index) => rules.getIn(['rules', index, 'paths']))).toStrictEqual(
            identifiers.map(() => undefined),
        );
        const supabase = output.files.find(({ path }) => path.endsWith('/semgrep/supabase.yml'))!;
        const expected: unknown = expect.arrayContaining(
            [
                { id: 'gspot.supabase.edge-cors-wildcard-with-credentials', paths: { include: ['/api/edge/**'] } },
                { id: 'gspot.supabase.edge-unvalidated-json-body', paths: { include: ['/api/edge/**'] } },
            ].map((rule): unknown => expect.objectContaining(rule)),
        );
        expect(parseDocument(supabase.content).toJS()).toMatchObject({ rules: expected });
    });
}
