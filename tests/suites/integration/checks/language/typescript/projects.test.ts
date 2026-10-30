import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { compareText } from '#cli/system/text.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { LEVELS } from '#cli/config/manifests/names.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import type { TypecheckResult } from '#tests/types/reports.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { linkTypescript } from '#tests/setup/sandboxes/node-modules.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { stat, chmod, readdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { spawnGspot, runGspotStep, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { applySandboxChanges, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';

import {
    OUTDIR_CASES,
    AUTHORED_TSCONFIG,
    IMPLICIT_PROJECT_FILES,
    TYPESCRIPT_PROJECTS_SANDBOX,
} from '#tests/config/integration/checks/language/typescript/projects.ts';

async function runTscCheck(root: string): Promise<TypecheckResult> {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'typescript/tsc', '--json']));
    const output = result.stdout + result.stderr;
    const findings = result.report.checks.flatMap((check) => check.findings);
    return { code: result.code, output, findings };
}

const installedSandbox = shareInstalledSandbox(TYPESCRIPT_PROJECTS_SANDBOX);

test('typescript/tsc reports a type error in a tsconfig.json project without files or include, and leaves tsconfig.json unchanged', async () => {
    const { root } = installedSandbox();

    await using _sourceChange = await applySandboxChanges(
        installedSandbox(),
        buildSandboxChanges(TYPESCRIPT_PROJECTS_SANDBOX.files, {
            ...IMPLICIT_PROJECT_FILES,
            'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        }),
    );
    commitAll(root);
    const failed = await runTscCheck(root);
    expect(failed.code, failed.output).toBe(1);
    expect(failed.findings).toMatchObject([{ file: 'src/broken.ts', rule: 'TS2322' }]);
    await writeFile(join(root, 'src/broken.ts'), IMPLICIT_PROJECT_FILES['src/clean.ts']);
    const clean = await runTscCheck(root);
    expect(clean.code, clean.output).toBe(0);
    expect(await readFile(join(root, 'tsconfig.json'), 'utf8')).toBe(IMPLICIT_PROJECT_FILES['tsconfig.json']);
});

test.each([...LEVELS])(
    'typescript/tsc at level %s keeps the authored tsconfig.json in a scope and reports its type errors',
    async (level) => {
        const { root } = installedSandbox();
        const scope = 'apps/web';
        const authored = AUTHORED_TSCONFIG.replace('%BUILD_INFO%', () =>
            JSON.stringify(join(root, scope, 'build/cache.tsbuildinfo')),
        );
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['javascript'], {
                level,
                scopes: [{ path: scope, configurations: ['typescript'] }],
            }),
            '.gitignore': `node_modules/\n${GSPOT_FOLDER}/\n`,
            [`${scope}/tsconfig.json`]: authored,
            [`${scope}/src/main.ts`]: 'export const echo: number = "wrong";\n',
            [`${scope}/build/cache.tsbuildinfo`]: 'authored metadata\n',
        };
        await using _sourceChange = await applySandboxChanges(
            installedSandbox(),
            buildSandboxChanges(TYPESCRIPT_PROJECTS_SANDBOX.files, sourceFiles),
        );
        await chmod(join(root, scope, 'tsconfig.json'), 0o640);
        const failed = await runTscCheck(root);
        expect(failed.code, failed.output).toBe(1);
        expect(failed.findings).toMatchObject([
            { check: 'typescript/tsc', file: `${scope}/src/main.ts`, rule: 'TS2322', line: 1, column: 14 },
        ]);
        await writeFile(
            join(root, scope, 'src/main.ts'),
            'export function echo(value: string) { return value; }\nexport const first: number = "wrong";\n',
        );
        const second = await runTscCheck(root);
        expect(second.code, second.output).toBe(1);
        expect(second.findings).toMatchObject([
            { check: 'typescript/tsc', file: `${scope}/src/main.ts`, rule: 'TS2322', line: 2, column: 14 },
        ]);
        await writeFile(
            join(root, scope, 'src/main.ts'),
            'export function echo(value: string) { return value; }\nexport const first: number = 1;\n',
        );
        const corrected = await runTscCheck(root);
        expect(corrected.code, corrected.output).toBe(0);
        expect(await readFile(join(root, scope, 'tsconfig.json'), 'utf8')).toBe(authored);
        const { mode } = await stat(join(root, scope, 'tsconfig.json'));
        expect(mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
        expect(await readFile(join(root, scope, 'build/cache.tsbuildinfo'), 'utf8')).toBe('authored metadata\n');
    },
);

test.each([...OUTDIR_CASES])('$name', async ({ kind }) => {
    await using outside = await createGitSandbox({ 'value.js': 'authored output\n' });

    await linkTypescript(outside.path);
    const outsideFiles = await readdir(outside.path);
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        '.gitignore': `node_modules\n${GSPOT_FOLDER}\n`,
        'tsconfig.json': '{"files":[],"references":[{"path":"./app"}]}',
        'app/tsconfig.json': JSON.stringify({
            compilerOptions: {
                composite: true,
                types: [],
                outDir: kind === 'absolute' ? outside.path : '../node_modules',
            },
            include: ['*.ts'],
        }),
        'app/value.ts': 'export const count = 1;\n',
    });
    await (kind === 'symlink'
        ? symlink(outside.path, join(sandbox.path, 'node_modules'), 'dir')
        : linkTypescript(join(sandbox.path, 'node_modules')));
    commitAll(sandbox.path);
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['apply']);
    const checked = await runTscCheck(sandbox.path);
    expect(checked.code, checked.output).toBe(0);
    expect(await readdir(outside.path)).toStrictEqual(outsideFiles);
    expect(await readFile(join(outside.path, 'value.js'), 'utf8')).toBe('authored output\n');
    await writeFile(
        join(sandbox.path, 'app/tsconfig.json'),
        JSON.stringify({
            compilerOptions: { composite: true, types: [], outDir: './dist' },
            include: ['*.ts'],
        }),
    );
    const corrected = await runTscCheck(sandbox.path);
    expect(corrected.code, corrected.output).toBe(0);
    expect(await readFile(join(outside.path, 'value.js'), 'utf8')).toBe('authored output\n');
    expect(await readdir(outside.path)).toStrictEqual(outsideFiles);
    const files = await readdir(join(sandbox.path, 'app'));
    expect(files.toSorted(compareText)).toStrictEqual(['tsconfig.json', 'value.ts']);
});
