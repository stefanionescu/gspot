import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { CAUGHT_EXAMPLE } from '#docs/config/home.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { SYNCPACK_PACKAGE_FILES } from '#tests/config/integration/general.ts';
import { spawnGspot, runGspotStep, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';

function writeKatexLockfile(root: string, version: string): void {
    const project = { name: 'katex-example', private: true, dependencies: { katex: version } };
    const lockfile = {
        name: project.name,
        lockfileVersion: 3,
        requires: true,
        packages: {
            '': { name: project.name, dependencies: project.dependencies },
            'node_modules/katex': {
                version,
                resolved: `https://registry.npmjs.org/katex/-/katex-${version}.tgz`,
            },
        },
    };
    writeFileSync(join(root, 'package.json'), `${JSON.stringify(project, null, 4)}\n`);
    writeFileSync(join(root, 'package-lock.json'), `${JSON.stringify(lockfile, null, 4)}\n`);
}

test('dependencies/syncpack reports each mismatched package.json and passes once the versions match', async () => {
    await using sandbox = await createGitSandbox({
        ...SYNCPACK_PACKAGE_FILES,
        'gspot.toml': buildSandboxSettings(['dependencies', 'javascript'], { level: 'all' }),
    });
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['install']);
    const command = ['check', '--only', 'dependencies/syncpack', '--json'];
    const mismatched = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(mismatched.code, mismatched.stdout + mismatched.stderr).toBe(1);
    expect(listFindingRows(mismatched.report)).toStrictEqual(
        ['packages/app/package.json', 'package.json'].map((file) => ({
            file,
            line: undefined,
            rule: 'SameRangeMismatch',
        })),
    );
    await writeFile(
        join(sandbox.path, 'packages/app/package.json'),
        SYNCPACK_PACKAGE_FILES['package.json'].replace('"root"', '"app"'),
    );
    const corrected = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(listFindingRows(corrected.report)).toStrictEqual([]);
});

test('osv-scanner reports the katex advisory of the home example, and passes after the override', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['dependencies']) });
    const root = sandbox.path;
    const { pulled, advisory, fix } = CAUGHT_EXAMPLE;
    writeKatexLockfile(root, pulled.version);
    await applyGeneratedFiles(root);
    const cases: Array<{ version: string; code: number; advisories: string[] }> = [
        { version: pulled.version, code: 1, advisories: [advisory] },
        { version: fix.version, code: 0, advisories: [] },
    ];
    for (const expected of cases) {
        writeKatexLockfile(root, expected.version);
        runGitStep(root, ['add', '-A']);
        const checked = parseCheckReport(
            await spawnGspot(root, ['check', '--only', 'dependencies/osv-scanner', '--json']),
        );
        expect(checked.code, checked.stdout + checked.stderr).toBe(expected.code);
        const findings = checked.report.checks.flatMap((check) => check.findings);
        const shown = findings.filter((finding) => expected.advisories.includes(finding.rule ?? ''));
        expect(shown.map(({ file, rule }) => ({ file, rule }))).toStrictEqual(
            expected.advisories.map((rule) => ({ file: 'package-lock.json', rule })),
        );
        for (const finding of shown) {
            expect(finding.message).toStartWith(`${pulled.name}@${pulled.version}: `);
            expect(finding.message).toMatch(/ Fixed in \S+(?:, \S+)*\.$/u);
        }
    }
});
