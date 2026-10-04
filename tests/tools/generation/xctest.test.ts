import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { DEFECT, CORRECT } from '#tests/config/tools/generation/xctest.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { commandConfigurations } from '#cli/execution/command/placeholders.ts';

// Configuration edits change the findings, and missing inputs fail explicitly.
async function expectConfigurationChanges(root: string, prefix: string, command: string[]): Promise<void> {
    const ran = await spawnGspot(root, command);
    expect(ran.code).toBe(0);
    const nestedPath = join(root, `${prefix}AppTests/.swiftlint.yml`);
    const nested = await Bun.file(nestedPath).text();
    await Bun.write(nestedPath, nested.replace('    - force_unwrapping\n', ''));
    const changedConfiguration = await spawnGspot(root, command);
    expect(changedConfiguration.code, changedConfiguration.stdout + changedConfiguration.stderr).toBe(1);
    expect((JSON.parse(changedConfiguration.stdout) as RunReport).checks[0]!.findings).toContainEqual(
        containing({ file: `${prefix}AppTests/Value.swift`, rule: 'force_unwrapping' }),
    );
    await Bun.write(nestedPath, nested);
    await Bun.write(join(root, `${prefix}Sources/Value.swift`), CORRECT.replace('value: String', 'value:String'));
    const fixed = await spawnGspot(root, [...command, '--fix']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await Bun.file(join(root, `${prefix}Sources/Value.swift`)).text()).toBe(CORRECT);
    unlinkSync(join(root, `${prefix}.swiftlint.yml`));
    const missing = await spawnGspot(root, command);
    expect(missing.code, missing.stdout + missing.stderr).toBe(2);
    expect(missing.stdout).toContain('Required configuration');
}

test.skipIf(!hasToolBuild('swiftlint')).each(['', 'ios # app'])(
    'Swift test overrides preserve source rules in scope %s',
    async (scope) => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const prefix = scope === '' ? '' : `${scope}/`;
        const scopeTable =
            scope === '' ? '' : `[[scope]]\npath = ${JSON.stringify(scope)}\nconfigurations = ["xctest"]\n`;
        await createFileTree(root, {
            'gspot.toml': `level = "all"\nconfigurations = ${scope === '' ? '["xctest"]' : '[]'}\n[agent_rules]\nenabled = false\n${scopeTable}`,
            [`${prefix}Sources/Value.swift`]: DEFECT,
            [`${prefix}AppTests/Value.swift`]: DEFECT,
            [`${prefix}AppTests/Deep/Value.swift`]: DEFECT,
        });
        const session = await openSession(root);
        const outputs = emitAll(session).files.filter(({ path }) => path.endsWith('swiftlint.yml'));
        expect(outputs.map(({ path }) => path)).toContain(`${prefix}AppTests/.swiftlint.yml`);
        for (const output of outputs) await Bun.write(join(root, output.path), output.content);
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
    },
);

test.skipIf(!hasToolBuild('swiftlint')).each(['AppTests', 'AppTests/Helpers'])(
    'a Swift test scope %s has one complete native configuration',
    async (scope) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], {
                tables: `[[scope]]\npath = "${scope}"\nconfigurations = ["xctest"]\n`,
                level: 'all',
            }),
            [`${scope}/Value.swift`]: DEFECT,
        });
        const session = await openSession(sandbox.path);
        const outputs = emitAll(session).files.filter(({ path }) => path.endsWith('swiftlint.yml'));
        expect(outputs.filter(({ path }) => path === `${scope}/.swiftlint.yml`)).toHaveLength(1);
        for (const output of outputs) await Bun.write(join(sandbox.path, output.path), output.content);
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
