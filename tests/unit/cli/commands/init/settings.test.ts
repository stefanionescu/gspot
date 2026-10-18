import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readGitOutput } from '#tests/setup/git.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import type { InitJson } from '#cli/types/commands/init.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { BUILD_SETTINGS_PBXPROJ } from '#tests/data/checks/xcode.ts';
import { LINT_JOBS, SDK_DESTINATIONS, CI_PREFERENCE_CASES, TEMPLATE_SWIFT_CHOICES } from '#tests/data/commands/init.ts';

test.each([...CI_PREFERENCE_CASES])(
    'init proposes the CI provider from %s',
    async (_label, ci, path, remote, expected) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, Object.fromEntries(ci.map((file) => [file, '{}\n'])));
        readGitOutput(sandbox.path, ['init', '-q']);
        if (ci.length > 0) readGitOutput(sandbox.path, ['add', '--', ...ci]);
        if (path !== '') await createFileTree(sandbox.path, { [path]: '{}\n' });
        readGitOutput(sandbox.path, ['config', 'remote.origin.url', remote]);
        const result = await runGspot(sandbox.path, [...buildInitArguments([], { json: true }), '--dry-run']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
        if (expected === 'none') expect(parse(output.settings)).not.toHaveProperty('ci');
        else
            expect(parseSettings(output.settings, undefined, createReadCache(process.cwd())).ci).toMatchObject({
                enabled: true,
                provider: expected,
            });
    },
);

test('the gspot.toml text keeps root and scope configurations', async () => {
    await using sandbox = await testdir({
        'package.json': '{"name":"root","private":true,"workspaces":["apps/*"]}',
        'source.ts': 'export const root = true;\n',
        'apps/site/package.json': '{"name":"site","private":true}',
        'apps/site/source.py': 'VALUE = 1\n',
    });
    const result = await runGspot(sandbox.path, [...buildInitArguments(['typescript'], { json: true }), '--dry-run']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { settings: text } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
    const settings = parseSettings(text, undefined, createReadCache(process.cwd()));
    expect(settings.configurations).toContain('typescript');
    expect(settings.scopes['apps/site']?.configurations).toContain('python');
    expect(await Bun.file(`${sandbox.path}/gspot.toml`).exists()).toBe(false);
});

test('init keeps the commit settings of a template', async () => {
    await using sandbox = await testdir({
        'api/package.json': '{"name":"api","private":true}',
        'api/source.py': 'VALUE = 1\n',
        'team.template.toml': stringify({
            configurations: ['python', 'commits'],
            tools: { commitlint: { types: ['project'], scopes: ['team'] } },
            architecture: { roles: { environment_readers: ['tests/env.sh'] } },
        }),
    });
    const result = await runGspot(sandbox.path, ['init', '--from', 'team.template.toml', '--dry-run', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
    const settings = parseSettings(output.settings, undefined, createReadCache(process.cwd()));
    expect(settings.tools['commitlint']?.['types']).toStrictEqual(['project']);
    expect(settings.tools['commitlint']?.['scopes']).toStrictEqual(['team']);
    expect(parse(output.settings)).toMatchObject({
        architecture: { roles: { environment_readers: ['tests/env.sh'] } },
    });
});

test('initialization honors disabled template integrations and preserves format settings', async () => {
    await using sandbox = await testdir({
        'format.template.toml': stringify({
            configurations: ['format'],
            hooks: { enabled: false },
            ci: { enabled: false, provider: 'github' },
            rules: { enabled: false },
            format: { indent_width: 2 },
        }),
    });
    const result = await runGspot(sandbox.path, ['init', '--from', 'format.template.toml', '--dry-run', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
    const document: unknown = parse(output.settings);
    expect(document).toMatchObject({ format: { indent_width: 2 }, rules: { enabled: false } });
    expect(document).not.toHaveProperty('hooks');
    expect(document).not.toHaveProperty('ci');
});

test('a template keeps its comments and gspot.toml records which template it copied', async () => {
    await using sandbox = await testdir({
        'team.template.toml': `# Rule owner
[rules]
exclude = [".gspot/rules/general/engineering/code/ACCESSIBILITY.md"]
`,
    });
    const result = await runGspot(sandbox.path, ['init', '--from', 'team.template.toml', '--dry-run', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings' | 'plan'>>;
    expect(output.settings).toContain(
        `# Copied from template team.template.toml, sha256 ${output.plan.template!.digest}.`,
    );
    expect(output.settings).toContain('# Rule owner\n[rules]');
    expect(parse(output.settings)).toMatchObject({
        rules: { exclude: ['.gspot/rules/general/engineering/code/ACCESSIBILITY.md'] },
    });
    expect(parseSettings(output.settings, undefined, createReadCache(process.cwd())).rules.enabled).toBe(true);
});

test.each([...SDK_DESTINATIONS])('init picks the Xcode destination for SDK $sdk', async ({ sdk, destination }) => {
    const source = BUILD_SETTINGS_PBXPROJ.replace('SDKROOT=macosx', `SDKROOT=${sdk}`);
    await using sandbox = await testdir({ 'App.xcodeproj/project.pbxproj': source });
    const result = await runGspot(sandbox.path, [
        ...buildInitArguments(['swift', 'xcode'], { json: true }),
        '--dry-run',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
    expect(parse(output.settings)).toMatchObject({ swift: { xcode_destination: destination } });
    expect(await Bun.file(`${sandbox.path}/App.xcodeproj/project.pbxproj`).text()).toBe(source);
});

test.each([...TEMPLATE_SWIFT_CHOICES])(
    'the template $name wins over the SDK of the Xcode project',
    async ({ swift, destination }) => {
        await using sandbox = await testdir({
            'Unused.xcodeproj/project.pbxproj': 'not native plist syntax',
            'Chosen.xcodeproj/project.pbxproj': BUILD_SETTINGS_PBXPROJ,
            'swift.template.toml': stringify({ configurations: ['swift', 'xcode'], swift }),
        });
        const result = await runGspot(sandbox.path, ['init', '--from', 'swift.template.toml', '--dry-run', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
        expect(parse(output.settings)).toMatchObject({
            swift: { xcode_project: swift.xcode_project, xcode_destination: destination },
        });
        expect(await Bun.file(`${sandbox.path}/Unused.xcodeproj/project.pbxproj`).text()).toBe(
            'not native plist syntax',
        );
    },
);

test.each([...LINT_JOBS])(
    'a lint job in $name means init asks no CI question and proposes no CI',
    async ({ path, content }) => {
        await using sandbox = await testdir({ [path]: content });
        const result = await runGspot(sandbox.path, [...buildInitArguments([], { json: true }), '--dry-run']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
        expect(parse(output.settings)).not.toHaveProperty('ci');
    },
);
