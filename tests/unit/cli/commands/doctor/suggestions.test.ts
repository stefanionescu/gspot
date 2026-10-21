import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readTree } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { type DryRunJson } from '#cli/types/commands/apply.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { type DoctorReport } from '#cli/types/commands/doctor.ts';
import { COMMITLINT_PACKAGE } from '#tests/data/checks/commits.ts';
import { matchItems, matchFields } from '#tests/setup/matchers.ts';
import { STYLELINT_FILES, STYLELINT_SUGGESTIONS } from '#tests/data/checks/css.ts';
import { REMOVED_CONFIGURATION_SUGGESTIONS } from '#tests/data/commands/doctor.ts';

test('a folder without Git keeps authored commit settings and reports its actual prerequisite', async () => {
    await using sandbox = await testdir({
        'package.json': COMMITLINT_PACKAGE,
        'gspot.toml': buildSandboxSettings([], { level: 'all' }),
    });

    const preview = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(
        (JSON.parse(preview.stdout) as DryRunJson).stale.filter(({ path }) => path === 'package.json'),
    ).toStrictEqual([]);
    const doctor = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(
        (JSON.parse(doctor.stdout) as DoctorReport).suggestions.unowned.filter((row) =>
            row.note.includes('commitlint'),
        ),
    ).toStrictEqual([{ path: 'package.json', note: 'commitlint requires a Git repository', command: 'git init' }]);
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(COMMITLINT_PACKAGE);
});
test('doctor suggests gspot add css for a selected Next.js scope', async () => {
    await using sandbox = await testdir({
        'app/.keep': '',
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            rules: true,
            scopes: [{ path: 'app', configurations: ['nextjs'] }],
        }),
    });

    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect((JSON.parse(result.stdout) as DoctorReport).suggestions.suggested).toStrictEqual([
        { configuration: 'css', evidence: 'suggested by react', command: 'gspot add css' },
    ]);
});
test('doctor suggests gspot set level all for a commitlint field in package.json at level recommended', async () => {
    await using sandbox = await testdir({
        'package.json': COMMITLINT_PACKAGE,
        'gspot.toml': buildSandboxSettings([], { level: 'recommended' }),
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(
        (JSON.parse(result.stdout) as DoctorReport).suggestions.unowned
            .filter((row) => row.note.includes('commitlint'))
            .map(({ path, command }) => ({ path, command })),
    ).toStrictEqual([{ path: 'package.json', command: 'gspot set level all' }]);
});
test('doctor suggests moving authored Stylelint fields while excluding managed fields', async () => {
    await using sandbox = await testdir({
        ...STYLELINT_FILES,
        'gspot.toml': buildSandboxSettings(['css'], {
            level: 'all',
            scopes: [{ path: 'app' }, { path: 'app/child' }, { path: 'other' }],
        }),
    });

    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const doctor = await runGspot(sandbox.path, ['doctor', '--json']);
    const { suggestions } = JSON.parse(doctor.stdout) as DoctorReport;
    expect(suggestions.unowned.filter((row) => ['package.json', 'app/package.json'].includes(row.path))).toStrictEqual(
        [],
    );
    expect(
        suggestions.unowned
            .filter((row) => row.note.includes('stylelint'))
            .map(({ path, command }) => ({ path, command })),
    ).toStrictEqual([...STYLELINT_SUGGESTIONS]);
});
test('doctor reports Python and submodules and does not treat tool projects as source', async () => {
    await using sandbox = await testdir();
    const python = `[project]
name = "example"
version = "1.0.0"
dependencies = ["pytest==8.4.2"]
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([]),
        '.gspot/pyproject.toml': python,
        '.gspot/package.json': '{"dependencies":{"react":"19.1.1"}}',
    });
    const privateOnly = await runGspot(sandbox.path, ['doctor', '--json']);
    const detected = (JSON.parse(privateOnly.stdout) as DoctorReport).suggestions.detected.map(
        ({ configuration }) => configuration,
    );
    expect(detected).not.toContain('python');
    expect(detected).not.toContain('react');
    expect(detected).not.toContain('files');
    await writeFile(join(sandbox.path, 'pyproject.toml'), python);
    const authored = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(JSON.parse(authored.stdout)).toMatchObject({
        suggestions: {
            detected: matchItems([
                matchFields({ configuration: 'python', evidence: 'pyproject.toml', command: 'gspot add python' }),
            ]),
        },
    });
    expect(await readFile(join(sandbox.path, '.gspot/pyproject.toml'), 'utf8')).toBe(python);
    readGitOutput(sandbox.path, ['init']);
    readGitOutput(sandbox.path, ['add', '.']);
    readGitOutput(sandbox.path, ['commit', '-qm', 'Source']);
    const commit = readGitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    const path = 'vendor/external project';
    readGitOutput(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${commit},${path}`]);
    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(JSON.parse(result.stdout)).toMatchObject({ submodules: [path] });
});
test('doctor detects installed test frameworks and suggests no other runner', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['nestjs']);
    const dependencies = { '@nestjs/core': '11.2.3', jest: '30.2.0' };
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'package.json': JSON.stringify({ name: 'service', private: true, dependencies }),
        'src/server.ts': 'export const port = 3000;\n',
    });
    const currentResult = await runGspot(sandbox.path, ['doctor', '--json']);
    const current = JSON.parse(currentResult.stdout) as DoctorReport;
    expect(current.suggestions.suggested.map((row) => row.configuration)).not.toContain('vitest');
    expect(current.suggestions.detected.map((row) => row.configuration)).toContain('jest');
    await writeFile(
        join(sandbox.path, 'package.json'),
        JSON.stringify({ name: 'service', private: true, dependencies: { ...dependencies, vitest: '4.1.11' } }),
    );
    const changedResult = await runGspot(sandbox.path, ['doctor', '--json']);
    const changed = JSON.parse(changedResult.stdout) as DoctorReport;
    expect(changed.suggestions.detected.map((row) => row.configuration)).toContain('vitest');
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});
test('doctor suggests a remove command per scope after detection evidence goes, and changes nothing', async () => {
    const level = 'all';
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['bash'], {
        level,
        scopes: [{ path: 'api app', configurations: ['python'] }, { path: 'api app/deep' }],
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'entry.sh': 'echo ready\n',
        'api app/service.py': 'print("ready")\n',
        'api app/deep/README.md': '# Service\n',
        'sibling/service.py': 'print("sibling")\n',
    });
    const present = await runGspot(sandbox.path, ['doctor', '--json']);
    expect((JSON.parse(present.stdout) as DoctorReport).suggestions.undetected).toStrictEqual([]);
    await rm(join(sandbox.path, 'entry.sh'));
    await rm(join(sandbox.path, 'api app/service.py'));
    const before = await readTree(sandbox.path);
    const missing = await runGspot(sandbox.path, ['doctor', '--json']);
    const missingText = await runGspot(sandbox.path, ['doctor']);
    expect((JSON.parse(missing.stdout) as DoctorReport).suggestions.undetected).toStrictEqual([
        {
            configuration: 'bash',
            evidence: 'no detection evidence in root',
            command: 'gspot remove bash (if you no longer need it)',
        },
        {
            configuration: 'python',
            evidence: 'no detection evidence in api app',
            command: "gspot remove python --scope 'api app' (if you no longer need it)",
        },
    ]);
    expect(missingText.stdout).toContain('selected, but no matching files found');
    expect(missingText.stdout).toContain("gspot remove python --scope 'api app'");
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    await writeFile(join(sandbox.path, 'entry.sh'), 'echo ready\n');
    await writeFile(join(sandbox.path, 'api app/service.py'), 'print("ready")\n');
    const restored = await runGspot(sandbox.path, ['doctor', '--json']);
    expect((JSON.parse(restored.stdout) as DoctorReport).suggestions.undetected).toStrictEqual([]);
});

test.each([...REMOVED_CONFIGURATION_SUGGESTIONS])(
    'doctor skips removed configurations and keeps detection evidence outside their scopes: $name',
    async ({ project, expected }) => {
        await using sandbox = await testdir(project);
        const result = await runGspot(sandbox.path, ['doctor', '--json']);
        const { suggestions } = JSON.parse(result.stdout) as DoctorReport;
        expect(suggestions.detected.filter(({ configuration }) => configuration === 'bash')).toStrictEqual([
            ...expected,
        ]);
        expect(suggestions.detected.map(({ configuration }) => configuration)).toContain('python');
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(project['gspot.toml']);
    },
);
