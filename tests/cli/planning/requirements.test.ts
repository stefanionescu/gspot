import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { planRun, applicableManifests } from '#cli/planning/public.ts';
import { NODE_REQUIREMENTS } from '#tests/config/cli/planning/requirements.ts';

test('a check version prerequisite cannot lower its tool-wide requirement', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python']),
        'source.py': 'print("example")\n',
    });
    const session = await openSession(sandbox.path);
    const ruff = session.manifests.get('python')!.checks.find((check) => check.name === 'python/ruff')!;
    const tool = toolPin(session.manifests.values(), 'ruff');
    for (const required of ['0.0.0', tool.version!]) {
        ruff.min_versions = { ruff: required };
        const [planned] = planRun(session, { stage: 'all', skips: [], only: ['python/ruff'] });
        expect(planned?.tool?.min_version).toBe(required === '0.0.0' ? tool.min_version : required);
    }
});

test.each(['recommended', 'all'] as const)(
    '%s reports manual security project prerequisites explicitly',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['security'], { level }),
            'source.js': 'export const port = 8080;\n',
        });
        const checks = planRun(await openSession(sandbox.path), {
            stage: 'all',
            skips: [],
            includeUnsupported: true,
            only: ['security/semgrep-registry', 'security/codeql'],
        });
        expect(
            checks.map((check) => ({ check: check.check.name, cause: check.skip?.cause, note: check.skip?.note })),
        ).toStrictEqual([
            {
                check: 'security/semgrep-registry',
                cause: undefined,
                note: undefined,
            },
            {
                check: 'security/codeql',
                cause: 'setting',
                note: 'requires project setting tools.codeql.languages',
            },
        ]);
    },
);

test.each(NODE_REQUIREMENTS)(
    'applicable tools declare Node only when npm consumers require it: $name',
    async ({ configurations, runner, files, node }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(configurations, { tables: `runner = "${runner}"\n` }),
            ...files,
        });
        const session = await openSession(sandbox.path);
        const names = applicableManifests(session).flatMap((manifest) => manifest.tools.map((tool) => tool.name));
        expect(names.includes('node')).toBe(node);
        if (configurations.includes('typescript')) {
            expect(names).toContain('eslint');
        } else if (configurations.includes('markdown')) {
            expect(names).toContain('markdownlint-cli2');
        } else {
            expect(names).toContain('ruff');
            expect(names).not.toContain('eslint');
            expect(names).not.toContain('typescript');
        }
    },
);

test.each(['bun', 'mise'])('private schema tools include their runtime peer under %s', async (runner) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['files'], { tables: `runner = "${runner}"\n` }),
        'settings.json': '{"enabled":true}\n',
    });
    const session = await openSession(sandbox.path);
    const names = applicableManifests(session).flatMap((manifest) => manifest.tools.map((tool) => tool.name));
    expect(names).toContain('v8r');
    expect(names.includes('ajv')).toBe(runner === 'bun');
});
