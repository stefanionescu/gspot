import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { CI_NODE } from '#cli/config/tools/installers.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { EMPTY_DEFAULT_SOURCE } from '#tests/config/setup/languages.ts';
import { listProjectInstallLines } from '#cli/generation/builders/ci.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('without a setup command, CI installs the locked dependencies of each project and writes Next.js route types', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'python'], {
            tables: '[ci]\nenabled = true\nprovider = "github"\n',
            scopes: [{ path: 'web', configurations: ['nextjs'] }],
        }),
        'package.json': '{"private":true,"packageManager":"npm@11.10.1"}',
        'package-lock.json': '{"lockfileVersion":3}',
        'pyproject.toml': '[project]\nname = "service"\nversion = "1.0.0"\n',
        'uv.lock': 'version = 1\n',
        'web/package.json': '{"private":true,"packageManager":"pnpm@10.30.0","dependencies":{"next":"16.0.0"}}',
        'web/pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
        'web/next.config.ts': EMPTY_DEFAULT_SOURCE,
        'main.py': 'value = 1\n',
        'web/app/page.tsx': 'export default function Page() { return null; }\n',
    });

    const session = await openSession(sandbox.path);
    const uv = readConfigurations()
        .get('python')!
        .tools.find(({ name }) => name === 'uv')?.version;
    expect(listProjectInstallLines(session)).toStrictEqual([
        `mise exec ${CI_NODE} npm@11.10.1 -- npm ci`,
        `mise exec ${CI_NODE} uv@${String(uv)} -- uv sync --locked`,
        `(cd web && mise exec ${CI_NODE} pnpm@10.30.0 -- pnpm install --frozen-lockfile)`,
        '(cd web && npx --no -- next typegen)',
    ]);
});

test('a Next.js scope without a lockfile gets no setup line', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: '[ci]\nenabled = true\nprovider = "github"\n',
            scopes: [{ path: 'web', configurations: ['nextjs'] }],
        }),
        'web/package.json': '{"private":true,"dependencies":{"next":"16.0.0"}}',
        'web/app/page.tsx': 'export default function Page() { return null; }\n',
    });
    expect(listProjectInstallLines(await openSession(sandbox.path))).toStrictEqual([]);
});

test('CI reads no local program version: npm runs bare, and an unpinned pnpm stays unpinned', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: '[ci]\nenabled = true\nprovider = "github"\n',
            scopes: [{ path: 'web' }],
        }),
        'package.json': '{"private":true}',
        'package-lock.json': '{"lockfileVersion":3}',
        'web/package.json': '{"private":true}',
        'web/pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
    });
    const session = await openSession(sandbox.path);
    expect(listProjectInstallLines(session)).toStrictEqual(['npm ci', '(cd web && pnpm install --frozen-lockfile)']);
});
