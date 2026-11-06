import { existsSync } from 'node:fs';
import { chmod, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text.ts';
import type { CheckResult } from '#cli/types/engine/run.ts';
import {
    AUTHORED_CACHE,
    JAVASCRIPT_PROJECT_FILES,
    JSCONFIG_CASES,
} from '#tests/config/configurations/javascript/checks.ts';
import { LINGUIST_GENERATED_PATTERN } from '#tests/config/setup/programs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { linkTypescript } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

async function listTscResults(root: string): Promise<readonly CheckResult[]> {
    const session = await openSession(root);
    const { report } = await runChecks(session, buildRunOptions({ only: ['javascript/tsc'] }));
    return report.checks;
}

test.each([...JSCONFIG_CASES])('javascript/tsc checks $name and keeps the authored files', async (row) => {
    const files = { ...JAVASCRIPT_PROJECT_FILES, ...row.files };
    await using sandbox = await createGitSandbox({
        ...files,
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all', tables: row.tables }),
    });
    await linkTypescript(join(sandbox.path, 'node_modules'));
    await applyGeneratedFiles(sandbox.path);
    const { scope } = row;
    expect(await runSandboxCheck(sandbox.path, 'javascript/tsc', { scope })).toStrictEqual(
        row.diagnostics.map((finding) => matchFields(finding)),
    );
    await writeFile(join(sandbox.path, row.sourceFile), row.correctedSource);
    expect(await runSandboxCheck(sandbox.path, 'javascript/tsc', { scope })).toStrictEqual([]);
    for (const [path, source] of Object.entries(files))
        if (path !== row.sourceFile) expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(source);
});

test('javascript/tsc at level all also checks the build and dist folders', async () => {
    const paths = ['source/build/value.js', 'source/dist/value.js'];
    const skipped = ['coverage/value.js', 'emitted/value.js'];
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        '.gitattributes': LINGUIST_GENERATED_PATTERN,
        ...Object.fromEntries([...paths, ...skipped].map((path) => [path, 'export const value = missing;\n'])),
    });
    commitAll(sandbox.path);
    await linkTypescript(join(sandbox.path, 'node_modules'));
    await applyGeneratedFiles(sandbox.path);
    const broken = await runSandboxCheck(sandbox.path, 'javascript/tsc');
    expect(broken.map(({ file }) => file)).toStrictEqual(paths.toSorted(compareText));
    for (const path of paths) await writeFile(join(sandbox.path, path), 'export const value = 1;\n');
    expect(await runSandboxCheck(sandbox.path, 'javascript/tsc')).toStrictEqual([]);
});

test("javascript/tsc keeps generated module resolution and ignores gspot's own @types without an authored jsconfig", async () => {
    const source = `import { format } from './value.js';
export const text = format(42);
export const total = accepted;
`;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'source/main.js': source,
        'source/value.js':
            '/** @param {string} value */\nexport function format(value) { return value.toUpperCase(); }\n',
        'node_modules/@types/domain/index.d.ts': 'declare const accepted: number;\n',
        [`${GSPOT_PATHS.nodeModules}/@types/private/index.d.ts`]: 'This is invalid private tooling input.\n',
        'authored/cache.tsbuildinfo': 'Preserve this authored metadata.\n',
    });
    await linkTypescript(join(sandbox.path, 'node_modules'));
    await applyGeneratedFiles(sandbox.path);
    const target = getManifestTarget('javascript', 'jsconfig.json');
    const generated = await readFile(join(sandbox.path, target), 'utf8');
    await chmod(join(sandbox.path, target), 0o444);
    expect(await runSandboxCheck(sandbox.path, 'javascript/tsc')).toMatchObject([
        { file: 'source/main.js', line: 2, column: 28, rule: 'TS2345' },
    ]);
    await writeFile(join(sandbox.path, 'source/main.js'), source.replace('format(42)', 'format("42")'));
    expect(await runSandboxCheck(sandbox.path, 'javascript/tsc')).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'authored/cache.tsbuildinfo'), 'utf8')).toBe(
        'Preserve this authored metadata.\n',
    );
    expect(await readFile(join(sandbox.path, target), 'utf8')).toBe(generated);
    const { mode } = await stat(join(sandbox.path, target));
    expect(mode & 0o777).toBe(normalizeFileMode({ mode: 0o444 }));
    expect(existsSync(join(sandbox.path, 'jsconfig.json'))).toBe(false);
});

test('javascript/tsc resolves a types entry from the folder of the tsconfig of a scope', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { scopes: [{ path: 'site' }] }),
        '.gitignore': 'node_modules/\n',
        'site/tsconfig.json': '{"compilerOptions":{"strict":true,"types":["local-types/client"]}}',
        'site/node_modules/local-types/client.d.ts': 'declare const fromTypes: number;\n',
        'site/entry.js': 'export const copy = fromTypes;\n',
    });
    await linkTypescript(join(sandbox.path, 'node_modules'));
    await applyGeneratedFiles(sandbox.path);
    const results = await listTscResults(sandbox.path);
    expect(results.find(({ scope }) => scope === 'site')).toMatchObject({ status: 'passed', findings: [] });
});

async function prepareJsconfigScopes(root: string): Promise<{ config: string; corrected: string }> {
    const settings = buildSandboxSettings(['javascript'], {
        scopes: [{ path: 'app' }, { path: 'app/child' }, { path: 'sibling' }],
    });
    const bad = '/** @type {string} */\nexport const name = 42;\n';
    const corrected = bad.replace('42', '"name"');
    const config = '{"extends":"./base.json"}\n';
    await createFileTree(root, {
        'gspot.toml': settings,
        'source.js': corrected,
        'app/source.js': 'export const value = localValue;\n',
        'app/node_modules/@types/domain/index.d.ts': 'declare const localValue: string;\n',
        'app/jsconfig.json': config,
        'app/base.json':
            '{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","types":["domain"],"incremental":true,"tsBuildInfoFile":"authored.cache"},"include":["**/*.js"],"exclude":["excluded"]}',
        'app/excluded/ignored.js': 'unknownValue();\n',
        'app/authored.cache': AUTHORED_CACHE,
        'app/child/source.js': bad,
        'sibling/source.js': corrected,
    });
    return { config, corrected };
}

test("javascript/tsc reads each scope's own jsconfig options, and a broken one fails only its scope", async () => {
    await using sandbox = await createGitSandbox({});
    const { config, corrected } = await prepareJsconfigScopes(sandbox.path);
    await linkTypescript(join(sandbox.path, 'node_modules'));
    await applyGeneratedFiles(sandbox.path);
    const outputs = await Promise.all(
        [
            ...new Bun.Glob(`${GSPOT_PATHS.configurations}/**/jsconfig.json`).scanSync({
                cwd: sandbox.path,
                dot: true,
            }),
        ].map(async (path) => ({
            path: convertToPosixPath(path),
            content: await readFile(join(sandbox.path, path), 'utf8'),
        })),
    );
    const broken = await listTscResults(sandbox.path);
    expect(broken.flatMap(({ scope, findings }) => findings.map((finding) => ({ scope, finding })))).toStrictEqual([
        {
            scope: 'app/child',
            finding: matchFields({ file: 'app/child/source.js', line: 2, column: 14, rule: 'TS2322' }),
        },
    ]);
    await writeFile(join(sandbox.path, 'app/child/source.js'), corrected);
    const fixed = await listTscResults(sandbox.path);
    expect(fixed.flatMap(({ findings }) => findings)).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'app/jsconfig.json'), 'utf8')).toBe(config);
    expect(await readFile(join(sandbox.path, 'app/authored.cache'), 'utf8')).toBe(AUTHORED_CACHE);
    for (const output of outputs) expect(await readFile(join(sandbox.path, output.path), 'utf8')).toBe(output.content);
    await writeFile(join(sandbox.path, 'app/jsconfig.json'), '{');
    const invalid = await listTscResults(sandbox.path);
    expect(invalid).toMatchObject([
        { scope: '', status: 'passed' },
        { scope: 'app', status: 'error' },
        { scope: 'app/child', status: 'passed' },
        { scope: 'sibling', status: 'passed' },
    ]);
    expect(invalid.find(({ scope }) => scope === 'app')?.note).toContain('app/jsconfig.json');
});
