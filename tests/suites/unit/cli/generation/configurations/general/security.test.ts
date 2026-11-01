import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/engine/session.ts';
import type { SemgrepRuleFile } from '#tests/types/tools.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { getConfigPath, getManifestTarget } from '#tests/setup/cli/generated-files.ts';

test('a language choice brings its security rules without selecting security', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'sample.sh': 'echo sample\n',
    });

    const target = getManifestTarget('bash', 'semgrep.yml');
    const defaultSession = await openSession(sandbox.path);
    const defaultOutput = buildGeneratedFiles(defaultSession);
    expect(
        parseDocument(defaultOutput.files.find((file) => file.path === target)!.content).getIn(['rules', 0, 'id']),
    ).toBe('gspot.bash.curl-pipe-shell');
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['bash', 'security']));
    const securitySession = await openSession(sandbox.path);
    const securityOutput = buildGeneratedFiles(securitySession);
    const generated = securityOutput.files.find((file) => file.path === target);
    expect(generated?.content).toBe(defaultOutput.files.find((file) => file.path === target)?.content);
});

test('Supabase rules use the configured functions folder', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['cloudflare'], {
            level: 'all',
            tables: '[[scope]]\npath = "api"\n\nconfigurations = ["supabase"]\n[scope.supabase]\nfunctions_folder = "api/edge"\n[[scope]]\npath = "sibling"\n\nremoved_configurations = { cloudflare = "This scope does not deploy to Cloudflare." }\n',
        }),
        'src/worker.js': 'fetch(url.searchParams.get("target"));\n',
        'api/edge/handler.js': 'await req.json();\n',
        'sibling/edge/handler.js': 'await req.json();\n',
    });

    const session = await openSession(sandbox.path);
    const output = buildGeneratedFiles(session);
    const supabase = output.files.find(({ path }) => path.endsWith('/supabase/semgrep.yml'))!;
    const { rules: supabaseRules } = parseDocument(supabase.content).toJS() as SemgrepRuleFile;
    expect(
        supabaseRules.filter(({ id }) => id.startsWith('gspot.supabase.edge-')).map(({ id, paths }) => ({ id, paths })),
    ).toStrictEqual(
        ['gspot.supabase.edge-cors-wildcard-with-credentials', 'gspot.supabase.edge-unvalidated-json-body'].map(
            (id) => ({ id, paths: { include: ['/api/edge/**'] } }),
        ),
    );
});

test('JWT rules are written only where the nearest package.json has jsonwebtoken', async () => {
    await using sandbox = await createGitSandbox({
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
    const output = buildGeneratedFiles(session);
    for (const scope of ['', 'jwt', 'jwt/child', 'other']) {
        const target = getConfigPath(session, 'semgrep', scope);
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
    }
});
