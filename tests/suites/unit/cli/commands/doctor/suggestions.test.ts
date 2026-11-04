import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { doctorOutputSchema } from '#cli/schemas/commands.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { REMOVE_SUGGESTIONS, CI_PREFERENCE_CASES } from '#tests/config/commands/reports.ts';
import { STYLELINT_FILES, COMMITLINT_PACKAGE } from '#tests/config/setup/configurations.ts';

async function listDetectedNames(root: string): Promise<Array<string | undefined>> {
    const findings = await runSandboxCheck(root, 'gspot/detected-configurations');
    return findings.map(({ message }) => /Run gspot add (\S+?)[,\s]/u.exec(message)?.[1]);
}

test.each([
    {
        scenario: 'leaves undetected CSS out of suggestions for a selected Next.js scope',
        files: { 'app/.keep': '' },
        suggested: [],
    },
    {
        scenario: 'suggests CSS through React for a selected Next.js scope that holds a stylesheet',
        files: { 'app/styles.css': '.title { color: red; }\n' },
        suggested: [{ configuration: 'css', evidence: 'suggested by react', command: 'gspot add css' }],
    },
])('doctor $scenario', async ({ files, suggested }) => {
    await using sandbox = await createGitSandbox({
        ...files,
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            rules: true,
            scopes: [{ path: 'app', configurations: ['nextjs'] }],
        }),
    });

    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(doctorOutputSchema.parse(JSON.parse(result.stdout)).suggestions.suggested).toStrictEqual([...suggested]);
});

test('doctor suggests gspot set level all for a commitlint field in package.json at level basic', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': COMMITLINT_PACKAGE,
        'gspot.toml': buildSandboxSettings([], { level: 'basic' }),
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(doctorOutputSchema.parse(JSON.parse(result.stdout)).suggestions.unowned).toStrictEqual([
        {
            path: 'package.json',
            note: expect.stringContaining('commitlint') as string,
            command: 'gspot set level all',
        },
    ]);
});

test('doctor recognizes managed Stylelint fields in every selected scope', async () => {
    await using sandbox = await createGitSandbox({
        ...STYLELINT_FILES,
        'app/child/style.css': '.child { color: red; }\n',
        'other/style.css': '.other { color: blue; }\n',
        'gspot.toml': buildSandboxSettings(['css'], {
            level: 'all',
            scopes: [{ path: 'app' }, { path: 'app/child' }, { path: 'other' }],
        }),
    });

    await applyGeneratedFiles(sandbox.path);
    const doctor = await runGspot(sandbox.path, ['doctor', '--json']);
    const { suggestions } = doctorOutputSchema.parse(JSON.parse(doctor.stdout));
    expect(suggestions.unowned).toStrictEqual([]);
    for (const [path, target] of [
        ['package.json', './.stylelintrc.yml'],
        ['app/package.json', '../.gspot/configurations/language/css/stylelint.json'],
        ['app/child/package.json', '../../.gspot/configurations/language/css/stylelint.json'],
        ['other/package.json', '../.gspot/configurations/language/css/stylelint.json'],
    ] as const) {
        const document = JSON.parse(await readFile(join(sandbox.path, path), 'utf8')) as { stylelint: unknown };
        expect(document.stylelint).toStrictEqual({ extends: target });
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
    expect(await listDetectedNames(sandbox.path)).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'pyproject.toml'), python);
    expect(await listDetectedNames(sandbox.path)).toStrictEqual(['pytest', 'python']);
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
    const after = doctorOutputSchema.parse(JSON.parse(afterResult.stdout));
    expect(after.suggestions.suggested).toStrictEqual([]);
    expect(await listDetectedNames(sandbox.path)).toStrictEqual(['jest']);
    await writeFile(
        join(sandbox.path, 'package.json'),
        JSON.stringify({ name: 'service', private: true, dependencies: { ...dependencies, vitest: '4.1.11' } }),
    );
    expect(await listDetectedNames(sandbox.path)).toStrictEqual(['jest', 'vitest']);
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
    expect(doctorOutputSchema.parse(JSON.parse(present.stdout)).suggestions.undetected).toStrictEqual([]);
    await rm(join(sandbox.path, 'entry.sh'));
    await rm(join(sandbox.path, 'api app/service.py'));
    const before = await readTree(sandbox.path);
    const missing = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(doctorOutputSchema.parse(JSON.parse(missing.stdout)).suggestions.undetected).toStrictEqual([
        ...REMOVE_SUGGESTIONS,
    ]);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    await writeFile(join(sandbox.path, 'entry.sh'), 'echo ready\n');
    await writeFile(join(sandbox.path, 'api app/service.py'), 'print("ready")\n');
    const restored = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(doctorOutputSchema.parse(JSON.parse(restored.stdout)).suggestions.undetected).toStrictEqual([]);
    const suggestion = doctorOutputSchema
        .parse(JSON.parse(missing.stdout))
        .suggestions.undetected.find(({ configuration }) => configuration === 'bash')!;
    const command = suggestion.command.split(' ').slice(1);
    command[command.length - 1] = 'The project no longer uses this language.';
    const removed = await runGspot(sandbox.path, command);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
});

test('the doctor text puts the command of a suggestion after a colon', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash']) });
    const result = await runGspot(sandbox.path, ['doctor']);
    expect(result.stdout).toMatch(
        /^ {2}bash +no files in \. yet; remove it if none are planned: gspot remove bash --reason "<why>"$/mu,
    );
});

test.each([...CI_PREFERENCE_CASES])(
    'with CI off, doctor names the commands for the CI of $name',
    async ({ tracked, remote, ci }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([]),
            ...Object.fromEntries(tracked.map((file) => [file, '{}\n'])),
        });
        if (tracked.length > 0) runGitStep(sandbox.path, ['add', '--', ...tracked]);
        runGitStep(sandbox.path, ['config', 'remote.origin.url', remote]);
        const result = await runGspot(sandbox.path, ['doctor']);
        expect(result.stdout).toContain(`ci: ${ci}\n`);
    },
);
