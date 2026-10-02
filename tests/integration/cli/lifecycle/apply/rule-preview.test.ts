import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';

test('apply preview names a SwiftLint rule addition and leaves existing configuration unchanged', async () => {
    await using sandbox = await testdir();
    const policy = policyOf(['swift'], '[guides]\ninstall = false\n', 'all');
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

test('apply preview names a removed suppression without changing installed rules', async () => {
    await using sandbox = await testdir();
    const policy = policyOf(['bash'], '[guides]\ninstall = false\n', 'all');
    await createFileTree(sandbox.path, {
        'gspot.toml': `${policy}\n[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\nreason = "The fixture verifies a removed suppression."\n`,
    });
    const originalSession = await openSession(sandbox.path);
    const original = emitAll(originalSession.policyFiles.policy, originalSession.repository, originalSession.scopes, {
        version: originalSession.version,
        packageClient: originalSession.packageClient,
    }).files.find((file) => file.path === '.gspot/config/shellcheckrc')!;
    await createFileTree(sandbox.path, { [original.path]: original.content });
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.text).toContain('disable: removed SC2086');
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
    expect(applied.text).not.toContain('disable: removed SC2086');
});

test('apply preview names added Vale styles when prose moves from recommended to all', async () => {
    await using sandbox = await testdir();
    const policy = policyOf(['prose'], '[guides]\ninstall = false\n');
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

test('apply preview names an enabled rule and preserves installed configuration', async () => {
    await using sandbox = await testdir();
    const policy = policyOf(['commits'], '[guides]\ninstall = false\n', 'all');
    await createFileTree(sandbox.path, {
        'gspot.toml': `${policy}\n[[ignore]]\ncheck = "commits/commitlint"\nrule = "type-case"\nreason = "The fixture verifies enabling a previously disabled rule."\n`,
    });
    const originalSession = await openSession(sandbox.path);
    const original = emitAll(originalSession.policyFiles.policy, originalSession.repository, originalSession.scopes, {
        version: originalSession.version,
        packageClient: originalSession.packageClient,
    }).files.find((file) => file.path === '.gspot/config/commitlint.config.cjs')!;
    await createFileTree(sandbox.path, { [original.path]: original.content });
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.text).toContain('rules: changed type-case');
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
    expect(applied.text).not.toContain('rules: changed type-case');
});
