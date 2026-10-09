import { test, expect } from 'bun:test';
import { join, relative } from 'node:path';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { readFile, realpath } from 'node:fs/promises';
import { buildPolicy } from '#tests/harness/policy.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { containing } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { packageToolProject } from '#cli/tools/npm/public.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { getOwnership } from '#cli/lifecycle/ownership/public.ts';
import type { ApplyPlanJson } from '#cli/types/commands/apply.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { buildToolsPath, buildSandboxPath, shareToolProjects, installToolProjects } from '#tests/harness/install.ts';

import {
    SCOPE,
    CHECKS,
    PLAN_INIT,
    CORRECTED,
    CLEAN_CSS,
    INVALID_CSS,
    PROJECT_FILES,
} from '#tests/config/tools/lifecycle/shared-tools.ts';

// Independent roots must retain selected project inputs and execute their own contained native tools.
test.each(['recommended', 'all'] as const)(
    'shared native tools preserve scoped checks and portable locks at %s',
    async (level) => {
        await using first = await testdir();
        await using second = await testdir();
        const locks: Buffer[] = [];
        let requests = 0;
        const registry = Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            fetch() {
                requests++;
                return Response.json({ error: 'The cached fixture needs no package acquisition.' }, { status: 404 });
            },
        });
        await using resources = new AsyncDisposableStack();
        resources.defer(async () => {
            await registry.stop(true);
        });
        await Bun.write(join(second.path, '.npmrc'), `registry=http://127.0.0.1:${String(registry.port)}/\n`);
        for (const { path: root } of [first, second]) {
            await createFileTree(root, {
                ...PROJECT_FILES,
                'gspot.toml': buildPolicy(['javascript', 'prose'], { level, tables: SCOPE }),
            });
            const environment = { PATH: buildSandboxPath([]) };
            const applied = await spawnGspot(root, ['apply', '--json'], environment);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            Object.assign(environment, await shareToolProjects(root));
            const project = packageToolProject.parse(await readFile(join(root, '.gspot/package.json'), 'utf8'));
            locks.push(await readFile(join(root, packageToolProject.lockfilePath(project))));
            expect(packageToolProject.matches(project, locks.at(-1)!.toString('utf8'))).toBe(true);
            expect(relative(root, await realpath(join(root, '.gspot/node_modules/.bin/eslint'))).startsWith('..')).toBe(
                false,
            );
            expect((getOwnership(root).installed ?? []).filter((kind) => kind !== 'python')).toEqual(
                level === 'all' ? ['npm', 'vale'] : ['npm'],
            );
            const checked = await spawnGspot(root, CHECKS, environment);
            expect(checked.code, checked.stdout + checked.stderr).toBe(1);
            const findings = (JSON.parse(checked.stdout) as RunReport).checks.flatMap(({ findings }) => findings);
            for (const file of ['source.js', 'app/source.js'])
                expect(findings).toContainEqual(containing({ file, rule: 'no-debugger' }));
            await createFileTree(root, { 'source.js': CORRECTED, 'app/source.js': CORRECTED });
            const corrected = await spawnGspot(root, CHECKS, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toEqual([]);
            expect(
                await Promise.all(
                    ['package.json', '.venv/authored.txt'].map((path) => readFile(join(root, path), 'utf8')),
                ),
            ).toEqual([PROJECT_FILES['package.json'], PROJECT_FILES['.venv/authored.txt']]);
        }
        expect(locks[1]).toEqual(locks[0]);
        expect(requests).toBe(0);
    },
);

test('shared native tool projects keep a separately selected Stylelint dependency and native result', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    await createFileTree(root, {
        ...PROJECT_FILES,
        'source.css': INVALID_CSS,
        'gspot.toml': buildPolicy(['javascript', 'prose', 'css'], { level: 'recommended', tables: SCOPE }),
    });
    const environment = { PATH: buildSandboxPath([]) };
    const applied = await spawnGspot(root, ['apply', '--json'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    Object.assign(environment, await shareToolProjects(root));
    const project = packageToolProject.parse(await readFile(join(root, '.gspot/package.json'), 'utf8'));
    const pin = toolPin(configurationManifests().values(), 'stylelint').installers['npm']!;
    expect(project.dependencies[pin.name]).toBe(pin.version);
    const checked = await spawnGspot(root, ['check', '--only', 'css/stylelint', '--json'], environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect((JSON.parse(checked.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toContainEqual(
        containing({ file: 'source.css', rule: 'declaration-property-value-no-unknown' }),
    );
    await Bun.write(join(root, 'source.css'), CLEAN_CSS);
    const corrected = await spawnGspot(root, ['check', '--only', 'css/stylelint', '--json'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toEqual([]);
});

// The ESLint pointer is written for editors. The other deleted files get no pointer, because each check names
// its configuration by path.
async function expectPointers(root: string): Promise<void> {
    for (const gone of ['typos.toml', '.shellcheckrc']) expect(await pathExists(join(root, gone))).toBe(false);
    const pointers = await Promise.all(
        ['eslint.config.js', 'eslint.config.mjs'].map(async (name) =>
            (await pathExists(join(root, name))) ? name : undefined,
        ),
    );
    const eslintPointer = pointers.find((name) => name !== undefined);
    expect(eslintPointer).toBeDefined();
    expect(await readFile(join(root, eslintPointer ?? ''), 'utf8')).toContain('gspot');
}

test('init replaces the files of the selected tools and leaves no drift for apply', async () => {
    await using sandbox = await testdir();
    const originals = {
        'typos.toml': '[default.extend-words]\n# The device identifier API name.\nudid = "udid"\n',
        '.shellcheckrc': 'disable=SC2086,SC2034\n',
        '.markdownlint.jsonc': '// Keep long prose lines.\n{ "MD013": false, "MD033": true, }\n',
        '.eslintrc.json': '{ "rules": { "eqeqeq": "error" } }\n',
        '.prettierrc': '{ "semi": false }\n',
    };
    await createFileTree(sandbox.path, {
        ...originals,
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'src/a.js': 'export const a = 1;\n',
        'README.md': '# test\n',
        'quality/lint.sh': CLEAN_BASH_SCRIPT,
    });
    commitAll(sandbox.path);
    const environment = { PATH: buildToolsPath(['ast-grep']) };
    const init = await spawnGspot(sandbox.path, PLAN_INIT, environment);
    expect(init.code, init.stdout + init.stderr).toBe(0);
    const policy = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    for (const carried of ['udid', 'SC2086', 'MD013']) expect(policy).not.toContain(carried);
    await expectPointers(sandbox.path);
    for (const path of ['.markdownlint.jsonc', '.eslintrc.json', '.prettierrc'])
        expect(await pathExists(join(sandbox.path, path))).toBe(false);
    expect(await pathExists(join(sandbox.path, 'quality', 'lint.sh'))).toBe(true);
    await installToolProjects(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect((JSON.parse(applied.stdout) as ApplyPlanJson).drift).toStrictEqual([]);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
});
