import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';

test('manual language choices include security output without selecting security separately', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash']),
        'sample.sh': 'echo sample\n',
    });
    const target = '.gspot/config/semgrep/bash.yml';
    const plainSession = await openSession(sandbox.path);
    const plainOutput = emitAll(plainSession);
    expect(
        parseDocument(plainOutput.files.find((file) => file.path === target)!.content).getIn(['rules', 0, 'id']),
    ).toBe('gspot.bash.curl-pipe-shell');
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
        const identifiers = level === 'all' ? ['gspot.cloudflare.no-wildcard-cors-origin'] : [];
        const javascript = output.files.find(({ path }) => path === '.gspot/config/semgrep/javascript.yml')!;
        const runtimeRules: unknown = expect.arrayContaining([
            expect.objectContaining({ id: 'gspot.javascript.ssrf-web-request-user-input' }),
        ]);
        expect(parseDocument(javascript.content).toJS()).toMatchObject({ rules: runtimeRules });
        expect(rules.getIn(['rules', identifiers.length])).toBeUndefined();
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

test.each(['recommended', 'all'] as const)(
    '%s emits JWT rules only for nearest project dependencies',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], {
                level,
                tables: '[scope."jwt"]\n[scope."jwt/child"]\n[scope."other"]\n',
            }),
            'package.json': '{"private":true}',
            'source.js': 'jwt.decode(token);\n',
            'jwt/package.json': '{"private":true,"dependencies":{"jsonwebtoken":"9.0.2"}}',
            'jwt/source.js': 'jwt.decode(token);\n',
            'jwt/child/source.js': 'jwt.decode(token);\n',
            'other/package.json': '{"private":true}',
            'other/source.js': 'jwt.decode(token);\n',
        });
        const output = emitAll(await openSession(sandbox.path));
        for (const scope of ['', 'jwt/', 'jwt/child/', 'other/']) {
            const text = output.files.find(
                (file) => file.path === `.gspot/config/${scope}semgrep/javascript.yml`,
            )!.content;
            const native: unknown = parseDocument(text).toJS();
            if (scope.startsWith('jwt')) {
                const jwtRules: unknown = expect.arrayContaining([
                    expect.objectContaining({ id: 'gspot.javascript.jwt-no-algorithm-none' }),
                    expect.objectContaining({ id: 'gspot.javascript.jwt-no-decode-without-verify' }),
                ]);
                expect(native).toMatchObject({ rules: jwtRules });
            } else expect(text).not.toContain('gspot.javascript.jwt-');
            expect(text).not.toContain('no-stack-trace-in-response');
        }
    },
);
