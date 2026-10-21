import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { readTree } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openWriter } from '#cli/ownership/writer.ts';
import { generate } from '#cli/generation/generate.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { runRegisteredCommand } from '#tests/setup/run-gspot.ts';
import { type DoctorReport } from '#cli/types/commands/doctor.ts';
import { matchItems, matchFields } from '#tests/setup/matchers.ts';
import { listSuggestions } from '#cli/commands/doctor/suggestions.ts';
import { SERVER_FILES } from '#tests/data/generation/eslint/framework.ts';
import { STYLELINT_FILES, STYLELINT_SUGGESTIONS } from '#tests/data/checks/css.ts';
import { REMOVED_CONFIGURATION_SUGGESTIONS } from '#tests/data/commands/doctor.ts';
import { COMMITLINT_PACKAGE, COMMITLINT_PROJECT } from '#tests/data/checks/commits.ts';

test('a folder without Git keeps authored commit settings and reports its actual prerequisite', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': COMMITLINT_PACKAGE,
        'gspot.toml': buildSettingsText([], { level: 'all' }),
    });
    const session = await openSession(sandbox.path);
    expect(generate(session).fileEdits).toStrictEqual([]);
    expect(listSuggestions(session).unowned.filter((row) => row.note.includes('commitlint'))).toStrictEqual([
        { path: 'package.json', note: 'commitlint requires a Git repository', command: 'git init' },
    ]);
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(COMMITLINT_PACKAGE);
});
test('Next.js suggests CSS without translations for its explicit server files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...SERVER_FILES,
        'gspot.toml': `level = "all"
configurations = ["javascript"]
[[scope]]
path = "app"
configurations = ["nextjs"]
`,
    });
    const suggestions = listSuggestions(await openSession(sandbox.path)).suggested.map(
        ({ configuration }) => configuration,
    );
    expect(suggestions).toContain('css');
    expect(suggestions).not.toContain('translations');
});
test('doctor removes obsolete managed commitlint fields and suggests level all for newly authored fields', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...COMMITLINT_PROJECT,
        'gspot.toml': buildSettingsText([], {
            level: 'all',
            tables: `[[scope]]
path = "app"
[[scope]]
path = "app/child"
`,
        }),
    });
    commitAll(sandbox.path);
    const applied = await runRegisteredCommand(sandbox.path, ['apply']);
    expect(applied.exitCode, applied.text).toBe(0);
    expect(
        listSuggestions(await openSession(sandbox.path)).unowned.filter((row) => row.path.endsWith('package.json')),
    ).toStrictEqual([]);
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildSettingsText([], { level: 'recommended' }));
    const removed = await runRegisteredCommand(sandbox.path, ['apply']);
    expect(removed.exitCode, removed.text).toBe(0);
    for (const [path, source] of Object.entries(COMMITLINT_PROJECT)) {
        const expected = JSON.parse(source) as Record<string, unknown>;
        Reflect.deleteProperty(expected, 'commitlint');
        expect(JSON.parse(await Bun.file(join(sandbox.path, path)).text())).toStrictEqual(expected);
    }
    expect(
        listSuggestions(await openSession(sandbox.path)).unowned.filter((row) => row.note.includes('commitlint')),
    ).toStrictEqual([]);
    await Bun.write(join(sandbox.path, 'package.json'), COMMITLINT_PACKAGE);
    expect(
        listSuggestions(await openSession(sandbox.path))
            .unowned.filter((row) => row.note.includes('commitlint'))
            .map(({ path, command }) => ({ path, command })),
    ).toStrictEqual([{ path: 'package.json', command: 'gspot set level all' }]);
});
test('doctor suggests moving authored Stylelint fields while excluding managed fields', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...STYLELINT_FILES,
        'gspot.toml': buildSettingsText(['css'], {
            level: 'all',
            tables: `[[scope]]
path = "app"
[[scope]]
path = "app/child"
[[scope]]
path = "other"
`,
        }),
    });
    const applied = await runRegisteredCommand(sandbox.path, ['apply']);
    expect(applied.exitCode, applied.text).toBe(0);
    const suggestions = listSuggestions(await openSession(sandbox.path));
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
        'gspot.toml': buildSettingsText([]),
        '.gspot/pyproject.toml': python,
        '.gspot/package.json': '{"dependencies":{"react":"19.1.1"}}',
    });
    const privateOnly = await runRegisteredCommand(sandbox.path, ['doctor']);
    const detected = (privateOnly.json as DoctorReport).suggestions.detected.map(({ configuration }) => configuration);
    expect(detected).not.toContain('python');
    expect(detected).not.toContain('react');
    expect(detected).not.toContain('files');
    await writeFile(join(sandbox.path, 'pyproject.toml'), python);
    const authored = await runRegisteredCommand(sandbox.path, ['doctor']);
    expect(authored.json).toMatchObject({
        suggestions: {
            detected: matchItems([matchFields({ configuration: 'python', evidence: 'pyproject.toml' })]),
        },
    });
    expect(await readFile(join(sandbox.path, '.gspot/pyproject.toml'), 'utf8')).toBe(python);
    readGitOutput(sandbox.path, ['init']);
    readGitOutput(sandbox.path, ['add', '.']);
    readGitOutput(sandbox.path, ['commit', '-qm', 'Source']);
    const commit = readGitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    const path = 'vendor/external project';
    readGitOutput(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${commit},${path}`]);
    const result = await runRegisteredCommand(sandbox.path, ['doctor']);
    expect(result.json).toMatchObject({ submodules: [path] });
});
test('doctor suggests the command that adds the configuration of a new Python file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['bash']),
        'entry.sh': 'echo\n',
    });
    {
        using log = openWriter(sandbox.path);
        const session = await openSession(sandbox.path);
        writeGeneratedFiles(session, generate(session), log);
    }
    await writeFile(join(sandbox.path, 'service.py'), 'print("hello")\n');
    const result = await runRegisteredCommand(sandbox.path, ['doctor']);
    const { suggestions } = result.json as DoctorReport;
    expect(suggestions.detected).toContainEqual(matchFields({ configuration: 'python', command: 'gspot add python' }));
});
test('doctor detects installed test frameworks and suggests no other runner', async () => {
    await using sandbox = await testdir();
    const settings = buildSettingsText(['nestjs']);
    const dependencies = { '@nestjs/core': '11.2.3', jest: '30.2.0' };
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'package.json': JSON.stringify({ name: 'service', private: true, dependencies }),
        'src/server.ts': 'export const port = 3000;\n',
    });
    const currentResult = await runRegisteredCommand(sandbox.path, ['doctor']);
    const current = currentResult.json as DoctorReport;
    expect(current.suggestions.suggested.map((row) => row.configuration)).not.toContain('vitest');
    expect(current.suggestions.detected.map((row) => row.configuration)).toContain('jest');
    await Bun.write(
        join(sandbox.path, 'package.json'),
        JSON.stringify({ name: 'service', private: true, dependencies: { ...dependencies, vitest: '4.1.11' } }),
    );
    const changedResult = await runRegisteredCommand(sandbox.path, ['doctor']);
    const changed = changedResult.json as DoctorReport;
    expect(changed.suggestions.detected.map((row) => row.configuration)).toContain('vitest');
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(settings);
});
test('doctor suggests a remove command per scope after detection evidence goes, and changes nothing', async () => {
    const level = 'all';
    await using sandbox = await testdir();
    const settings = buildSettingsText(['bash'], {
        level,
        tables: `[[scope]]
path = "api app"
configurations = ["python"]
[[scope]]
path = "api app/deep"
`,
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'entry.sh': 'echo ready\n',
        'api app/service.py': 'print("ready")\n',
        'api app/deep/README.md': '# Service\n',
        'sibling/service.py': 'print("sibling")\n',
    });
    const present = await runRegisteredCommand(sandbox.path, ['doctor']);
    expect((present.json as DoctorReport).suggestions.undetected).toStrictEqual([]);
    await rm(join(sandbox.path, 'entry.sh'));
    await rm(join(sandbox.path, 'api app/service.py'));
    const before = await readTree(sandbox.path);
    const missing = await runRegisteredCommand(sandbox.path, ['doctor']);
    expect((missing.json as DoctorReport).suggestions.undetected).toStrictEqual([
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
    expect(missing.text).toContain('selected, but no matching files found');
    expect(missing.text).toContain("gspot remove python --scope 'api app'");
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    await writeFile(join(sandbox.path, 'entry.sh'), 'echo ready\n');
    await writeFile(join(sandbox.path, 'api app/service.py'), 'print("ready")\n');
    const restored = await runRegisteredCommand(sandbox.path, ['doctor']);
    expect((restored.json as DoctorReport).suggestions.undetected).toStrictEqual([]);
});

test.each([...REMOVED_CONFIGURATION_SUGGESTIONS])(
    'doctor skips removed configurations and keeps detection evidence outside their scopes: $name',
    async ({ project, expected }) => {
        await using sandbox = await testdir(project);
        const result = await runRegisteredCommand(sandbox.path, ['doctor']);
        const { suggestions } = result.json as DoctorReport;
        expect(suggestions.detected.filter(({ configuration }) => configuration === 'bash')).toStrictEqual([
            ...expected,
        ]);
        expect(suggestions.detected.map(({ configuration }) => configuration)).toContain('python');
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(project['gspot.toml']);
    },
);
