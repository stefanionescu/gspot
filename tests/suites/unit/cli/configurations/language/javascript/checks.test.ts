import { chmod, copyFile, cp, mkdir, realpath, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, test } from 'bun:test';

import { CHECK_CODE } from '#cli/configurations/registry.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { buildCheckSession, runCheckCode, runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { CHECK_GENERATION } from '#cli/generation/checks.ts';
import { EMPTY_PROJECT_RESULT, IMPORTED_AMBIENT_FILES } from '#tests/config/configurations/javascript/checks.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { getConfigPath } from '#tests/setup/cli/generated-files.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { linkInstalledModules, toolModules } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeNpmTool } from '#tests/setup/system/fakes.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('javascript/knip keeps only the findings of the files that Git lists', async () => {
    await using sandbox = await createGitSandbox({
        '.gitignore': 'ignored/\n',
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': 'export const value = 1;\n',
        'ignored/copy.js': 'export const value = 1;\n',
    });
    await applyGeneratedFiles(sandbox.path);
    await fakeNpmTool(sandbox.path, 'knip');
    const exports = [{ name: 'value', line: 1, col: 14 }];
    const stdout = JSON.stringify({
        issues: [
            { file: 'source.js', exports },
            { file: 'ignored/copy.js', exports },
        ],
    });
    using _boundary = fakeCommands().mockResolvedValue(buildProcessResult({ code: 1, stdout }));
    const findings = await runSandboxCheck(sandbox.path, 'javascript/knip');
    expect(findings.map(({ file }) => file)).toStrictEqual(['source.js']);
});

test('javascript/biome checks shebang scripts, TypeScript, and component files in each scope, with the limits of the scope and the language', async () => {
    const nested = 'if (value) { if (value.ready) { if (value.id) return 1; } } return 0;';
    const typed = `function count(value: { ready: boolean; id: number }) { ${nested} }`;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'vue', 'svelte', 'astro'], {
            level: 'all',
            tables:
                '[limits.javascript]\nmax_cognitive_complexity = 2\n[limits.typescript]\nmax_cognitive_complexity = 2\n' +
                '[[scope]]\npath = "app"\n[scope.limits.javascript]\nmax_cognitive_complexity = 8\n[scope.limits.typescript]\nmax_cognitive_complexity = 2\n',
        }),
        'bin/run': `#!/usr/bin/env node\nfunction count(value) { ${nested} }\n`,
        'source.ts': `export ${typed}\n`,
        'Widget.vue': `<script setup lang="ts">\n${typed}\n</script>\n`,
        'Widget.svelte': `<script lang="ts">\n${typed}\n</script>\n`,
        'Page.astro': `---\n${typed}\n---\n<p>Page</p>\n`,
        'app/source.ts': `export ${typed}\n`,
        'app/source.js': `export function count(value) { ${nested} }\n`,
    });
    const modules = join(sandbox.path, '.gspot/node_modules');
    const biome = await realpath(join(toolModules, '@biomejs/biome'));
    await cp(dirname(biome), join(modules, '@biomejs'), { recursive: true, dereference: true });
    await mkdir(join(modules, '.bin'));
    const launcher = join(modules, '.bin/biome');
    await copyFile(join(modules, '@biomejs/biome/bin/biome'), launcher);
    await chmod(launcher, 0o755);
    if (isWindows) await writeFile(`${launcher}.cmd`, `@"${process.execPath}" "%~dp0biome" %*\r\n`);
    await applyGeneratedFiles(sandbox.path);
    const findings = await runSandboxCheck(sandbox.path, 'javascript/biome');
    const nestedFindings = await runSandboxCheck(sandbox.path, 'javascript/biome', { scope: 'app' });
    expect([...findings, ...nestedFindings].map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual(
        [
            { file: 'Page.astro', line: 2 },
            { file: 'Widget.svelte', line: 2 },
            { file: 'Widget.vue', line: 2 },
            { file: 'source.ts', line: 1 },
            { file: 'bin/run', line: 2 },
            { file: 'app/source.ts', line: 1 },
        ].map((finding) => ({ ...finding, rule: 'lint/complexity/noExcessiveCognitiveComplexity' })),
    );
});

test('javascript/tsc skips an absent jsconfig with install advice', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'source.js': 'export const ready = true;\n',
    });
    await applyGeneratedFiles(sandbox.path);
    await fakeNpmTool(sandbox.path, 'tsc');
    const target = getConfigPath(await openSession(sandbox.path), 'jsconfig');
    await unlink(join(sandbox.path, target));
    const absent = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['javascript/tsc'] }));
    expect(absent.report.checks).toMatchObject([
        { status: 'missing', note: `The generated file ${target} is missing. Run gspot install.` },
    ]);
});

test('javascript/tsc excludes type roots inherited from folders above the repository', async () => {
    await using sandbox = await createGitSandbox({
        'node_modules/@types/ancestor/index.d.ts': 'declare const outside: string;\n',
        'project/gspot.toml': buildSandboxSettings(['javascript']),
        'project/source.js': 'export const value = outside;\n',
    });
    const root = join(sandbox.path, 'project');
    await linkInstalledModules(join(root, 'node_modules'));
    await applyGeneratedFiles(root);
    const findings = await runSandboxCheck(root, 'javascript/tsc');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([{ file: 'source.js', rule: 'TS2304' }]);
});

test('a scope whose jsconfig lists no JavaScript file passes with nothing to compile', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            scopes: [{ path: 'site', configurations: ['javascript'] }],
        }),
        'source/main.js': 'export const value = 1;\n',
        'site/README.md': '# No script here\n',
    });

    await applyGeneratedFiles(sandbox.path);
    const reopened = await openSession(sandbox.path);
    const site = planChecks(reopened, {
        stage: 'push',
        only: ['javascript/tsc'],
        selection: { content: 'index', paths: ['gspot.toml'] },
    }).find((check) => check.scope.path === 'site')!;
    expect(
        await runCheckCode(buildCheckSession(reopened, CHECK_GENERATION), site, CHECK_CODE['javascript/tsc'], {}),
    ).toStrictEqual(EMPTY_PROJECT_RESULT);
});

test('javascript/tsc of one named file copies its imported declarations and leaves other scopes apart', async () => {
    await using sandbox = await createGitSandbox({
        ...IMPORTED_AMBIENT_FILES,
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all', scopes: [{ path: 'apps/web' }] }),
    });
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await applyGeneratedFiles(sandbox.path);
    expect(
        await runSandboxCheck(sandbox.path, 'javascript/tsc', { scope: 'apps/web', paths: ['apps/web/src/main.js'] }),
    ).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'types/api.d.ts'), 'export declare const amount: string;\n');
    const findings = await runSandboxCheck(sandbox.path, 'javascript/tsc', {
        scope: 'apps/web',
        paths: ['apps/web/src/main.js'],
    });
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'apps/web/src/main.js', line: 1, rule: 'TS2339' },
    ]);
});
