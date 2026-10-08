import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { stat, chmod, unlink } from 'node:fs/promises';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/apply.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { SAMPLE, CORRECT } from '#tests/config/tools/generation/xctest.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { commandConfigurations } from '#cli/execution/command/placeholders.ts';

// Configuration edits change the findings, and missing inputs fail explicitly.
async function expectConfigurationChanges(root: string, prefix: string, command: string[]): Promise<void> {
    const ran = await spawnGspot(root, command);
    expect(ran.code).toBe(0);
    const nestedPath = join(root, `${prefix}AppTests/.swiftlint.yml`);
    const nested = await Bun.file(nestedPath).text();
    const attributes = await stat(nestedPath);
    const mode = attributes.mode & 0o777;
    // The sandbox deliberately changes a managed, read-only configuration to exercise native enforcement.
    await chmod(nestedPath, mode | 0o200);
    await Bun.write(nestedPath, nested.replace('    - force_unwrapping\n', ''));
    const changedConfiguration = await spawnGspot(root, command);
    expect(changedConfiguration.code, changedConfiguration.stdout + changedConfiguration.stderr).toBe(1);
    expect((JSON.parse(changedConfiguration.stdout) as RunReport).checks[0]!.findings).toContainEqual(
        containing({ file: `${prefix}AppTests/Value.swift`, rule: 'force_unwrapping' }),
    );
    await Bun.write(nestedPath, nested);
    await chmod(nestedPath, mode);
    await Bun.write(join(root, `${prefix}Sources/Value.swift`), CORRECT.replace('value: String', 'value:String'));
    const fixed = await spawnGspot(root, [...command, '--fix']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await Bun.file(join(root, `${prefix}Sources/Value.swift`)).text()).toBe(CORRECT);
    await unlink(join(root, `${prefix}.swiftlint.yml`));
    const missing = await spawnGspot(root, command);
    expect(missing.code, missing.stdout + missing.stderr).toBe(2);
    expect(missing.stdout).toContain('Required configuration');
}

test.skipIf(!hasToolBuild('swiftlint')).each([
    ['at the root', ''],
    ['in a scope whose path has a space and #', 'ios # app'],
] as const)('Swift test overrides preserve source rules %s', async (_label, scope) => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const prefix = scope === '' ? '' : `${scope}/`;
    const scopeTable = scope === '' ? '' : `[scope.${JSON.stringify(scope)}]\nconfigurations = ["xctest"]\n`;
    await createFileTree(root, {
        'gspot.toml': `level = "all"\nconfigurations = ${scope === '' ? '["xctest"]' : '[]'}\n[agent_rules]\nenabled = false\n${scopeTable}`,
        [`${prefix}Sources/Value.swift`]: SAMPLE,
        [`${prefix}AppTests/Value.swift`]: SAMPLE,
        [`${prefix}AppTests/Deep/Value.swift`]: SAMPLE,
    });
    const session = await openSession(root);
    const emitted = emitAll(session);
    const outputs = emitted.files.filter(({ path }) => path.endsWith('swiftlint.yml'));
    expect(outputs.map(({ path }) => path)).toContain(`${prefix}AppTests/.swiftlint.yml`);
    using log = openOwnership(root);
    writeGeneratedFiles(session, log, undefined, emitted);
    const planned = planRun(session, { stage: 'commit', only: ['swift/swiftlint'], skips: [] });
    expect(planned).toHaveLength(1);
    expect(commandConfigurations(session, planned[0]!)).toContain(`${prefix}AppTests/.swiftlint.yml`);
    const command = ['check', '--only', 'swift/swiftlint', '--json'];
    const broken = await spawnGspot(root, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const findings = (JSON.parse(broken.stdout) as RunReport).checks.flatMap((check) => check.findings);
    expect(findings).toStrictEqual(
        containingAll([
            containing({ file: `${prefix}Sources/Value.swift`, rule: 'force_unwrapping' }),
            containing({ file: `${prefix}Sources/Value.swift`, rule: 'missing_docs' }),
            containing({ file: `${prefix}Sources/Value.swift`, rule: 'no_magic_numbers' }),
        ]),
    );
    expect(findings.every((finding) => finding.file === `${prefix}Sources/Value.swift`)).toBe(true);
    await Bun.write(join(root, `${prefix}Sources/Value.swift`), CORRECT);
    const corrected = await spawnGspot(root, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    await expectConfigurationChanges(root, prefix, command);
});

test.skipIf(!hasToolBuild('swiftlint')).each(['AppTests', 'AppTests/Helpers'])(
    'a Swift test scope %s has one complete native configuration',
    async (scope) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], {
                tables: `[scope."${scope}"]\nconfigurations = ["xctest"]\n`,
                level: 'all',
            }),
            [`${scope}/Value.swift`]: SAMPLE,
        });
        const session = await openSession(sandbox.path);
        const emitted = emitAll(session);
        const outputs = emitted.files.filter(({ path }) => path.endsWith('swiftlint.yml'));
        expect(outputs.filter(({ path }) => path === `${scope}/.swiftlint.yml`)).toHaveLength(1);
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(session, log, undefined, emitted);
        const native = await runTestCommand(
            ['swiftlint', 'lint', '--strict', '--quiet', '--no-cache', '--reporter', 'json', 'Value.swift'],
            { cwd: join(sandbox.path, scope) },
        );
        expect(native.code, native.stdout + native.stderr).toBe(0);
        expect(JSON.parse(native.stdout)).toStrictEqual([]);
        const result = await spawnGspot(sandbox.path, ['check', '--only', 'swift/swiftlint', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
    },
);
