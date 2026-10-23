import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';

test('a jsconfig beside a tsconfig excludes build output and lists only tracked declaration files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript']),
        '.gitignore': '.next/\n.open-next/\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*.ts"],"exclude":["vendor"]}',
        'src/main.ts': 'export const value = 1;\n',
        'worker.js': 'export const worker = 1;\n',
        'cloudflare-env.d.ts': 'declare const env: string;\n',
        '.next/types/routes.d.ts': 'declare const routes: string;\n',
        '.open-next/worker.js': 'export const bundle = 1;\n',
    });

    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, [
        'add',
        '--',
        '.gitignore',
        'tsconfig.json',
        'src/main.ts',
        'worker.js',
        'cloudflare-env.d.ts',
    ]);
    const files = generate(await openSession(sandbox.path)).files;
    const jsconfig = JSON.parse(
        files.find(({ path }) => path === findManifestTarget('javascript', 'jsconfig.json'))!.content,
    ) as { files: string[]; exclude: string[] };
    expect(jsconfig.files).toStrictEqual(['../../../../cloudflare-env.d.ts']);
    expect(jsconfig.exclude).toStrictEqual(
        [
            '**/.next/**',
            '**/.open-next/**',
            `${DOT_GSPOT}/**`,
            'eslint.config.mjs',
            '.editorconfig',
            'prettier.config.mjs',
            '.prettierignore',
            '**/node_modules/**',
            '**/bower_components/**',
            '**/.env',
            '**/.env.*',
            '**/.dev.vars',
            '**/.dev.vars.*',
            '**/.env*',
            '**/eslint.config.mjs',
            '**/eslint.config.js',
            '**/eslint.config.cjs',
            'vendor',
        ].map((pattern) => `../../../../${pattern}`),
    );
});
