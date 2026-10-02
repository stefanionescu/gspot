import { join } from 'node:path';
import type { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { RUFF_PREVIEW_RULES } from '#cli/config/policy/policy.ts';
import { parsePolicyText, assertPolicyComplete } from '#cli/policy/read.ts';
import { generatedFile, generatedEslint } from '#tests/harness/cli/generated.ts';

test('a scope resolves its own tool settings over the root defaults', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['python', 'pytest'],
            '[[scope]]\npath = "app"\nkits = []\n[scope.tools.pytest]\ncoverage = 91\n[scope.tools.vulture]\nmin_confidence = 95\n',
            'all',
        ),
        'app/main.py': 'value = 1\n',
    });
    const session = await openSession(sandbox.path);
    const nested = session.scopes.find((scope) => scope.scope.path === 'app')!;
    expect(nested.view.settings['tools.pytest.coverage']).toBe(91);
    expect(nested.view.settings['tools.vulture.min_confidence']).toBe(95);
});

test.each(['recommended', 'all'] as const)('%s Ruff selects stable rules with preview disabled', async (level) => {
    const text = await generatedFile(policyOf(['python', 'fastapi', 'pytest'], '', level), '.gspot/config/ruff.toml');
    const config = parseToml(text) as { lint: { select: string[]; preview: boolean }; format: { preview: boolean } };
    expect(config.lint.preview).toBe(false);
    expect(config.format.preview).toBe(false);
    expect(config.lint.select.filter((code) => RUFF_PREVIEW_RULES.has(code))).toStrictEqual([]);
    expect(config.lint.select.includes('N802')).toBe(level === 'all');
});

test('experimental activation is refused before generation', () => {
    for (const settings of [
        '[tools.ruff.extra]\npreview = true\nreason = "Project preference"',
        `[tools.ruff]\nselect = ["${String([...RUFF_PREVIEW_RULES][0])}"]`,
    ]) {
        const text = policyOf(['python'], settings, 'all');
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
        outputs.push(config.content);
    }
    expect(outputs[0]).not.toBe(outputs[1]);
    expect(outputs[2]).toBe(outputs[0]);
});
