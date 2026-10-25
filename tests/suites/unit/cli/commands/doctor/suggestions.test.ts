import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { type DoctorReport } from '#cli/types/commands/doctor.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { commitAll, runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { STYLELINT_FILES, COMMITLINT_PACKAGE } from '#tests/config/authored-config-files.ts';
import { REMOVE_SUGGESTIONS, REMOVED_CONFIGURATION_SUGGESTIONS } from '#tests/config/commands/doctor/suggestions.ts';

test('doctor names Git setup for commitlint and apply --dry-run refuses outside Git', async () => {
    await using sandbox = await testdir({
        'package.json': COMMITLINT_PACKAGE,
        'gspot.toml': buildSandboxSettings([], { level: 'all' }),
    });

    const preview = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(preview.code).toBe(2);
    expect(JSON.parse(preview.stdout)).toStrictEqual({
        error: 'git',
        message: 'gspot needs a Git repository. Run git init, then gspot init.',
    });
    const doctor = await runGspot(sandbox.path, ['doctor', '--json']);
    expect((JSON.parse(doctor.stdout) as DoctorReport).suggestions.unowned).toStrictEqual([
        { path: 'package.json', note: 'commitlint requires a Git repository', command: 'git init' },
    ]);
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(COMMITLINT_PACKAGE);
});
test('doctor leaves undetected CSS out of suggestions for a selected Next.js scope', async () => {
    await using sandbox = await testdir({
        'app/.keep': '',
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            rules: true,
            scopes: [{ path: 'app', configurations: ['nextjs'] }],
        }),
    });

    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect((JSON.parse(result.stdout) as DoctorReport).suggestions.suggested).toStrictEqual([]);
});
test('doctor suggests gspot set level all for a commitlint field in package.json at level recommended', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': COMMITLINT_PACKAGE,
        'gspot.toml': buildSandboxSettings([], { level: 'recommended' }),
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect((JSON.parse(result.stdout) as DoctorReport).suggestions.unowned).toStrictEqual([
        {
            path: 'package.json',
            note: 'no applicable commitlint check at level recommended',
            command: 'gspot set level all',
        },
    ]);
});
test('doctor recognizes managed Stylelint fields in every selected scope', async () => {
    await using sandbox = await createGitSandbox({
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
    expect(suggestions.unowned).toStrictEqual([]);
    for (const path of ['package.json', 'app/package.json', 'app/child/package.json', 'other/package.json']) {
        const document = JSON.parse(await readFile(join(sandbox.path, path), 'utf8')) as { stylelint: unknown };
        expect(document.stylelint).toStrictEqual({ extends: './.stylelintrc.yml' });
    }
});
test('doctor leaves the tool projects in .gspot out of detection, detects python from your pyproject.toml, and lists a submodule', async () => {
    await using sandbox = await createGitSandbox({});
    const python = '[project]\nname = "example"\nversion = "1.0.0"\ndependencies = ["pytest==8.4.2"]\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([]),
        [GSPOT_PATHS.pythonProject]: python,
        [GSPOT_PATHS.npmProject]: '{"dependencies":{"react":"19.1.1"}}',
    });
    const privateOnly = await runGspot(sandbox.path, ['doctor', '--json']);
    const detected = (JSON.parse(privateOnly.stdout) as DoctorReport).suggestions.detected.map(
        ({ configuration }) => configuration,
    );
    expect(detected).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'pyproject.toml'), python);
    const authored = await runGspot(sandbox.path, ['doctor', '--json']);
    expect((JSON.parse(authored.stdout) as DoctorReport).suggestions.detected).toStrictEqual([
        { configuration: 'pytest', evidence: 'pytest in pyproject.toml', command: 'gspot add pytest' },
        { configuration: 'python', evidence: 'pyproject.toml', command: 'gspot add python' },
    ]);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.pythonProject), 'utf8')).toBe(python);
    runGitStep(sandbox.path, ['add', '.']);
    runGitStep(sandbox.path, ['commit', '-qm', 'Source']);
    const commit = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    const path = 'vendor/external project';
    runGitStep(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${commit},${path}`]);
    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(JSON.parse(result.stdout)).toMatchObject({ submodules: [path] });
});
test('doctor detects installed test frameworks and suggests no other runner', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings(['nestjs']);
    const dependencies = { '@nestjs/core': '11.2.3', jest: '30.2.0' };
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'package.json': JSON.stringify({ name: 'service', private: true, dependencies }),
        'src/server.ts': 'export const port = 3000;\n',
    });
    const afterResult = await runGspot(sandbox.path, ['doctor', '--json']);
    const after = JSON.parse(afterResult.stdout) as DoctorReport;
    expect({ suggested: after.suggestions.suggested, detected: after.suggestions.detected }).toStrictEqual({
        suggested: [],
        detected: [{ configuration: 'jest', evidence: 'jest in package.json', command: 'gspot add jest' }],
    });
    await writeFile(
        join(sandbox.path, 'package.json'),
        JSON.stringify({ name: 'service', private: true, dependencies: { ...dependencies, vitest: '4.1.11' } }),
    );
    const changedResult = await runGspot(sandbox.path, ['doctor', '--json']);
    const changed = JSON.parse(changedResult.stdout) as DoctorReport;
    expect(changed.suggestions.detected).toStrictEqual([
        { configuration: 'jest', evidence: 'jest in package.json', command: 'gspot add jest' },
        { configuration: 'vitest', evidence: 'vitest in package.json', command: 'gspot add vitest' },
    ]);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});
test('doctor suggests a remove command per scope after detection evidence goes, and changes nothing', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings(['bash'], {
        level: 'all',
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
    expect((JSON.parse(missing.stdout) as DoctorReport).suggestions.undetected).toStrictEqual([...REMOVE_SUGGESTIONS]);
    expect(missingText.stdout.split('\n\n').find((block) => block.startsWith('selected, but no matching'))).toBe(
        [
            'selected, but no matching files found',
            '  bash                               no detection evidence in root; remove it if you no longer need it    gspot remove bash --reason "<why>"',
            '  python                             no detection evidence in api app; remove it if you no longer need it gspot remove python --scope \'api app\' --reason "<why>"',
        ].join('\n'),
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    await writeFile(join(sandbox.path, 'entry.sh'), 'echo ready\n');
    await writeFile(join(sandbox.path, 'api app/service.py'), 'print("ready")\n');
    const restored = await runGspot(sandbox.path, ['doctor', '--json']);
    expect((JSON.parse(restored.stdout) as DoctorReport).suggestions.undetected).toStrictEqual([]);
    const suggestion = (JSON.parse(missing.stdout) as DoctorReport).suggestions.undetected.find(
        ({ configuration }) => configuration === 'bash',
    )!;
    const command = suggestion.command.split(' ').slice(1);
    command[command.length - 1] = 'The project no longer uses this language.';
    const removed = await runGspot(sandbox.path, command);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
});

test.each([...REMOVED_CONFIGURATION_SUGGESTIONS])(
    'doctor skips removed configurations and keeps detection evidence outside their scopes: $name',
    async ({ options, files, expected }) => {
        const settings = buildSandboxSettings([], { rules: true, ...options });
        await using sandbox = await createGitSandbox({ ...files, 'gspot.toml': settings });
        const result = await runGspot(sandbox.path, ['doctor', '--json']);
        const { suggestions } = JSON.parse(result.stdout) as DoctorReport;
        expect(suggestions.detected.filter(({ configuration }) => configuration === 'bash')).toStrictEqual([
            ...expected,
        ]);
        expect(suggestions.detected.map(({ configuration }) => configuration)).toContain('python');
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    },
);
