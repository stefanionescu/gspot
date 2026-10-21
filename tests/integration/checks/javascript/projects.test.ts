import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';

import {
    JSCONFIG_CHOICES,
    YOUR_JSCONFIG_FILES,
    SCOPE_JSCONFIG_PATHS,
    IMPORTED_AMBIENT_FILES,
} from '#tests/data/checks/javascript/tsc.ts';

test('javascript/tsc at level all also checks your build and dist folders', async () => {
    await using sandbox = await testdir();
    const paths = ['source/build/value.js', 'source/dist/value.js', 'coverage/value.js'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
        }),
        '.gitattributes': 'emitted/** linguist-generated\n',
        ...Object.fromEntries([...paths, 'emitted/value.js'].map((path) => [path, 'export const value = missing;\n'])),
    });
    commitAll(sandbox.path);
    const environment = {};
    expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
    const command = ['check', '--only', 'javascript/tsc', '--json'];
    const broken = parseCheckReport(await spawnGspot(sandbox.path, command, environment));
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const report = broken.report;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file }) => file))).toStrictEqual(
        paths.toSorted((left, right) => left.localeCompare(right)),
    );
    for (const path of paths) await writeFile(join(sandbox.path, path), 'export const value = 1;\n');
    const corrected = await spawnGspot(sandbox.path, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each([...JSCONFIG_CHOICES])(
    "javascript/tsc keeps the project's module resolution and ignores gspot's own @types, $name",
    async ({ authored }) => {
        await using sandbox = await testdir();
        const authoredFiles: Record<string, string> = authored ? YOUR_JSCONFIG_FILES : {};
        const source = `import { format } from '${authored ? '@shape/value' : './value.js'}';
export const text = format(42);
export const total = accepted;
`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['javascript']),
            'source/main.js': source,
            'source/value.js':
                '/** @param {string} value */\nexport function format(value) { return value.toUpperCase(); }\n',
            'node_modules/@types/domain/index.d.ts': 'declare const accepted: number;\n',
            '.gspot/node_modules/@types/private/index.d.ts': 'This is invalid private tooling input.\n',
            'authored/cache.tsbuildinfo': 'Preserve this authored metadata.\n',
            ...authoredFiles,
        });
        expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
        const generated = {
            path: '.gspot/configurations/language/javascript/jsconfig.json',
            content: await readFile(
                join(sandbox.path, '.gspot/configurations/language/javascript/jsconfig.json'),
                'utf8',
            ),
        };
        await chmod(join(sandbox.path, generated.path), 0o444);
        const command = ['check', '--only', 'javascript/tsc', '--json'];
        const env = {};
        const broken = parseCheckReport(await spawnGspot(sandbox.path, command, env));
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(broken.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: 'source/main.js', line: 2, column: 28, rule: 'TS2345' },
        ]);
        await writeFile(join(sandbox.path, 'source/main.js'), source.replace('format(42)', 'format("42")'));
        const corrected = await spawnGspot(sandbox.path, command, env);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await readFile(join(sandbox.path, 'authored/cache.tsbuildinfo'), 'utf8')).toBe(
            'Preserve this authored metadata.\n',
        );
        expect(await readFile(join(sandbox.path, generated.path), 'utf8')).toBe(generated.content);
        const { mode } = await stat(join(sandbox.path, generated.path));
        expect(mode & 0o777).toBe(normalizeFileMode({ mode: 0o444 }));
        expect(await isOnDisk(join(sandbox.path, 'jsconfig.json'))).toBe(authored);
        for (const [path, original] of Object.entries(authoredFiles))
            expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(original);
    },
);

test("javascript/tsc reads each scope's own jsconfig options, and a broken one fails only its scope", async () => {
    await using sandbox = await testdir();
    const { config, corrected } = await prepareJsconfigScopes(sandbox.path);
    expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
    const outputs = await Promise.all(
        [...new Bun.Glob('.gspot/configurations/**/jsconfig.json').scanSync({ cwd: sandbox.path, dot: true })].map(
            async (path) => ({
                path: convertToPosixPath(path),
                content: await readFile(join(sandbox.path, path), 'utf8'),
            }),
        ),
    );
    expect(outputs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        ...SCOPE_JSCONFIG_PATHS,
    ]);
    const command = ['check', '--only', 'javascript/tsc', '--json'];
    const env = {};
    const broken = parseCheckReport(await spawnGspot(sandbox.path, command, env));
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const report = broken.report;
    expect(
        report.checks.flatMap(({ scope, findings }) => findings.map((finding) => ({ scope, finding }))),
    ).toStrictEqual([
        {
            scope: 'app/child',
            finding: matchFields({ file: 'app/child/source.js', line: 2, column: 14, rule: 'TS2322' }),
        },
    ]);
    await writeFile(join(sandbox.path, 'app/child/source.js'), corrected);
    const fixed = await spawnGspot(sandbox.path, command, env);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'app/jsconfig.json'), 'utf8')).toBe(config);
    expect(await readFile(join(sandbox.path, 'app/authored.cache'), 'utf8')).toBe('Preserve this cache.\n');
    for (const output of outputs) expect(await readFile(join(sandbox.path, output.path), 'utf8')).toBe(output.content);
    await writeFile(join(sandbox.path, 'app/jsconfig.json'), '{');
    const invalid = parseCheckReport(await spawnGspot(sandbox.path, command, env));
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    // The scope with the unreadable jsconfig.json errors alone; the other scopes keep their results.
    expect(invalid.report.checks).toMatchObject([
        { scope: '', status: 'passed' },
        { scope: 'app', status: 'error', note: matchSubstring(join('app', 'jsconfig.json')) },
        { scope: 'app/child', status: 'passed' },
        { scope: 'sibling', status: 'passed' },
    ]);
    expect(await readFile(join(sandbox.path, 'app/jsconfig.json'), 'utf8')).toBe('{');
});

test('javascript/tsc copies imported ambient types and keeps other scopes apart', async () => {
    await using sandbox = await testdir({
        ...IMPORTED_AMBIENT_FILES,
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all', scopes: [{ path: 'apps/web' }] }),
    });
    expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
    const environment = {};
    const command = ['check', '--only', 'javascript/tsc', '--json', '--', 'apps/web/src/main.js'];
    const passed = await spawnGspot(sandbox.path, command, environment);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    await writeFile(join(sandbox.path, 'types/api.d.ts'), 'export declare const amount: string;\n');
    const failed = parseCheckReport(await spawnGspot(sandbox.path, command, environment));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap((check) => check.findings)).toStrictEqual([
        matchFields({ file: 'apps/web/src/main.js', rule: 'TS2339', line: 1 }),
    ]);
    await writeFile(join(sandbox.path, 'types/api.d.ts'), IMPORTED_AMBIENT_FILES['types/api.d.ts']);
    const corrected = await spawnGspot(sandbox.path, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    for (const [path, original] of Object.entries(IMPORTED_AMBIENT_FILES))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(original);
});

/** Write compiler inputs for each scope. Include inherited options and a broken child scope. */
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
        'app/authored.cache': 'Preserve this cache.\n',
        'app/child/source.js': bad,
        'sibling/source.js': corrected,
    });
    return { config, corrected };
}
