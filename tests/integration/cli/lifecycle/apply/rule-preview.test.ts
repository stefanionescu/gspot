import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { openSession } from '#cli/execution/session.ts';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { containing, containingAll } from '#tests/support/expectations.ts';

const policy = (dialect: string) =>
    `version = 1\nconfigurations = ["sql"]\n[tools.sqlfluff]\ndialect = ${JSON.stringify(dialect)}\n`;

test('apply rejects injected SQLFluff dialect directives with exit 2 before changing configuration', async () => {
    await using sandbox = await testdir();
    const original = '[sqlfluff]\ndialect = postgres\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policy('sqlite\nexclude_rules = ALL'),
        '.gspot/config/sqlfluff.cfg': original,
    });
    const refused = await run(sandbox.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('Use a SQLFluff dialect label');
    expect(await Bun.file(join(sandbox.path, '.gspot/config/sqlfluff.cfg')).text()).toBe(original);
    await Bun.write(join(sandbox.path, 'gspot.toml'), policy('sqlite'));
    const corrected = await run(sandbox.path, ['apply', '--dry-run']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, '.gspot/config/sqlfluff.cfg')).text()).toBe(original);
});

test('apply preview names a SwiftLint rule addition and leaves existing configuration unchanged', async () => {
    await using sandbox = await testdir();
    const policy = 'version = 1\nlevel = "all"\nconfigurations = ["swift"]\n[rules]\ninstall = false\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': `${policy}\n[[ignore]]\ncheck = "swift/swiftlint"\nrule = "empty_count"\nreason = "The fixture verifies enabling a previously ignored rule."\n`,
        'Example.swift': 'let example = 1\n',
    });
    const originalSession = await openSession(sandbox.path);
    const original = emitAll(originalSession.policyFiles.policy, originalSession.repository, originalSession.scopes, {
        version: originalSession.version,
        packageClient: originalSession.packageClient,
    }).files.find((file) => file.path === '.gspot/config/swiftlint.yml')!;
    await createFileTree(sandbox.path, { [original.path]: original.content });
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.text).toContain('opt_in_rules: added empty_count');
    expect(preview.json).toMatchObject({
        drift: containingAll([
            containing({
                path: original.path,
                rules: containingAll([
                    { path: 'opt_in_rules', added: ['empty_count'], removed: [], changed: [] },
                    { path: 'disabled_rules', added: [], removed: ['empty_count'], changed: [] },
                ]),
            }),
        ]),
    });
    expect(readFileSync(join(sandbox.path, original.path), 'utf8')).toBe(original.content);
    const correctedSession = await openSession(sandbox.path);
    const corrected = emitAll(
        correctedSession.policyFiles.policy,
        correctedSession.repository,
        correctedSession.scopes,
        {
            version: correctedSession.version,
            packageClient: correctedSession.packageClient,
        },
    ).files.find((file) => file.path === original.path)!;
    writeFileSync(join(sandbox.path, original.path), corrected.content);
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(applied.text).not.toContain('opt_in_rules: added empty_count');
});

test.each([
    { configuration: 'bash', tool: 'shellcheck', rule: 'SC2086', target: 'shellcheckrc', collection: 'disable' },
    {
        configuration: 'swift',
        tool: 'swiftformat',
        rule: 'consecutiveSpaces',
        target: 'swiftformat',
        collection: 'disable',
    },
    {
        configuration: 'sql',
        tool: 'sqlfluff',
        rule: 'CP01',
        target: 'sqlfluff.cfg',
        collection: 'sqlfluff.exclude_rules',
    },
    {
        configuration: 'postgres',
        tool: 'squawk',
        rule: 'adding-required-field',
        target: 'squawk.toml',
        collection: 'excluded_rules',
    },
    { configuration: 'nginx', tool: 'gixy', rule: 'ssrf', target: 'gixy.cfg', collection: 'skips' },
])(
    'apply preview names a removed $tool suppression without changing installed rules',
    async ({ configuration, tool, rule, target, collection }) => {
        await using sandbox = await testdir();
        const policy = `version = 1\nlevel = "all"\nconfigurations = ["${configuration}"]\n[rules]\ninstall = false\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': `${policy}\n[[ignore]]\ncheck = "${configuration}/${tool}"\nrule = "${rule}"\nreason = "The fixture verifies a removed suppression."\n`,
        });
        const originalSession = await openSession(sandbox.path);
        const original = emitAll(
            originalSession.policyFiles.policy,
            originalSession.repository,
            originalSession.scopes,
            {
                version: originalSession.version,
                packageClient: originalSession.packageClient,
            },
        ).files.find((file) => file.path === `.gspot/config/${target}`)!;
        await createFileTree(sandbox.path, { [original.path]: original.content });
        writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
        const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
        expect(preview.text).toContain(`${collection}: removed ${rule}`);
        expect(readFileSync(join(sandbox.path, original.path), 'utf8')).toBe(original.content);
        const correctedSession = await openSession(sandbox.path);
        const corrected = emitAll(
            correctedSession.policyFiles.policy,
            correctedSession.repository,
            correctedSession.scopes,
            {
                version: correctedSession.version,
                packageClient: correctedSession.packageClient,
            },
        ).files.find((file) => file.path === original.path)!;
        writeFileSync(join(sandbox.path, original.path), corrected.content);
        const applied = await applyCommand({ cwd: sandbox.path, isDryRun: true });
        expect(applied.text).not.toContain(`${collection}: removed ${rule}`);
    },
);

test('apply preview names added Vale styles when prose moves from recommended to all', async () => {
    await using sandbox = await testdir();
    const policy = 'version = 1\nconfigurations = ["prose"]\n[rules]\ninstall = false\n';
    await createFileTree(sandbox.path, { 'gspot.toml': policy });
    const originalSession = await openSession(sandbox.path);
    const original = emitAll(originalSession.policyFiles.policy, originalSession.repository, originalSession.scopes, {
        version: originalSession.version,
        packageClient: originalSession.packageClient,
    }).files.find((file) => file.path === '.gspot/config/vale.ini')!;
    await createFileTree(sandbox.path, { [original.path]: original.content });
    writeFileSync(join(sandbox.path, 'gspot.toml'), `level = "all"\n${policy}`);
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.json).toMatchObject({
        drift: containingAll([
            containing({
                path: original.path,
                rules: containingAll([
                    containing({
                        path: '*.BasedOnStyles',
                        added: containingAll(['Google', 'Microsoft']),
                    }),
                ]),
            }),
        ]),
    });
    expect(readFileSync(join(sandbox.path, original.path), 'utf8')).toBe(original.content);
    const correctedSession = await openSession(sandbox.path);
    const corrected = emitAll(
        correctedSession.policyFiles.policy,
        correctedSession.repository,
        correctedSession.scopes,
        {
            version: correctedSession.version,
            packageClient: correctedSession.packageClient,
        },
    ).files.find((file) => file.path === original.path)!;
    writeFileSync(join(sandbox.path, original.path), corrected.content);
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(applied.text).not.toContain('*.BasedOnStyles: added');
});

test.each([
    { configuration: 'commits', check: 'commitlint', rule: 'type-case', target: 'commitlint.config.cjs' },
    { configuration: 'configs', check: 'yaml', rule: 'truthy', target: 'yamllint.yml' },
    { configuration: 'html', check: 'html-validate', rule: 'no-inline-style', target: 'html-validate-templates.json' },
])(
    'apply preview names an enabled $check rule and preserves installed configuration',
    async ({ configuration, check, rule, target }) => {
        await using sandbox = await testdir();
        const policy = `version = 1\nlevel = "all"\nconfigurations = ["${configuration}"]\n[rules]\ninstall = false\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': `${policy}\n[[ignore]]\ncheck = "${configuration}/${check}"\nrule = "${rule}"\nreason = "The fixture verifies enabling a previously disabled rule."\n`,
        });
        const originalSession = await openSession(sandbox.path);
        const original = emitAll(
            originalSession.policyFiles.policy,
            originalSession.repository,
            originalSession.scopes,
            {
                version: originalSession.version,
                packageClient: originalSession.packageClient,
            },
        ).files.find((file) => file.path === `.gspot/config/${target}`)!;
        await createFileTree(sandbox.path, { [original.path]: original.content });
        writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
        const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
        expect(preview.text).toContain(`rules: changed ${rule}`);
        expect(readFileSync(join(sandbox.path, original.path), 'utf8')).toBe(original.content);
        const correctedSession = await openSession(sandbox.path);
        const corrected = emitAll(
            correctedSession.policyFiles.policy,
            correctedSession.repository,
            correctedSession.scopes,
            {
                version: correctedSession.version,
                packageClient: correctedSession.packageClient,
            },
        ).files.find((file) => file.path === original.path)!;
        writeFileSync(join(sandbox.path, original.path), corrected.content);
        const applied = await applyCommand({ cwd: sandbox.path, isDryRun: true });
        expect(applied.text).not.toContain(`rules: changed ${rule}`);
    },
);

test('apply preview names a missing Semgrep rule by ID and clears it after correction', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["security"]\n[rules]\ninstall = false\n',
    });
    const session = await openSession(sandbox.path);
    const original = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.find((file) => file.path === '.gspot/config/semgrep/node.yml')!;
    const parsed = Bun.YAML.parse(original.content) as { rules: { id: string }[] };
    const removed = parsed.rules.shift()!;
    const before = Bun.YAML.stringify(parsed);
    await createFileTree(sandbox.path, { [original.path]: before });
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.text).toContain(`rules: added ${removed.id}`);
    expect(readFileSync(join(sandbox.path, original.path), 'utf8')).toBe(before);
    writeFileSync(join(sandbox.path, original.path), original.content);
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(applied.text).not.toContain(`rules: added ${removed.id}`);
});
