import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, spyOn, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { emitAll } from '#cli/generation/files.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openWriter } from '#cli/ownership/writer.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { settingsText } from '#tests/setup/settings.ts';
import { buildManifest } from '#tests/setup/manifest.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { semgrep } from '#cli/checks/general/security.ts';
import { commitAll, gitOutput } from '#tests/setup/git.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { hasToolBuild } from '#tests/setup/operating-systems.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import { ALWAYS_SELECTED } from '#tests/config/configurations.ts';
import { MOBILE_SETTINGS } from '#tests/config/eslint/framework.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { FORMAT_SETTINGS, PRETTIER_PATH_IGNORE } from '#tests/config/formatting.ts';
import { EXPO_DEPENDENCIES, REACT_NATIVE_DEPENDENCIES } from '#tests/config/react.ts';
import { planRun, isActive, configuredChecks, coverageArguments } from '#cli/planning/checks.ts';
import { HISTORY_TABLES, HISTORY_MANIFEST, TOOL_FILE_PLANNING_CASES } from '#tests/config/planning.ts';

test('coverage arguments leave other commands, your own checks, and given arguments unchanged', async () => {
    await using sandbox = await testdir();
    const command = [process.execPath, '--coverage', '', 'two words'];
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            command_check: [{ name: 'project/tests', command, stage: 'push', paths: ['sample.test.cjs'] }],
        }),
        'sample.test.cjs': 'const authored = true;\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'push', only: ['project/tests'] })[0]!;
    using run = spyOn(processes, 'run');
    run.mockImplementation((argv) => {
        expect(argv).toStrictEqual(command);
        return Promise.resolve({ code: 0, missing: false, stdout: '', stderr: '', duration: 1 });
    });
    const authored = await runCheckCommand(session, planned);
    const supplied = await runCheckCommand(session, planned, { command });
    expect(authored.status).toBe('passed');
    expect(supplied.status).toBe('passed');
    expect(coverageArguments(planned, { command: ['echo', '', 'two words'] })).toStrictEqual(['echo', '', 'two words']);
});

test('a project check without its own inputs is inactive even when its scope holds another language', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['python', 'bash']),
        'source.sh': 'echo example\n',
    });
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ only: ['python/ruff'] });
    const planned = planRun(session, options);
    expect(planned.every((entry) => entry.files.length === 0)).toBe(true);
    const outcome = await executeRun(session, options);
    expect(outcome.report.exitCode).toBe(0);
    expect(outcome.report.checks).toStrictEqual([]);
    expect(outcome.report.skips).toStrictEqual([{ check: 'python/ruff', cause: 'inputs' }]);
});

test.each([
    { paths: ['api/**'], ignored: true },
    { paths: ['api'], ignored: true },
    { paths: ['api/**', '!api/app/**'], ignored: false },
])(
    'an ignore of a whole scope keeps the replaced check running there and nowhere else: %j',
    async ({ paths, ignored }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `configurations = ["typescript"]
[[scope]]
path = "api"
configurations = ["nextjs"]
[[scope]]
path = "web"
configurations = ["nextjs"]
[[ignore]]
check = "nextjs/tsc"
paths = ${JSON.stringify(paths)}
reason = "The API check is provided by its own native build pipeline."
`,
            'api/app/page.tsx': 'export default function Page() { return null; }',
            'web/app/page.tsx': 'export default function Page() { return null; }',
        });
        const session = await openSession(sandbox.path);
        const planned = planRun(session, { stage: 'all', only: ['nextjs/tsc', 'typescript/tsc'] });
        const scopes = planned.filter((check) => ['api', 'web'].includes(check.scope.scope.path));
        const outcomes = new Map(
            scopes.map((check) => [`${check.scope.scope.path}:${check.check.name}`, check.skip?.cause]),
        );
        expect(outcomes).toStrictEqual(
            new Map([
                ['api:nextjs/tsc', ignored ? 'ignore' : undefined],
                ['api:typescript/tsc', ignored ? undefined : 'replaced'],
                ['web:nextjs/tsc', undefined],
                ['web:typescript/tsc', 'replaced'],
            ]),
        );
    },
);

test.each([...LEVELS])(
    '%s selects general checks from a stored empty manual list without changing settings',
    async (level) => {
        const settings = settingsText([], { level });
        await using sandbox = await testdir({
            'gspot.toml': settings,
            'source.js': 'export const port = 8080;\n',
            'guide.md': `# Schedule

Release on 03/04/2026.
`,
            'app/package.json': '{"name":"app","private":true}',
            'app/source.js': 'export const port = 3000;\n',
        });
        commitAll(sandbox.path);
        const session = await openSession(sandbox.path);
        expect(session.settingsFile.settings.configurations).toStrictEqual([]);
        const selected = session.scopes.flatMap((scope) =>
            scope.selected.map((manifest) => manifest.configuration.name),
        );
        for (const configuration of [...ALWAYS_SELECTED, 'licenses']) expect(selected).toContain(configuration);
        expect(selected).not.toContain('javascript');
        expect(selected).not.toContain('markdown');
        const checks = planRun(session, {
            stage: 'all',
            only: ['security/semgrep', 'prose/vale', 'duplication/jscpd', 'licenses/allowed'],
        });
        const security = checks.find((check) => check.check.name === 'security/semgrep');
        expect(security).toBeDefined();
        expect(security?.files).toStrictEqual([]);
        expect(security?.skip).toStrictEqual(
            hasToolBuild('semgrep') ? undefined : { cause: 'platform', note: 'semgrep has no Windows build' },
        );
        expect(await semgrep(session, security!)).toMatchObject({
            status: 'skipped',
            note: 'No selected configuration or tools.semgrep.rule_files supplies local rules.',
        });
        expect(checks.find((check) => check.check.name === 'prose/vale')?.files.map((file) => file.path)).toContain(
            'guide.md',
        );
        expect(checks.some((check) => check.check.name === 'duplication/jscpd')).toBe(level === 'all');
        expect(checks.find((check) => check.check.name === 'licenses/allowed')?.skip).toBeUndefined();
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(settings);
    },
);

test('a check ignored on all its paths leaves the plan, the needed tools, and its generated files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': FORMAT_SETTINGS, 'sample.json': '{"value":1}\n' });
    const initial = await openSession(sandbox.path);
    using log = openWriter(initial.root);
    writeGeneratedFiles(initial, emitAll(initial), log);
    expect(await pathExists(join(sandbox.path, '.prettierignore'))).toBe(true);
    expect(await pathExists(join(sandbox.path, '.gspot/config/prettier.json'))).toBe(true);
    await writeFile(join(sandbox.path, 'gspot.toml'), FORMAT_SETTINGS + PRETTIER_PATH_IGNORE);
    const excluded = await openSession(sandbox.path);
    const plans = planRun(excluded, { stage: 'commit', only: ['format/prettier'] });
    expect(plans[0]?.skip?.cause).toBe('ignore');
    expect(configuredChecks(excluded).map((check) => check.check.name)).not.toContain('format/prettier');
    expect(excluded.neededToolManifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name))).not.toContain(
        'prettier',
    );
    const generated = emitAll(excluded);
    expect(generated.files.map((file) => file.path)).not.toContain('.gspot/config/prettier.json');
    const removed = writeGeneratedFiles(excluded, generated, log);
    expect(removed.removed).toContain('.prettierignore');
    expect(await pathExists(join(sandbox.path, '.prettierignore'))).toBe(false);
    const settled = await openSession(sandbox.path);
    expect(configuredChecks(settled).map((check) => check.check.name)).not.toContain('format/prettier');
    const repeated = writeGeneratedFiles(settled, emitAll(settled), log);
    expect(repeated.written).toStrictEqual([]);
    expect(repeated.removed).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(FORMAT_SETTINGS + PRETTIER_PATH_IGNORE);
    expect(await readFile(join(sandbox.path, 'sample.json'), 'utf8')).toBe('{"value":1}\n');
});

test.each([...LEVELS])('%s plans history checks once at the root and only for pushed commits', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['commits', 'secrets'], { level, tables: HISTORY_TABLES }),
        'source.txt': 'Root source.\n',
        'app/source.txt': 'Child source.\n',
    });
    gitOutput(sandbox.path, ['init']);
    const opened = await openSession(sandbox.path);
    const manifest = {
        ...buildManifest('sandbox', {
            group: 'general',
            tables: HISTORY_MANIFEST.replace(/^\s*\[configuration\][\s\S]*?(?=\n\[|$)/u, ''),
        }),
        tools: [],
    };
    const session = {
        ...opened,
        scopes: opened.scopes.map((scope) => ({ ...scope, selected: [...scope.selected, manifest] })),
    };
    const names = [
        ...(level === 'all' ? ['commits/commitlint-pushed'] : []),
        'secrets/gitleaks-pushed',
        'secrets/trufflehog',
        'sandbox/pushed',
    ];
    const planned = planRun(session, {
        stage: 'push',
        only: [...names, 'sandbox/once'],
        staged: [],
        commits: ['selected'],
    });
    expect(planned.filter((check) => check.check.runs === 'history').map((check) => check.check.name)).toStrictEqual(
        names,
    );
    expect(planned.map((check) => check.scope.scope.path)).toStrictEqual([...names.map(() => ''), '']);
    expect(planned.map((check) => isActive(check))).toStrictEqual([...names.map(() => true), false]);
    expect(
        planRun(session, { stage: 'push', only: names, staged: [], commits: [] }).map((check) => isActive(check)),
    ).toStrictEqual(names.map(() => false));
    expect(() => planRun(session, { stage: 'push', only: ['sandbox/pushed'], historyComplete: false })).toThrow(
        'Pushed history is incomplete for sandbox/pushed',
    );
    expect(planRun(session, { stage: 'push', only: ['sandbox/once'], historyComplete: false })).toHaveLength(1);
});

test('Xcode plutil and general xmllint checks select their Apple and XML files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "recommended"
configurations = []
[[scope]]
path = "api"
configurations = ["xcode"]
`,
        'root.plist': '<plist><dict/></plist>\n',
        'api/app.plist': '<plist><dict/></plist>\n',
        'api/app.storyboard': '<document/>\n',
        'api/data.xml': '<document/>\n',
    });
    const session = await openSession(sandbox.path);
    const checks = planRun(session, {
        stage: 'all',
        only: ['xcode/plutil', 'files/xmllint'],
    });
    expect(
        checks
            .filter(({ files }) => files.length > 0)
            .map(({ check, files }) => [check.name, files.map(({ path }) => path)]),
    ).toStrictEqual([
        ['files/xmllint', ['api/app.storyboard', 'api/data.xml']],
        ['xcode/plutil', ['api/app.plist']],
    ]);
});

test('Expo Doctor is planned only in the scope that selects Expo', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': MOBILE_SETTINGS,
        'bare/package.json': JSON.stringify({
            private: true,
            dependencies: { react: testsPackage.devDependencies.react, ...REACT_NATIVE_DEPENDENCIES },
        }),
        'expo-app/package.json': JSON.stringify({
            private: true,
            dependencies: { react: testsPackage.devDependencies.react, ...EXPO_DEPENDENCIES },
        }),
        'bare/source.js': 'const { EXPO_PUBLIC_URL } = process.env;\n',
        'expo-app/source.js': 'const { EXPO_PUBLIC_URL } = process.env;\n',
    });
    const session = await openSession(sandbox.path);
    expect(
        configuredChecks(session)
            .filter((check) => check.check.name === 'expo/doctor')
            .map((check) => check.scope.scope.path),
    ).toStrictEqual(['expo-app']);
});

test.each([...TOOL_FILE_PLANNING_CASES])('$name', async ({ files, check, selected }) => {
    await using sandbox = await testdir(files);
    const session = await openSession(sandbox.path);
    expect(configuredChecks(session).some((entry) => entry.check.name === check)).toBe(selected);
});
