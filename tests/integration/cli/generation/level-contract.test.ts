import { join } from 'node:path';
import type { Linter } from 'eslint';
import plugin from '#plugin/plugin.ts';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { RUFF_PREVIEW_RULES } from '#cli/config/checks/python.ts';
import { generatedFile } from '#tests/support/cli/generated/files.ts';
import { generatedEslint } from '#tests/support/cli/generated/eslint.ts';
import { parsePolicyText, assertPolicyComplete } from '#cli/policy/read.ts';

const review = readFileSync(new URL('../../../../architecture/levels/inventory.csv', import.meta.url), 'utf8');

test('the accepted inventory assigns every check and public plugin rule', () => {
    const checks = new Map(
        [...kitManifests().values()].flatMap((manifest) =>
            manifest.checks.map((check) => [check.name, check.level] as const),
        ),
    );
    const rows = review
        .split('\n')
        .filter((row) => row.startsWith('Check,'))
        .map((row) => row.split(','));
    expect(checks.size).toBe(211);
    expect(rows).toHaveLength(211);
    expect(rows.filter((row) => row[2] === 'recommended')).toHaveLength(144);
    for (const row of rows) expect(String(checks.get(row[1]!))).toBe(row[2]!);
    const rules = Object.entries(plugin.rules);
    expect(rules).toHaveLength(25);
    expect(
        rules
            .filter(([, rule]) => rule.meta.docs?.level === 'recommended')
            .map(([name]) => name)
            .toSorted((a, b) => a.localeCompare(b)),
    ).toStrictEqual(['no-client-environment', 'no-duplicate-barrel-exports', 'require-server-only']);
    expect(plugin.configs.recommended.rules).not.toHaveProperty('gspot/require-server-only');
});

test.each(['recommended', 'all'] as const)(
    '%s resolves defaults and scoped project overrides consistently',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(
                ['python', 'pytest'],
                '[[scope]]\npath = "app"\nkits = []\n[scope.tools.pytest]\ncoverage = 91\n[scope.tools.vulture]\nmin_confidence = 95\n',
                level,
            ),
            'app/main.py': 'value = 1\n',
        });
        const session = await openSession(sandbox.path);
        const root = session.scopes.find((scope) => scope.scope.path === '')!;
        const nested = session.scopes.find((scope) => scope.scope.path === 'app')!;
        expect(root.view.settings['tools.pytest.coverage']).toBe(level === 'all' ? 80 : 0);
        expect(root.view.settings['tools.vulture.min_confidence']).toBe(level === 'all' ? 80 : 100);
        expect(nested.view.settings['tools.pytest.coverage']).toBe(91);
        expect(nested.view.settings['tools.vulture.min_confidence']).toBe(95);
    },
);

test.each(['recommended', 'all'] as const)('%s Ruff selects stable rules with preview disabled', async (level) => {
    const text = await generatedFile(policyOf(['python', 'fastapi', 'pytest'], '', level), '.gspot/config/ruff.toml');
    const config = parseToml(text) as { lint: { select: string[]; preview: boolean }; format: { preview: boolean } };
    expect(config.lint.preview).toBe(false);
    expect(config.format.preview).toBe(false);
    expect(config.lint.select.filter((code) => RUFF_PREVIEW_RULES.has(code))).toStrictEqual([]);
    expect(config.lint.select).toContain('F821');
    expect(config.lint.select.includes('N802')).toBe(level === 'all');
});

test.each(['recommended', 'all'] as const)('%s rejects experimental activation before generation', (level) => {
    for (const settings of [
        '[tools.ruff.extra]\npreview = true\nreason = "Project preference"',
        `[tools.ruff]\nselect = ["${String([...RUFF_PREVIEW_RULES][0])}"]`,
    ]) {
        const text = policyOf(['python'], settings, level);
        expect(() => {
            assertPolicyComplete({ policy: parsePolicyText(text, 'gspot.toml'), text, path: 'gspot.toml' });
        }).toThrow('preview');
    }
});

test.each(['recommended', 'all'] as const)(
    '%s keeps scoped framework rules and syntax selectors inside their project',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['javascript'], '[[scope]]\npath = "app"\nkits = ["react", "drizzle"]\n', level),
            'package.json': '{"private":true,"type":"module"}',
            'root.jsx': '',
            'app/client.jsx': '',
        });
        const eslint = await generatedEslint(sandbox.path);
        const outside = (await eslint.calculateConfigForFile(join(sandbox.path, 'root.jsx'))) as Linter.Config;
        const inside = (await eslint.calculateConfigForFile(join(sandbox.path, 'app/client.jsx'))) as Linter.Config;
        expect(outside.rules?.['react/jsx-key']).toBeUndefined();
        expect((inside.rules?.['react/jsx-key'] as unknown[])[0]).toBe(2);
        const raw = 'export const query = sql`select 1`;';
        const insideResults = await eslint.lintText(raw, { filePath: 'app/client.jsx' });
        const messages = insideResults.flatMap((file) => file.messages);
        expect(messages.some((finding) => finding.ruleId === 'no-restricted-syntax')).toBe(level === 'all');
        const outsideResults = await eslint.lintText(raw, { filePath: 'root.jsx' });
        expect(
            outsideResults
                .flatMap((file) => file.messages)
                .filter((finding) => finding.ruleId === 'no-restricted-syntax'),
        ).toStrictEqual([]);
    },
);

test('all retains the effective recommended rules for the same applicable React file', async () => {
    const rules: Record<string, Record<string, unknown>> = {};
    for (const level of ['recommended', 'all']) {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['react'], '', level),
            'package.json': '{"private":true,"type":"module"}',
            'client.jsx': '',
        });
        const eslint = await generatedEslint(sandbox.path);
        const config = (await eslint.calculateConfigForFile('client.jsx')) as Linter.Config;
        rules[level] = config.rules!;
    }
    const active = Object.entries(rules['recommended']!).filter(([, value]) => Array.isArray(value) && value[0] !== 0);
    for (const [name] of active) expect((rules['all']![name] as unknown[])[0], name).not.toBe(0);
});

test('switching levels restores generated defaults and agent instructions', async () => {
    await using sandbox = await testdir();
    const outputs: string[] = [];
    for (const level of ['recommended', 'all', 'recommended']) {
        const policy = policyOf(['javascript'], '', level);
        await Bun.write(join(sandbox.path, 'gspot.toml'), policy);
        const session = await openSession(sandbox.path);
        const output = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageClient: session.packageClient,
        });
        const config = output.files.find((file) => file.path.endsWith('/eslint.config.mjs'))!;
        await Bun.write(join(sandbox.path, config.path), config.content);
        const block = output.blocks.find((block) => block.path === 'AGENTS.md')!.block;
        expect(block).toContain(`Selected level: \`${level}\``);
        expect(block).toContain('apply only at all or when the project explicitly opts into them');
        outputs.push(config.content);
    }
    expect(outputs[0]).not.toBe(outputs[1]);
    expect(outputs[2]).toBe(outputs[0]);
});
