import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { openWriter } from '#cli/ownership/writer.ts';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { generate } from '#cli/generation/generate.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { matchSubstring } from '#tests/setup/matchers.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { checkSecuritySemgrep } from '#cli/checks/security.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { HISTORY_TABLES, TOOL_FILE_PLANNING_CASES } from '#tests/data/runs/plan.ts';
import { FORMAT_SETTINGS, PRETTIER_PATH_IGNORE } from '#tests/data/checks/format.ts';
import { isActive, planChecks, stripCoverageArguments } from '#cli/planning/checks.ts';
import { buildRunOptions, listAlwaysSelected, buildProcessResult } from '#tests/setup/builders.ts';

test('coverage arguments leave other commands, your own checks, and given arguments unchanged', async () => {
    await using sandbox = await testdir();
    const command = [process.execPath, '--coverage', '', 'two words'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [{ name: 'project/tests', command, stage: 'push', paths: ['sample.test.cjs'] }],
            }),
        }),
        'sample.test.cjs': 'const authored = true;\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'push', only: ['project/tests'] })[0]!;
    using run = spyOn(processes, 'spawnProcess');
    run.mockImplementation((commandArguments) => {
        expect(commandArguments).toStrictEqual(command);
        return Promise.resolve(buildProcessResult({ code: 0, missing: false, stdout: '', stderr: '', duration: 1 }));
    });
    const authored = await runCheckCommand(session, planned);
    const supplied = await runCheckCommand(session, planned, { command });
    expect(authored.status).toBe('passed');
    expect(supplied.status).toBe('passed');
    expect(stripCoverageArguments(planned, { command: ['echo', '', 'two words'] })).toStrictEqual([
        'echo',
        '',
        'two words',
    ]);
});

test('a project check without its own inputs is inactive even when its scope holds another language', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python', 'bash']),
        'source.sh': 'echo example\n',
    });

    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ only: ['python/ruff'] });
    const planned = planChecks(session, options);
    expect(planned.every((entry) => entry.files.length === 0)).toBe(true);
    const result = await runChecks(session, options);
    expect(result.report.exitCode).toBe(0);
    expect(result.report.checks).toMatchObject([
        { check: 'python/ruff', status: 'skipped', cause: 'inputs', findings: [] },
    ]);
});

test.each([
    { paths: ['api/**'], ignored: true },
    { paths: ['api'], ignored: true },
    { paths: ['api/**', '!api/app/**'], ignored: false },
])(
    'an ignore of a whole scope keeps the replaced check running there and nowhere else: %j',
    async ({ paths, ignored }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['typescript'], {
                rules: true,
                tables: `[[scope]]
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
            }),
            'api/app/page.tsx': 'export default function Page() { return null; }',
            'web/app/page.tsx': 'export default function Page() { return null; }',
        });

        const session = await openSession(sandbox.path);
        const planned = planChecks(session, { stage: 'all', only: ['nextjs/tsc', 'typescript/tsc'] });
        const scopes = planned.filter((check) => ['api', 'web'].includes(check.selection.scope.path));
        const results = new Map(
            scopes.map((check) => [`${check.selection.scope.path}:${check.check.name}`, check.skip?.cause]),
        );
        expect(results).toStrictEqual(
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
        const settings = buildSandboxSettings([], { level });
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
        const selected = session.scopes.flatMap((scope) => scope.selected.map((configuration) => configuration.name));
        for (const configuration of [...listAlwaysSelected(), 'licenses']) expect(selected).toContain(configuration);
        expect(selected).not.toContain('javascript');
        expect(selected).not.toContain('markdown');
        const checks = planChecks(session, {
            stage: 'all',
            only: ['security/semgrep', 'prose/vale', 'duplication/jscpd', 'licenses/allowed'],
        });
        const security = checks.find((check) => check.check.name === 'security/semgrep');
        expect(security).toBeDefined();
        expect(security?.files).toStrictEqual([]);
        expect(await checkSecuritySemgrep(session, security!)).toMatchObject({
            status: 'skipped',
            note: matchSubstring('tools.semgrep.rule_files'),
        });
        expect(checks.find((check) => check.check.name === 'prose/vale')?.files.map((file) => file.path)).toContain(
            'guide.md',
        );
        expect(checks.some((check) => check.check.name === 'duplication/jscpd')).toBe(level === 'all');
        expect(checks.find((check) => check.check.name === 'licenses/allowed')?.skip).toBeUndefined();
    },
);

test('a check ignored on all its paths leaves the plan, the needed tools, and its generated files', async () => {
    await using sandbox = await testdir({ 'gspot.toml': FORMAT_SETTINGS, 'sample.json': '{"value":1}\n' });

    const initial = await openSession(sandbox.path);
    using log = openWriter(initial.root);
    writeGeneratedFiles(initial, generate(initial), log);
    expect(await isOnDisk(join(sandbox.path, '.prettierignore'))).toBe(true);
    expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/general/format/prettier.json'))).toBe(true);
    await writeFile(join(sandbox.path, 'gspot.toml'), FORMAT_SETTINGS + PRETTIER_PATH_IGNORE);
    const excluded = await openSession(sandbox.path);
    const plans = planChecks(excluded, { stage: 'commit', only: ['format/prettier'] });
    expect(plans[0]?.skip?.cause).toBe('ignore');
    expect(excluded.configuredChecks.map((check) => check.check.name)).not.toContain('format/prettier');
    expect(
        excluded.neededToolConfigurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)),
    ).not.toContain('prettier');
    const generated = generate(excluded);
    expect(generated.files.map((file) => file.path)).not.toContain(
        '.gspot/configurations/general/format/prettier.json',
    );
    const removed = writeGeneratedFiles(excluded, generated, log);
    expect(removed.removed).toContain('.prettierignore');
    expect(await isOnDisk(join(sandbox.path, '.prettierignore'))).toBe(false);
    const settled = await openSession(sandbox.path);
    expect(settled.configuredChecks.map((check) => check.check.name)).not.toContain('format/prettier');
    const repeated = writeGeneratedFiles(settled, generate(settled), log);
    expect(repeated.written).toStrictEqual([]);
    expect(repeated.removed).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(FORMAT_SETTINGS + PRETTIER_PATH_IGNORE);
    expect(await readFile(join(sandbox.path, 'sample.json'), 'utf8')).toBe('{"value":1}\n');
});

test.each([...LEVELS])('%s plans history checks once at the root and only for pushed commits', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['commits', 'secrets'], {
            level,
            tables: `${HISTORY_TABLES}
[[command_check]]
name = "sandbox/once"
command = ["git", "log"]
paths = ["source.txt", "app/source.txt"]
stage = "push"
`,
        }),
        'source.txt': 'Root source.\n',
        'app/source.txt': 'Child source.\n',
    });
    readGitOutput(sandbox.path, ['init']);
    const session = await openSession(sandbox.path);
    const names = [...(level === 'all' ? ['commits/commitlint-pushed'] : []), 'secrets/gitleaks-pushed'];
    const planned = planChecks(session, {
        stage: 'push',
        only: [...names, 'sandbox/once'],
        staged: [],
        commits: ['selected'],
    });
    expect(planned.filter((check) => check.check.runs === 'history').map((check) => check.check.name)).toStrictEqual(
        names,
    );
    expect(planned.map((check) => check.selection.scope.path)).toStrictEqual([...names.map(() => ''), '']);
    expect(planned.map((check) => isActive(check))).toStrictEqual([...names.map(() => true), false]);
    expect(
        planChecks(session, { stage: 'push', only: names, staged: [], commits: [] }).map((check) => isActive(check)),
    ).toStrictEqual(names.map(() => false));
    expect(() =>
        planChecks(session, { stage: 'push', only: ['secrets/gitleaks-pushed'], historyComplete: false }),
    ).toThrow('Pushed history is incomplete for secrets/gitleaks-pushed');
    expect(planChecks(session, { stage: 'push', only: ['sandbox/once'], historyComplete: false })).toHaveLength(1);
});

test('Xcode plutil and general xmllint checks select their Apple and XML files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            level: 'recommended',
            rules: true,
            scopes: [{ path: 'api', configurations: ['xcode'] }],
        }),
        'root.plist': '<plist><dict/></plist>\n',
        'api/app.plist': '<plist><dict/></plist>\n',
        'api/app.storyboard': '<document/>\n',
        'api/data.xml': '<document/>\n',
    });

    const session = await openSession(sandbox.path);
    const checks = planChecks(session, {
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

test.each([...TOOL_FILE_PLANNING_CASES])(
    'planning $check keeps its declared tool-file selection $selected: $name',
    async ({ files, check, selected }) => {
        await using sandbox = await testdir(files);
        const session = await openSession(sandbox.path);
        expect(session.configuredChecks.some((entry) => entry.check.name === check)).toBe(selected);
    },
);
