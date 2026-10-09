// What init selects: a recommended configuration only when the repository holds what it detects, and the proposed scopes.
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import { policySchema } from '#cli/policy/schema/public.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { applicableManifests } from '#cli/planning/public.ts';
import { parseTomlText } from '#cli/policy/document/public.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { toolProjectPins } from '#cli/configurations/contracts.ts';
import { parseToolProject } from '#cli/parsers/packages/contracts.ts';
import { readTree, pathExists } from '#tests/harness/preservation.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { readPolicyTable, parseStrictPolicy } from '#cli/policy/public.ts';
import { COMPONENT, SELECTION_INIT } from '#tests/config/cli/commands/init/selection.ts';

test('accepting defaults leaves the detected initialization plan unchanged', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        'source.js': 'export const port = 8080;\n',
        'api/pyproject.toml': '[project]\nname = "api"\nversion = "1.0.0"\n',
        'api/source.py': 'PORT = 8080\n',
    });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const argv = ['init', '--dry-run', ...QUIET_INIT];
    const selected = await runGspot(sandbox.path, argv);
    const accepted = await runGspot(sandbox.path, [...argv, '--yes']);
    for (const result of [selected, accepted]) {
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toContain('\nconfigurations\n');
        expect(result.stdout).toMatch(/^ {2}licenses\s+detected\s/mu);
        expect(result.stdout).toMatch(/^ {2}security\s+detected\s/mu);
        expect(result.stdout).toMatch(/^ {2}duplication\s+detected\s/mu);
    }
    expect(selected.stdout.slice(selected.stdout.indexOf('\nconfigurations\n'))).toBe(
        accepted.stdout.slice(accepted.stdout.indexOf('\nconfigurations\n')),
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('initialization identifies a scope flag without attributing it to an absent policy', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'jobs/run.sh': 'echo example\n' });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [
        'init',
        '--yes',
        '--dry-run',
        '--scope-configurations',
        'jobs=bash',
        ...QUIET_INIT,
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toMatch(/^scopes\s+jobs\s+from --scope-configurations$/mu);
    expect(result.stdout).not.toContain('from gspot.toml');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

async function selected(root: string): Promise<string[]> {
    const result = await runGspot(root, [...SELECTION_INIT, ...QUIET_INIT]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const plan = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    return plan.plan.configurations.map((entry) => entry.configuration);
}

test('init selects a recommended language only when the repository holds its files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"example","private":true,"type":"module","dependencies":{"vue":"3.5.22"}}\n',
        'src/Greeting.vue': COMPONENT,
    });
    commitAll(sandbox.path);
    const plain = await selected(sandbox.path);
    expect(plain).toContain('vue');
    expect(plain).toContain('javascript');
    expect(plain).toContain('format');
    expect(plain).not.toContain('typescript');
    expect(plain).toContain('css');
    await createFileTree(sandbox.path, {
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
        'src/styles.css': 'p {\n    color: #abc;\n}\n',
    });
    commitAll(sandbox.path);
    const typed = await selected(sandbox.path);
    expect(typed).toContain('typescript');
    expect(typed).toContain('css');
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).exists()).toBe(false);
});

test('init proposes a project scope without --scope-configurations and sets lint-only packages aside', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"app","private":true,"type":"module"}\n',
        'supabase/config.toml': 'project_id = "example"\n',
        'ios/Package.swift':
            '// swift-tools-version:6.0\nimport PackageDescription\nlet package = Package(name: "App")\n',
        'ios/Sources/App/App.swift': 'let answer = 42\n',
        'tools/lint/package.json': '{"name":"lint","private":true,"devDependencies":{"eslint":"9.39.5"}}\n',
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, [...SELECTION_INIT, ...QUIET_INIT]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'policy' | 'plan'>>;
    const proposed = policySchema.parse(parse(output.policy));
    expect(Object.keys(proposed.scope!)).toStrictEqual(['ios']);
    expect(proposed.scope?.['ios']?.configurations).toContain('swift');
    expect(output.plan.noLongerRuns.map((entry) => entry.path)).toStrictEqual(['tools/lint/package.json']);
});

test.each([
    { dependency: false, named: false, isSelected: false },
    { dependency: true, named: false, isSelected: false },
    { dependency: false, named: true, isSelected: true },
])('Explicit Next.js choices override locale dependency detection: %j', async ({ dependency, named, isSelected }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': JSON.stringify({
            name: 'translated-app',
            private: true,
            dependencies: { next: '16.3.5', ...(dependency ? { 'next-intl': '4.3.9' } : {}) },
        }),
        'app/page.tsx': 'export default function Page() { return "home"; }\n',
    });
    const configurations = ['--configurations', 'nextjs', ...(named ? ['translations'] : [])];
    const result = await runGspot(sandbox.path, [...SELECTION_INIT, ...configurations, ...QUIET_INIT]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.configurations.some(({ configuration }) => configuration === 'translations')).toBe(isSelected);
});

test('init proposes workspace scopes without a lockfile and preserves files after resolver failure', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"private":true,"packageManager":"pnpm@9.0.0","workspaces":["packages/*"]}',
        'packages/api/package.json': '{"name":"api"}',
        'packages/api/source.js': 'export const port = 8080;\n',
    });
    const command = ['init', '--yes', ...QUIET_INIT];
    const proposed = await runGspot(sandbox.path, [...command, '--dry-run', '--json']);
    expect(proposed.code, proposed.stdout + proposed.stderr).toBe(0);
    const plan = JSON.parse(proposed.stdout) as Required<Pick<InitJson, 'policy'>>;
    const policy = parseStrictPolicy(plan.policy);
    expect(Object.keys(policy.scope)).toStrictEqual(['packages/api']);
    await writeFile(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: [');
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('end with a ]');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init previews only applicable tool projects and duplicate pins for the selected runner', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.py': 'print("hello")\n',
        'mise.toml': '[tools]\nruff = "0.9.0"\nvale = "3.0.0"\n',
    });
    const result = await runGspot(sandbox.path, [...SELECTION_INIT, '--configurations', 'python', ...QUIET_INIT]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan, policy } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan' | 'policy'>>;
    const selected = applicableManifests(
        await openSession(sandbox.path, {
            ...readPolicyTable(parseTomlText(policy, 'gspot.toml', 'policy'), sandbox.path),
            path: join(sandbox.path, 'gspot.toml'),
            text: policy,
        }),
    );
    const packages = toolProjectPins(selected).npm;
    expect(plan.change).toContainEqual({
        path: '.gspot/pyproject.toml',
        note: `${String(toolProjectPins(selected).python.length)} pinned Python tools; matching uv.lock and tool environment`,
    });
    expect(plan.change).toContainEqual({
        path: '.gspot/package.json',
        note: `${String(Object.keys(packages).length)} pinned npm tools; matching lockfile`,
    });
    expect(plan.noLongerRuns).toStrictEqual([
        { path: 'mise.toml', note: '1 pin gspot also pins (gspot doctor lists them)' },
    ]);
    const written = await runGspot(sandbox.path, [
        'init',
        '--yes',
        '--json',
        '--configurations',
        'python',
        ...QUIET_INIT,
    ]);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    const installed = parseToolProject(await Bun.file(join(sandbox.path, '.gspot/package.json')).text());
    expect(Object.keys(installed.dependencies)).toStrictEqual(Object.keys(packages));
});

test.each(['recommended', 'all'] as const)('init counts active and disabled checks at %s', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.py': 'VALUE = 1\n',
        'team.template.toml': `template = "team"\nselection = "exact"\nlevel = "${level}"\nconfigurations = ["python"]\n`,
    });
    const before = await readTree(sandbox.path);
    const command = ['init', '--yes', '--from', 'team.template.toml', '--dry-run', ...QUIET_INIT];
    const result = await runGspot(sandbox.path, [...command, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    const total = configurationManifests().get('python')!.checks;
    const off = level === 'all' ? 0 : total.filter((check) => check.level === 'all').length;
    expect(plan.level).toBe(level);
    expect(plan.configurations.find((row) => row.configuration === 'python')).toMatchObject({
        checks: total.length - off,
        checksOff: off,
    });
    const text = await runGspot(sandbox.path, command);
    expect(text.code, text.stdout + text.stderr).toBe(0);
    expect(text.stdout).toContain(`${String(total.length - off)} checks (${String(off)} off at ${level})`);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('a named configuration brings its suggested configurations, and one --scope-configurations flag proposes both scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'tools/a.sh': CLEAN_BASH_SCRIPT, 'jobs/b.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const preview = [...SELECTION_INIT, ...QUIET_INIT];
    const named = await runGspot(sandbox.path, [...preview, '--configurations', 'bash']);
    expect(named.code, named.stdout + named.stderr).toBe(0);
    const { plan } = JSON.parse(named.stdout) as Required<Pick<InitJson, 'plan'>>;
    const configurations = plan.configurations.map(({ configuration }) => configuration);
    for (const configuration of ['bash', 'format', 'naming']) expect(configurations).toContain(configuration);
    const twoScopes = await runGspot(sandbox.path, [...preview, '--scope-configurations', 'tools=bash', 'jobs=bash']);
    expect(twoScopes.code, twoScopes.stdout + twoScopes.stderr).toBe(0);
    const parsed = parseStrictPolicy((JSON.parse(twoScopes.stdout) as Required<Pick<InitJson, 'policy'>>).policy);
    expect(parsed.scope['tools']?.configurations).toContain('bash');
    expect(parsed.scope['jobs']?.configurations).toContain('bash');
});

test('initialization flags control integrations without changing the authored formatter file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.js': 'export const port = 8080;\n',
        '.prettierrc.json': '{"semi":false,"tabWidth":8}\n',
    });
    const preview = await runGspot(sandbox.path, [...SELECTION_INIT, ...QUIET_INIT, '--configurations', 'javascript']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const plan = JSON.parse(preview.stdout) as Required<Pick<InitJson, 'policy' | 'plan'>>;
    const policy = parseStrictPolicy(plan.policy);
    expect(policy).not.toHaveProperty('hooks');
    expect(policy).not.toHaveProperty('ci');
    expect(policy).not.toHaveProperty('runner');
    expect(policy.format).toStrictEqual({});
    expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(false);
    expect(await Bun.file(join(sandbox.path, '.prettierrc.json')).text()).toBe('{"semi":false,"tabWidth":8}\n');
});

test.each(['mise', 'bun', 'npm', 'pnpm', 'yarn'] as const)(
    'an explicit %s runner is selected without a prompt or tool installation',
    async (runner) => {
        await using sandbox = await testdir();
        const original = await readTree(sandbox.path);
        const result = await runGspot(sandbox.path, [
            'init',
            '--yes',
            '--dry-run',
            '--json',
            '--configurations',
            'none',
            '--runner',
            runner,
            ...QUIET_INIT.filter((argument) => argument !== '--no-runner'),
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const report = JSON.parse(result.stdout) as Required<Pick<InitJson, 'policy' | 'plan'>>;
        expect(parseStrictPolicy(report.policy).runner).toBe(runner);
        expect(await readTree(sandbox.path)).toStrictEqual(original);
    },
);
