import { join } from 'node:path';
import { testdir } from 'testdirs';
import { parseDocument } from 'yaml';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import type { SemgrepRuleFile } from '#tests/types/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findManifestTarget, findConfigFilePath } from '#tests/setup/cli/generated-files.ts';

test('a language choice brings its security rules without selecting security', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'sample.sh': 'echo sample\n',
    });

    const target = findManifestTarget('bash', 'semgrep.yml');
    const defaultSession = await openSession(sandbox.path);
    const defaultOutput = generate(defaultSession);
    expect(
        parseDocument(defaultOutput.files.find((file) => file.path === target)!.content).getIn(['rules', 0, 'id']),
    ).toBe('gspot.bash.curl-pipe-shell');
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['bash', 'security']));
    const securitySession = await openSession(sandbox.path);
    const securityOutput = generate(securitySession);
    const generated = securityOutput.files.find((file) => file.path === target);
    expect(generated?.content).toBe(defaultOutput.files.find((file) => file.path === target)?.content);
    expect(generated?.content).not.toContain('gspot.javascript.no-eval');
});

test.each([...LEVELS])(
    'Cloudflare Worker rules apply to every path at level all only, and Supabase rules use the functions folder (%s)',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['cloudflare'], {
                level,
                tables: '[[scope]]\npath = "api"\n\nconfigurations = ["supabase"]\n[scope.supabase]\nfunctions_folder = "api/edge"\n[[scope]]\npath = "sibling"\n\nremoved_configurations = { value = ["cloudflare"], reason = "This scope does not deploy to Cloudflare." }\n',
            }),
            'src/worker.js': 'fetch(url.searchParams.get("target"));\n',
            'api/edge/handler.js': 'await req.json();\n',
            'sibling/edge/handler.js': 'await req.json();\n',
        });

        const session = await openSession(sandbox.path);
        const output = generate(session);
        const worker = output.files.find(({ path }) => path.endsWith('/cloudflare/semgrep.yml'));
        if (level === 'recommended') expect(worker).toBeUndefined();
        else {
            expect(parseDocument(worker!.content).toJS()).toMatchObject({
                rules: [{ id: 'gspot.cloudflare.wildcard-cors-origin' }],
            });
            expect(parseDocument(worker!.content).getIn(['rules', 0, 'paths'])).toBeUndefined();
        }
        const javascript = output.files.find(({ path }) => path === findManifestTarget('javascript', 'semgrep.yml'))!;
        const { rules: javascriptRules } = parseDocument(javascript.content).toJS() as SemgrepRuleFile;
        expect(javascriptRules.map(({ id }) => id)).toContain('gspot.javascript.ssrf-web-request-user-input');
        const supabase = output.files.find(({ path }) => path.endsWith('/supabase/semgrep.yml'))!;
        const { rules: supabaseRules } = parseDocument(supabase.content).toJS() as SemgrepRuleFile;
        expect(
            supabaseRules
                .filter(({ id }) => id.startsWith('gspot.supabase.edge-'))
                .map(({ id, paths }) => ({ id, paths })),
        ).toStrictEqual(
            ['gspot.supabase.edge-cors-wildcard-with-credentials', 'gspot.supabase.edge-unvalidated-json-body'].map(
                (id) => ({ id, paths: { include: ['/api/edge/**'] } }),
            ),
        );
    },
);

test('JWT rules are written only where the nearest package.json has jsonwebtoken', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            scopes: [{ path: 'jwt' }, { path: 'jwt/child' }, { path: 'other' }],
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
    for (const scope of ['', 'jwt', 'jwt/child', 'other']) {
        const target = findConfigFilePath(session, 'semgrep', scope);
        const text = output.files.find((file) => file.path === target)!.content;
        const ids = (parseDocument(text).toJS() as SemgrepRuleFile).rules.map(({ id }) => id);
        expect(
            ids.filter((id) => id.startsWith('gspot.javascript.jwt-')),
            scope,
        ).toStrictEqual(
            scope.startsWith('jwt')
                ? ['gspot.javascript.jwt-verify-without-algorithms', 'gspot.javascript.jwt-decode-without-verify']
                : [],
        );
        expect(
            ids.filter((id) => id.includes('stack-trace-in-response')),
            scope,
        ).toStrictEqual([]);
    }
});
