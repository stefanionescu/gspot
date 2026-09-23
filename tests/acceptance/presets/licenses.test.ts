// Planted repository for the licenses preset: a package under a license outside the list, and an exception that went stale.
import { run as runProcess } from '#cli/platform/spawn.ts';
import { reportSchema } from '#cli/run/report-schema.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { install, installPrivateTools, toolsPath } from '#tests/support/cli/tools.ts';
import { describe, expect, test } from 'bun:test';
import { readFileSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

const NPM_BIN = join(import.meta.dir, '../../../node_modules/.bin');
const INIT = [
    'init',
    '--yes',
    '--presets',
    'licenses',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const ROOT = '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true\n}\n';

function installed(name: string, license: string): string {
    return `{\n    "name": "${name}",\n    "version": "1.0.0",\n    "license": "${license}"\n}\n`;
}

describe('the licenses preset', () => {
    test(
        'a license outside the list fails, an exception that names it passes, and one that names another fails',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'package.json': ROOT,
                '.gitignore': 'node_modules/\n',
                'node_modules/kind/package.json': installed('kind', 'MIT'),
                'node_modules/choice/package.json': installed('choice', 'MIT OR (GPL-3.0-only AND GPL-2.0-only)'),
                'node_modules/combined/package.json': installed('combined', 'MIT AND (Apache-2.0 OR GPL-3.0-only)'),
            });
            commitAll(sandbox.path);
            const environment = { PATH: `${NPM_BIN}${delimiter}${toolsPath(['typos', 'ec'])}` };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const clean = await run(sandbox.path, ['check', '--only', 'licenses/packages', '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            await Bun.write(
                join(sandbox.path, 'node_modules/strict/package.json'),
                installed('strict', 'GPL-3.0-only'),
            );
            const refused = await run(
                sandbox.path,
                ['check', '--only', 'licenses/packages', '--no-cache'],
                environment,
            );
            expect(refused.code, refused.stdout + refused.stderr).toBe(1);
            expect(refused.stdout).toContain('strict@1.0.0 reports GPL-3.0-only');
            expect(refused.stdout).not.toContain('kind@1.0.0');
            await Bun.write(
                join(sandbox.path, 'node_modules/strict/package.json'),
                installed('strict', '(MIT OR Apache-2.0) AND GPL-3.0-only'),
            );
            const mixed = await run(sandbox.path, ['check', '--only', 'licenses/packages', '--no-cache'], environment);
            expect(mixed.code, mixed.stdout + mixed.stderr).toBe(1);
            expect(mixed.stdout).toContain('strict@1.0.0 reports (MIT OR Apache-2.0) AND GPL-3.0-only');
            await Bun.write(
                join(sandbox.path, 'node_modules/strict/package.json'),
                installed('strict', 'GPL-3.0-only'),
            );
            const policy = join(sandbox.path, 'gspot.toml');
            const before = await Bun.file(policy).text();
            const exception = (license: string): string =>
                `${before}\n[[tools.licenses.packages_allowed]]\npackage = "strict@1.0.0"\nlicense = "${license}"\nreason = "Used at build time only, never shipped."\n`;
            await Bun.write(policy, exception('GPL-3.0-only'));
            const appliedGPL30only = await run(sandbox.path, ['apply'], environment);
            expect(appliedGPL30only.code).toBe(0);
            const accepted = await run(
                sandbox.path,
                ['check', '--only', 'licenses/packages', '--no-cache'],
                environment,
            );
            expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
            await Bun.write(policy, exception('LGPL-3.0-only'));
            const appliedLGPL30only = await run(sandbox.path, ['apply'], environment);
            expect(appliedLGPL30only.code).toBe(0);
            const stale = await run(sandbox.path, ['check', '--only', 'licenses/packages', '--no-cache'], environment);
            expect(stale.code).toBe(1);
            expect(stale.stdout).toContain('the exception no longer holds');
            await Bun.write(join(sandbox.path, 'node_modules/strict/package.json'), installed('strict', 'MIT'));
            const changedToAllowed = await run(
                sandbox.path,
                ['check', '--only', 'licenses/packages', '--no-cache'],
                environment,
            );
            expect(changedToAllowed.code, changedToAllowed.stdout + changedToAllowed.stderr).toBe(1);
            expect(changedToAllowed.stdout).toContain('strict@1.0.0 reports MIT');
            expect(changedToAllowed.stdout).toContain('the exception no longer holds');
            await Bun.write(policy, exception('MIT'));
            const appliedMIT = await run(sandbox.path, ['apply'], environment);
            expect(appliedMIT.code).toBe(0);
            const correctedException = await run(
                sandbox.path,
                ['check', '--only', 'licenses/packages', '--no-cache'],
                environment,
            );
            expect(correctedException.code, correctedException.stdout + correctedException.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});

test.each(['recommended', 'all'])(
    'Python license CLI at %s scans the selected scope and distinguishes unavailable environments',
    async (level) => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'gspot.toml': `version = 1\nlevel = "${level}"\npresets = []\n[rules]\ninstall = false\n[[scope]]\npath = "app"\npresets = ["licenses"]\n`,
            'app/pyproject.toml':
                '[project]\nname = "fixture"\nversion = "0.0.0"\n[tool.pip-licenses]\nignore-packages = ["licensed-example"]\n',
            'sibling/pyproject.toml': '[project]\nname = "uninstalled-sibling"\nversion = "0.0.0"\n',
        });
        const applied = await run(root, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const generatedPath = join(root, '.gspot/app/licenses.json');
        const generated = readFileSync(generatedPath);
        expect(JSON.parse(generated.toString('utf8'))).toMatchObject({
            licenses_allowed: expect.arrayContaining(['MIT']),
            packages_allowed: [],
        });
        const reapplied = await run(root, ['apply']);
        expect(reapplied.code, reapplied.stdout + reapplied.stderr).toBe(0);
        expect(readFileSync(generatedPath)).toEqual(generated);
        await installPrivateTools(root);
        const command = ['check', '--stage', 'push', '--only', 'licenses/packages', '--no-cache', '--json'];
        const unavailable = await run(root, command);
        expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
        const created = await runProcess(['uv', 'venv', 'app/.venv'], { cwd: root });
        expect(created.code, created.stderr).toBe(0);
        const empty = await run(root, command);
        expect(empty.code, empty.stdout + empty.stderr).toBe(2);
        const python = join(root, 'app/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
        const located = await runProcess(
            [python, '-I', '-c', 'import sysconfig; print(sysconfig.get_path("purelib"))'],
            { cwd: root },
        );
        expect(located.code, located.stderr).toBe(0);
        const metadata = join(located.stdout.trim(), 'licensed_example-1.0.0.dist-info/METADATA');
        const writeLicense = async (license: string): Promise<void> => {
            await Bun.write(
                metadata,
                `Metadata-Version: 2.1\nName: licensed-example\nVersion: 1.0.0\nLicense: ${license}\n`,
            );
        };
        await writeLicense('GPL-3.0-only');
        const rejected = await run(root, command);
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        expect(reportSchema.parse(JSON.parse(rejected.stdout)).checks).toMatchObject([
            {
                check: 'licenses/packages',
                scope: 'app',
                status: 'fail',
                findings: [{ file: 'app/pyproject.toml', rule: 'license' }],
            },
        ]);
        await writeLicense('MIT');
        const corrected = await run(root, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        rmSync(python);
        const broken = await run(root, command);
        expect(broken.code, broken.stdout + broken.stderr).toBe(2);
    },
    PLANTED_TIMEOUT_MS * 2,
);
