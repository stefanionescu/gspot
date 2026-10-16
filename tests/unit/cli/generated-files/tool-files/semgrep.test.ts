import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { buildScopeTarget } from '#cli/repository/scopes.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { SEMGREP_IGNORE_CASES } from '#tests/data/generated-files/ignore-files.ts';
import { SWIFT_IGNORE_FOLDERS } from '#tests/data/checks/security/semgrep-rules.ts';

test('a scoped Semgrep selection shares a root ignore file with repository-relative patterns', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['bash'], {
            level: 'all',
            tables: '[[scope]]\npath = "web"\nconfigurations = ["bash"]\n',
        }),
        '.gitattributes': 'web/gen/** linguist-generated\n',
        'web/main.sh': 'echo source\n',
        'web/gen/output.sh': 'echo generated\n',
    });
    const output = generate(await openSession(sandbox.path));
    const ignore = output.files.find(({ path }) => path === '.semgrepignore');
    expect(ignore?.content).toContain('web/gen/**');
});

test('a language choice brings its security rules without selecting security', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['bash']),
        'sample.sh': 'echo sample\n',
    });
    const target = '.gspot/config/semgrep/bash.yml';
    const plainSession = await openSession(sandbox.path);
    const plainOutput = generate(plainSession);
    expect(
        parseDocument(plainOutput.files.find((file) => file.path === target)!.content).getIn(['rules', 0, 'id']),
    ).toBe('gspot.bash.curl-pipe-shell');
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSettingsText(['bash', 'security']));
    const securitySession = await openSession(sandbox.path);
    const securityOutput = generate(securitySession);
    const generated = securityOutput.files.find((file) => file.path === target);
    expect(generated?.content).toBe(plainOutput.files.find((file) => file.path === target)?.content);
    expect(generated?.content).not.toContain('gspot.javascript.no-eval');
});

test.each([...(['recommended', 'all'] as const)])(
    `Cloudflare Worker rules cover src and Supabase rules use the functions folder at %s`,
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['cloudflare'], {
                level,
                tables: '[[scope]]\npath = "api"\n\nconfigurations = ["supabase"]\n[scope.supabase]\nfunctions_folder = "api/edge"\n[[scope]]\npath = "sibling"\n\nremoved_configurations = ["cloudflare"]\n',
            }),
            'src/worker.js': 'fetch(url.searchParams.get("target"));\n',
            'api/edge/handler.js': 'await req.json();\n',
            'sibling/edge/handler.js': 'await req.json();\n',
        });
        const session = await openSession(sandbox.path);
        const output = generate(session);
        const worker = output.files.find(({ path }) => path.endsWith('/semgrep/cloudflare.yml'));
        if (level === 'recommended') expect(worker).toBeUndefined();
        else {
            expect(parseDocument(worker!.content).toJS()).toMatchObject({
                rules: [{ id: 'gspot.cloudflare.no-wildcard-cors-origin' }],
            });
            expect(parseDocument(worker!.content).getIn(['rules', 0, 'paths'])).toBeUndefined();
        }
        const javascript = output.files.find(({ path }) => path === '.gspot/config/semgrep/javascript.yml')!;
        const runtimeRules: unknown = expect.arrayContaining([
            expect.objectContaining({ id: 'gspot.javascript.ssrf-web-request-user-input' }),
        ]);
        expect(parseDocument(javascript.content).toJS()).toMatchObject({ rules: runtimeRules });
        const supabase = output.files.find(({ path }) => path.endsWith('/semgrep/supabase.yml'))!;
        const expected: unknown = expect.arrayContaining(
            [
                { id: 'gspot.supabase.edge-cors-wildcard-with-credentials', paths: { include: ['/api/edge/**'] } },
                { id: 'gspot.supabase.edge-unvalidated-json-body', paths: { include: ['/api/edge/**'] } },
            ].map((rule): unknown => expect.objectContaining(rule)),
        );
        expect(parseDocument(supabase.content).toJS()).toMatchObject({ rules: expected });
    },
);

test('JWT rules are written only where the nearest package.json has jsonwebtoken', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript'], {
            level: 'all',
            tables: '[[scope]]\npath = "jwt"\n\n[[scope]]\npath = "jwt/child"\n\n[[scope]]\npath = "other"\n\n',
        }),
        'package.json': '{"private":true}',
        'source.js': 'jwt.decode(token);\n',
        'jwt/package.json': '{"private":true,"dependencies":{"jsonwebtoken":"9.0.2"}}',
        'jwt/source.js': 'jwt.decode(token);\n',
        'jwt/child/source.js': 'jwt.decode(token);\n',
        'other/package.json': '{"private":true}',
        'other/source.js': 'jwt.decode(token);\n',
    });
    const session = await openSession(sandbox.path);
    const output = generate(session);
    const declaration = session.scopes[0]!.selected.flatMap(({ toolFiles }) => toolFiles).find(
        ({ target }) => target === '.gspot/config/semgrep/javascript.yml',
    )!;
    for (const scope of ['', 'jwt', 'jwt/child', 'other']) {
        const target = buildScopeTarget(scope, declaration, session.toolFiles().targets);
        const text = output.files.find((file) => file.path === target)!.content;
        const parsed: unknown = parseDocument(text).toJS();
        if (scope.startsWith('jwt')) {
            const jwtRules: unknown = expect.arrayContaining([
                expect.objectContaining({ id: 'gspot.javascript.jwt-no-algorithm-none' }),
                expect.objectContaining({ id: 'gspot.javascript.jwt-no-decode-without-verify' }),
            ]);
            expect(parsed).toMatchObject({ rules: jwtRules });
        } else expect(text).not.toContain('gspot.javascript.jwt-');
        expect(text).not.toContain('no-stack-trace-in-response');
    }
});

test.each([...SEMGREP_IGNORE_CASES])(
    'Semgrep ignores follow selected sources and scopes: $name',
    async ({ configurations, tables, sources, paths, swift, patterns }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...sources,
            'gspot.toml': buildSettingsText(configurations, { level: 'all', tables }),
        });
        const output = generate(await openSession(sandbox.path));
        const ignores = output.files.filter(({ path }) => path.endsWith('.semgrepignore'));
        expect(ignores.map(({ path }) => path)).toStrictEqual([...paths]);
        const root = ignores.find(({ path }) => path === '.semgrepignore')!;
        for (const folder of SWIFT_IGNORE_FOLDERS) expect(root.content.includes(folder)).toBe(swift);
        for (const pattern of patterns)
            expect(ignores.find(({ path }) => path === pattern.path)?.content).toContain(pattern.text);
    },
);
