import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { getOwnership } from '#cli/lifecycle/ownership/public.ts';
import { openSession, applyCommand } from '#cli/commands/public.ts';
import { emitAll, generatedPaths } from '#cli/generation/public.ts';
import { collectRules } from '#cli/generation/documents/contracts.ts';
import { isStray, compareRules, computeDrift } from '#cli/lifecycle/public.ts';

test('rule changes name additions, removals, and changed options across every declared path', () => {
    expect(
        compareRules(
            { rules: { first: true, second: 2 }, disabled: { old: true } },
            { rules: { second: 3, third: true }, enabled: { new: true } },
        ),
    ).toStrictEqual([
        { path: 'rules', added: ['third'], removed: ['first'], changed: ['second'] },
        { path: 'disabled', added: [], removed: ['old'], changed: [] },
        { path: 'enabled', added: ['new'], removed: [], changed: [] },
    ]);
});

test('rule collection ignores selection order while preserving record values and changed options', () => {
    const before = collectRules(['selectors', 'rules'], {
        selectors: ['first', 'second'],
        rules: [
            { id: 'first', pattern: 'eval(...)' },
            { id: 'second', pattern: 'exec(...)' },
        ],
    });
    const reordered = collectRules(['selectors', 'rules'], {
        selectors: ['second', 'first'],
        rules: [
            { id: 'second', pattern: 'exec(...)' },
            { id: 'first', pattern: 'eval(...)' },
        ],
    });
    expect(compareRules(before, reordered)).toStrictEqual([]);
    const next = collectRules(['rules'], {
        rules: [
            { id: 'first', pattern: 'other(...)' },
            { id: 'third', pattern: 'exec(...)' },
        ],
    });
    expect(compareRules(before, next)).toStrictEqual([
        { path: 'selectors', added: [], removed: ['first', 'second'], changed: [] },
        { path: 'rules', added: ['third'], removed: ['second'], changed: ['first'] },
    ]);
});

test('rule values keep false, zero, null, nested options, and significant array order', () => {
    expect(
        compareRules(
            { rules: { disabled: 0, flag: false, nullable: null, option: { first: true, second: [2, 'always'] } } },
            { rules: { disabled: 0, flag: true, nullable: false, option: { second: [2, 'never'], first: true } } },
        ),
    ).toStrictEqual([{ path: 'rules', added: [], removed: [], changed: ['flag', 'nullable', 'option'] }]);
    expect(
        compareRules({ rules: { option: { first: 1, second: 2 } } }, { rules: { option: { second: 2, first: 1 } } }),
    ).toStrictEqual([]);
});

test.each([
    { document: { rules: [{ id: 'same' }, { id: 'same' }] }, message: 'contains duplicate ID same' },
    { document: { rules: [{ pattern: 'eval(...)' }] }, message: 'must contain records with string IDs' },
    { document: { rules: 1 }, message: 'must contain a rule list or table' },
])('rule collection rejects ambiguous generator data: $message', ({ document, message: diagnostic }) => {
    expect(() => collectRules(['rules'], document)).toThrow(diagnostic);
});

test('rule collection separates native rule groups and supports absent paths without reading serialized files', () => {
    expect(
        collectRules(['*.BasedOnStyles', '*.rules', 'checks', 'skips', 'sqlfluff.exclude_rules', 'sqlfluff:rules'], {
            '*': { BasedOnStyles: ['Vale', 'Example'], rules: { 'Example.Rule': true } },
            checks: ['ssrf', 'aliastraversal'],
            skips: ['ssrf'],
            sqlfluff: { exclude_rules: ['CP01', 'LT01'] },
            'sqlfluff:rules': { 'capitalisation.keywords': { capitalisation_policy: 'upper' } },
        }),
    ).toStrictEqual({
        '*.BasedOnStyles': { Vale: true, Example: true },
        '*.rules': { 'Example.Rule': true },
        checks: { ssrf: true, aliastraversal: true },
        skips: { ssrf: true },
        'sqlfluff.exclude_rules': { CP01: true, LT01: true },
        'sqlfluff:rules': { 'capitalisation.keywords': { capitalisation_policy: 'upper' } },
    });
    expect(collectRules(['missing', 'rules'], { rules: null })).toStrictEqual({ missing: {}, rules: {} });
});

test('disabled agent rules have the same stray paths in preview and apply pruning', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy([], { agentRules: true, tables: '[agent_rules]\nenabled = true\n' });
    await createFileTree(sandbox.path, { 'gspot.toml': policy });
    expect(await applyCommand({ cwd: sandbox.path, isDryRun: false })).toHaveProperty('exitCode', 0);
    const owned = getOwnership(sandbox.path).files.filter((entry) => entry.path.startsWith('.gspot/rules/'));
    expect(owned.length).toBeGreaterThan(0);
    await Bun.write(join(sandbox.path, 'gspot.toml'), policy.replace('enabled = true', 'enabled = false'));
    const session = await openSession(sandbox.path);
    const generated = emitAll(session);
    const expected = generatedPaths(generated);
    const strays = computeDrift(sandbox.path, generated).filter((entry) => entry.kind === 'stray');
    for (const entry of owned) {
        expect(isStray(entry, expected)).toBe(true);
        expect(strays).toContainEqual({ path: entry.path, kind: 'stray' });
        expect(await pathExists(join(sandbox.path, entry.path))).toBe(true);
    }
    const written = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(written.exitCode).toBe(0);
    for (const entry of owned) expect(await pathExists(join(sandbox.path, entry.path))).toBe(false);
});
