import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { planChecks } from '#cli/engine/plan.ts';
import { CHECK_CODE } from '#cli/checks/registry.ts';
import { openSession } from '#cli/engine/session.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { getConfigPath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { fakeNpmTool, fakeCommands } from '#tests/setup/system/fakes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildRunOptions, CHECK_GENERATION } from '#tests/setup/cli/runs.ts';
import { runChecks, runCheckCode, buildCheckSession } from '#cli/engine/run.ts';
import { cp, chmod, mkdir, unlink, copyFile, readFile, realpath, writeFile } from 'node:fs/promises';
import { EMPTY_PROJECT_RESULT, IMPORTED_AMBIENT_FILES } from '#tests/config/checks/language/language.ts';
import { toolModules, linkTypescript, linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';

test('javascript/biome checks shebang scripts, TypeScript, and component files in each scope', async () => {
    const nested = 'if (value) { if (value.ready) { if (value.id) return 1; } } return 0;';
    const typed = `function count(value: { ready: boolean; id: number }) { ${nested} }`;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'vue', 'svelte', 'astro'], {
            level: 'all',
            tables: '[limits.javascript]\ncognitive_complexity = 2\n[limits.typescript]\ncognitive_complexity = 2\n',
            scopes: [{ path: 'app' }],
        }),
        'bin/run': `#!/usr/bin/env node\nfunction count(value) { ${nested} }\n`,
        'source.ts': `export ${typed}\n`,
        'Widget.vue': `<script setup lang="ts">\n${typed}\n</script>\n`,
        'Widget.svelte': `<script lang="ts">\n${typed}\n</script>\n`,
        'Page.astro': `---\n${typed}\n---\n<p>Page</p>\n`,
        'app/source.ts': `export ${typed}\n`,
    });
    const modules = join(sandbox.path, '.gspot/node_modules');
    await cp(dirname(await realpath(join(toolModules, '@biomejs/biome'))), join(modules, '@biomejs'), {
        recursive: true,
        dereference: true,
    });
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
    expect(findings.find(({ file }) => file === 'bin/run')?.message).toContain('(max: 2)');
    expect(await readFile(join(sandbox.path, 'bin/run'), 'utf8')).toStartWith('#!/usr/bin/env node');
});

test.each(['', 'app'])('javascript/tsc resolves project types in scope "%s" without tooling types', async (scope) => {
    const prefix = scope === '' ? '' : `${scope}/`;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            scopes: scope === '' ? [] : [{ path: scope }],
        }),
        [`${prefix}source.js`]: 'export const value = localValue;\nexport const secret = privateValue;\n',
        [`${prefix}node_modules/@types/domain/index.d.ts`]: 'declare const localValue: string;\n',
        '.gspot/node_modules/@types/private/index.d.ts': 'declare const privateValue: number;\n',
    });
    await linkTypescript(join(sandbox.path, 'node_modules'));
    await applyGeneratedFiles(sandbox.path);
    const findings = await runSandboxCheck(sandbox.path, 'javascript/tsc', { scope });
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: `${prefix}source.js`, line: 2, rule: 'TS2304' },
    ]);
});

test('javascript/tsc checks a stale jsconfig and skips an absent one with apply advice', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'source.js': 'export const ready = true;\n',
    });
    await applyGeneratedFiles(sandbox.path);
    await fakeNpmTool(sandbox.path, 'tsc');
    const session = await openSession(sandbox.path);
    const target = getConfigPath(session, 'jsconfig');
    const path = join(sandbox.path, target);
    const text = await readFile(path, 'utf8');
    await chmod(path, 0o644);
    await writeFile(path, text.replace('{', '{ '));
    using _boundary = fakeCommands().mockResolvedValue(buildProcessResult());
    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['javascript/tsc'] }));
    expect(result.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
    await unlink(path);
    const absent = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['javascript/tsc'] }));
    expect(absent.report.checks).toMatchObject([
        { status: 'missing', note: `The generated file ${target} is missing. Run gspot apply.` },
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
    const session = await openSession(root);
    const planned = planChecks(session, buildRunOptions({ only: ['javascript/tsc'] }))[0]!;
    const result = await runCheckCode(
        buildCheckSession(session, CHECK_GENERATION),
        planned,
        CHECK_CODE['javascript/tsc'],
        {},
    );
    expect(result.findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'source.js', rule: 'TS2304' },
    ]);
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
        staged: ['gspot.toml'],
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
    await writeFile(join(sandbox.path, 'types/api.d.ts'), IMPORTED_AMBIENT_FILES['types/api.d.ts']);
    expect(
        await runSandboxCheck(sandbox.path, 'javascript/tsc', { scope: 'apps/web', paths: ['apps/web/src/main.js'] }),
    ).toStrictEqual([]);
});

test('javascript/tsc puts incremental build information in the check copy', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'jsconfig.json': '{"compilerOptions":{"incremental":true,"types":[]},"include":["src"]}\n',
        'src/value.js': '/** @type {number} */ export const value = "wrong";\n',
    });
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await applyGeneratedFiles(sandbox.path);
    const incremental = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['javascript/tsc'] }));
    const first = incremental.report.checks[0]!;
    expect(first.status).toBe('failed');
    expect(first.findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'src/value.js', rule: 'TS2322' },
    ]);
    expect(
        await Array.fromAsync(
            new Bun.Glob('**/*.tsbuildinfo').scan({ cwd: sandbox.path, dot: true, followSymlinks: false }),
        ),
    ).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'jsconfig.json'),
        '{"compilerOptions":{"incremental":false,"types":[]},"include":["src"]}\n',
    );
    const ordinary = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['javascript/tsc'] }));
    expect(ordinary.report.checks[0]?.status).toBe('failed');
    expect(
        await Array.fromAsync(
            new Bun.Glob('**/*.tsbuildinfo').scan({ cwd: sandbox.path, dot: true, followSymlinks: false }),
        ),
    ).toStrictEqual([]);
});
