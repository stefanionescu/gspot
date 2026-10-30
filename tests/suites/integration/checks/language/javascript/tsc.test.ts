import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { compareText } from '#cli/system/text.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import { COMPILER_SOURCE } from '#tests/config/typescript.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { LINGUIST_GENERATED_PATTERN } from '#tests/config/git.ts';
import { NPM_BIN_FOLDER } from '#cli/config/executables/locate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { rm, stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, runGspotStep, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { writeSandboxChanges, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';

import {
    AUTHORED_CACHE,
    JSCONFIG_CASES,
    JSCONFIG_SANDBOX,
    KNIP_FOLDER_FILES,
    OWN_TYPESCRIPT_RESULTS,
    AUTHORED_JSCONFIG_CASES,
    AUTHORED_JSCONFIG_FILES,
    JAVASCRIPT_PROJECT_FILES,
} from '#tests/config/integration/checks/language/javascript.ts';

const installedSandbox = shareInstalledSandbox(JSCONFIG_SANDBOX);

test("javascript/tsc uses gspot's own TypeScript when the project has none", async () => {
    const { root } = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': COMPILER_SOURCE,
    };
    await using _sourceChange = await writeSandboxChanges(
        installedSandbox(),
        buildSandboxChanges(JSCONFIG_SANDBOX.files, sourceFiles),
    );
    const broken = parseCheckReport(await spawnGspot(root, ['check', '--only', 'javascript/tsc', '--json']));
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(broken.report.checks).toMatchObject([...OWN_TYPESCRIPT_RESULTS]);
    expect(broken.report.checks[0]!.command![0]).toBe(
        Bun.which('tsc', { PATH: join(root, GSPOT_FOLDER, NPM_BIN_FOLDER) })!,
    );
    await writeFile(join(root, 'source.js'), 'export const value = 1;\n');
    const corrected = parseCheckReport(await spawnGspot(root, ['check', '--only', 'javascript/tsc', '--json']));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'javascript/tsc', status: 'passed', findings: [] }]);
});

test.each([...JSCONFIG_CASES])('javascript/tsc checks $name and keeps the authored files', async (row) => {
    const { root } = installedSandbox();
    const sourceFiles = {
        ...JAVASCRIPT_PROJECT_FILES,
        ...row.files,
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all', tables: row.tables }),
    };
    await using _sourceChange = await writeSandboxChanges(
        installedSandbox(),
        buildSandboxChanges(JSCONFIG_SANDBOX.files, sourceFiles),
    );
    await createFileTree(root, {
        [`${GSPOT_PATHS.nodeModules}/@types/private/index.d.ts`]:
            JAVASCRIPT_PROJECT_FILES[`${GSPOT_PATHS.nodeModules}/@types/private/index.d.ts`],
    });
    const command = ['check', '--only', 'javascript/tsc', '--json'];
    const broken = parseCheckReport(await spawnGspot(root, command));
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(broken.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        ...(row.scope === '' ? [] : [{ scope: '', status: 'skipped' as const }]),
        { scope: row.scope, status: 'failed' as const },
    ]);
    expect(broken.report.checks.flatMap(({ findings }) => findings)).toStrictEqual(
        row.diagnostics.map((finding) => matchFields(finding)),
    );
    await writeFile(join(root, row.sourceFile), row.correctedSource);
    const corrected = parseCheckReport(await spawnGspot(root, command));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toStrictEqual([
        ...(row.scope === '' ? [] : [matchFields<CheckResult>({ scope: '', status: 'skipped', findings: [] })]),
        matchFields<CheckResult>({ scope: row.scope, status: 'passed', findings: [] }),
    ]);
    const files = { ...JAVASCRIPT_PROJECT_FILES, ...row.files };
    for (const [path, source] of Object.entries(files))
        if (path !== row.sourceFile) expect(await readFile(join(root, path), 'utf8')).toBe(source);
});

test('javascript/tsc at level all also checks the build and dist folders', async () => {
    const paths = ['source/build/value.js', 'source/dist/value.js', 'coverage/value.js'];
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        '.gitattributes': LINGUIST_GENERATED_PATTERN,
        ...Object.fromEntries([...paths, 'emitted/value.js'].map((path) => [path, 'export const value = missing;\n'])),
    });
    commitAll(sandbox.path);
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['apply']);
    const command = ['check', '--only', 'javascript/tsc', '--json'];
    const broken = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(broken.report.checks.flatMap(({ findings }) => findings.map(({ file }) => file))).toStrictEqual(
        paths.toSorted(compareText),
    );
    for (const path of paths) await writeFile(join(sandbox.path, path), 'export const value = 1;\n');
    const corrected = await spawnGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each([...AUTHORED_JSCONFIG_CASES])(
    "javascript/tsc keeps the project's module resolution and ignores gspot's own @types, $name",
    async ({ authored }) => {
        const authoredFiles: Record<string, string> = authored ? AUTHORED_JSCONFIG_FILES : {};
        const source = `import { format } from '${authored ? '@shape/value' : './value.js'}';
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
            ...authoredFiles,
        });
        await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['apply']);
        const generated = {
            path: getManifestTarget('javascript', 'jsconfig.json'),
            content: await readFile(join(sandbox.path, getManifestTarget('javascript', 'jsconfig.json')), 'utf8'),
        };
        await chmod(join(sandbox.path, generated.path), 0o444);
        const command = ['check', '--only', 'javascript/tsc', '--json'];
        const broken = parseCheckReport(await spawnGspot(sandbox.path, command));
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(broken.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: 'source/main.js', line: 2, column: 28, rule: 'TS2345' },
        ]);
        await writeFile(join(sandbox.path, 'source/main.js'), source.replace('format(42)', 'format("42")'));
        const corrected = await spawnGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await readFile(join(sandbox.path, 'authored/cache.tsbuildinfo'), 'utf8')).toBe(
            'Preserve this authored metadata.\n',
        );
        expect(await readFile(join(sandbox.path, generated.path), 'utf8')).toBe(generated.content);
        const { mode } = await stat(join(sandbox.path, generated.path));
        expect(mode & 0o777).toBe(normalizeFileMode({ mode: 0o444 }));
        expect(await isOnDisk(join(sandbox.path, 'jsconfig.json'))).toBe(authored);
        for (const [path, content] of Object.entries(authoredFiles))
            expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(content);
    },
);

test("javascript/tsc reads each scope's own jsconfig options, and a broken one fails only its scope", async () => {
    await using sandbox = await createGitSandbox({});
    const { config, corrected } = await prepareJsconfigScopes(sandbox.path);
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['apply']);
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
    expect(outputs.map(({ path }) => path).toSorted(compareText)).toStrictEqual([
        getManifestTarget('javascript', 'jsconfig.json'),

        `${GSPOT_PATHS.configurations}/language/javascript/scopes/app/child/jsconfig.json`,
        `${GSPOT_PATHS.configurations}/language/javascript/scopes/app/jsconfig.json`,
        `${GSPOT_PATHS.configurations}/language/javascript/scopes/sibling/jsconfig.json`,
    ]);
    const command = ['check', '--only', 'javascript/tsc', '--json'];
    const broken = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(
        broken.report.checks.flatMap(({ scope, findings }) => findings.map((finding) => ({ scope, finding }))),
    ).toStrictEqual([
        {
            scope: 'app/child',
            finding: matchFields({ file: 'app/child/source.js', line: 2, column: 14, rule: 'TS2322' }),
        },
    ]);
    await writeFile(join(sandbox.path, 'app/child/source.js'), corrected);
    const fixed = await spawnGspot(sandbox.path, command);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'app/jsconfig.json'), 'utf8')).toBe(config);
    expect(await readFile(join(sandbox.path, 'app/authored.cache'), 'utf8')).toBe(AUTHORED_CACHE);
    for (const output of outputs) expect(await readFile(join(sandbox.path, output.path), 'utf8')).toBe(output.content);
    await writeFile(join(sandbox.path, 'app/jsconfig.json'), '{');
    const invalid = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    expect(invalid.report.checks).toMatchObject([
        { scope: '', status: 'passed' },
        {
            scope: 'app',
            status: 'error',
            note: "The javascript/tsc check failed: Cannot read the compiler settings in app/jsconfig.json: '}' expected.",
        },
        { scope: 'app/child', status: 'passed' },
        { scope: 'sibling', status: 'passed' },
    ]);
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

test('Knip checks an independent package with directory instead of workspace', async () => {
    const { root } = installedSandbox();
    await using _changes = await writeSandboxChanges(
        installedSandbox(),
        buildSandboxChanges(JSCONFIG_SANDBOX.files, {
            'gspot.toml': buildSandboxSettings(['javascript'], { scopes: [{ path: 'docs', configurations: [] }] }),
            ...KNIP_FOLDER_FILES,
        }),
    );
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'javascript/knip', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'passed' },
        { scope: 'docs', status: 'passed' },
    ]);
    await writeFile(join(root, 'docs/unused.js'), 'export const unused = 1;\n');
    const unused = parseCheckReport(await spawnGspot(root, ['check', '--only', 'javascript/knip', '--json']));
    await rm(join(root, 'docs/unused.js'));
    expect(unused.code, unused.stdout + unused.stderr).toBe(1);
    expect(unused.report.checks.find(({ scope }) => scope === 'docs')).toMatchObject({
        status: 'failed',
        findings: [{ file: 'docs/unused.js' }],
    });
});
