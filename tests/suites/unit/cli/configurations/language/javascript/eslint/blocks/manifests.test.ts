import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings, readEslintRules } from '#tests/setup/eslint/lint.ts';

test('the src files of a Vite app may read only VITE_ variables, and its other files may read any', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'vue']),
        'package.json': '{"private":true,"type":"module","devDependencies":{"vite":"0.0.0-test"}}',
        'src/main.ts': 'export const value = 1;\n',
        'src/App.vue': '<template><p>Hello</p></template>\n',
        'vite.config.ts': 'export default {};\n',
        'server/src/main.ts': 'export const value = 1;\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = await readEslintRules(eslint, ['src/main.ts', 'src/App.vue', 'vite.config.ts', 'server/src/main.ts']);
    for (const file of ['src/main.ts', 'src/App.vue']) {
        const options = rules[file]!['gspot/no-client-environment']?.[1];
        expect(options).toMatchObject({ client: true, publicPrefixes: ['VITE_'] });
        expect(options).toHaveProperty('allowedNames');
    }
    expect(rules['vite.config.ts']!['gspot/no-client-environment']?.[1]).toMatchObject({ client: false });
    expect(rules['server/src/main.ts']!['gspot/no-client-environment']?.[1]).toMatchObject({ client: false });
});

test('Expo app code may read only EXPO_PUBLIC_ variables, and API routes and configs may read any', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'expo']),
        'package.json': '{"private":true,"type":"module","dependencies":{"expo":"0.0.0-test"}}',
        'app/index.jsx': 'export default function Home() { return null; }\n',
        'app/items+api.js': 'export function GET() { return Response.json([]); }\n',
        'app.config.js': 'export default {};\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = await readEslintRules(eslint, ['app/index.jsx', 'app/items+api.js', 'app.config.js']);
    const options = rules['app/index.jsx']!['gspot/no-client-environment']?.[1];
    expect(options).toMatchObject({ client: true, publicPrefixes: ['EXPO_PUBLIC_'] });
    expect(options).toHaveProperty('allowedNames');
    expect(rules['app/items+api.js']!['gspot/no-client-environment']?.[1]).toMatchObject({ client: false });
    expect(rules['app.config.js']!['gspot/no-client-environment']?.[1]).toMatchObject({ client: false });
});

test('the server files of a SvelteKit app under src may read any variable', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'svelte']),
        'package.json': '{"private":true,"type":"module","devDependencies":{"vite":"0.0.0-test"}}',
        'src/routes/+page.svelte': '<p>Hello</p>\n',
        'src/routes/api/+server.ts': 'export const value = 1;\n',
        'src/routes/+page.server.ts': 'export const value = 1;\n',
        'src/lib/server/database.ts': 'export const value = 1;\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = await readEslintRules(eslint, [
        'src/routes/+page.svelte',
        'src/routes/api/+server.ts',
        'src/routes/+page.server.ts',
        'src/lib/server/database.ts',
    ]);
    expect(rules['src/routes/+page.svelte']!['gspot/no-client-environment']?.[1]).toMatchObject({ client: true });
    for (const file of ['src/routes/api/+server.ts', 'src/routes/+page.server.ts', 'src/lib/server/database.ts'])
        expect(rules[file]!['gspot/no-client-environment']?.[1]).toMatchObject({ client: false });
});

test('only the scope that depends on vite gets the VITE_ prefix', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            scopes: [{ path: 'web', configurations: ['typescript'] }],
        }),
        'package.json': '{"private":true,"type":"module"}',
        'src/main.ts': 'export const value = 1;\n',
        'web/package.json': '{"private":true,"type":"module","devDependencies":{"vite":"0.0.0-test"}}',
        'web/src/main.ts': 'export const value = 1;\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = await readEslintRules(eslint, ['src/main.ts', 'web/src/main.ts']);
    expect(rules['src/main.ts']!['gspot/no-client-environment']?.[1]).toMatchObject({ client: false });
    expect(rules['web/src/main.ts']!['gspot/no-client-environment']?.[1]).toMatchObject({
        client: true,
        publicPrefixes: ['VITE_'],
    });
});

test('an Astro script block may read only PUBLIC_ environment variables, and its frontmatter may read any', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['astro', 'typescript']),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*"]}',
        'src/components/Widget.astro': `---
const title = process.env.SECRET_TITLE;
---
<p>{title}</p>
<script>
    console.info(process.env.PUBLIC_URL);
    console.info(process.env.SECRET_TOKEN);
</script>
`,
    });
    const eslint = await buildEslint(sandbox.path);
    const file = 'src/components/Widget.astro';
    expect(await listLintFindings(eslint, sandbox.path, [file], ['gspot/no-client-environment'])).toStrictEqual([
        { file, rule: 'gspot/no-client-environment', line: 7 },
    ]);
});

test('declaration merging is accepted only in declaration files at level all', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["*.ts"]}\n',
        'global.d.ts':
            'export {};\ndeclare global { interface RequestContext { accountId: string; } }\ndeclare global { interface RequestContext { requestId: string; } }\n',
        'context.ts': 'export interface RequestContext { accountId: string; }\n',
        'aliases.ts': 'export type RequestContext = { accountId: string; };\n',
    });

    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['global.d.ts', 'context.ts', 'aliases.ts'],
            ['@typescript-eslint/consistent-type-definitions'],
        ),
    ).toStrictEqual([{ file: 'context.ts', rule: '@typescript-eslint/consistent-type-definitions', line: 1 }]);
});
