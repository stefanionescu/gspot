import { emitAll } from '#cli/emit/targets.ts';
import { run as runProcess } from '#cli/platform/spawn.ts';
import { commandConfigurations } from '#cli/run/command-expansion.ts';
import { planRun } from '#cli/run/plan.ts';
import { openSession } from '#cli/run/session.ts';
import { run } from '#tests/support/cli/command.ts';
import { expect, test } from 'bun:test';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

const DEFECT = 'public func parsed(_ value: String) -> Int {\n    Int(value)! + 42\n}\n';
const CORRECT = '/// Parses a fixture value.\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n';

test.each(['', 'ios', 'ios # app'])('Swift test overrides preserve source rules in scope %s', async (scope) => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const prefix = scope === '' ? '' : `${scope}/`;
    await createFileTree(root, {
        'gspot.toml': `version = 1\nlevel = "all"\npresets = ${scope === '' ? '["xctest"]' : '[]'}\n[rules]\ninstall = false\n${scope === '' ? '' : `[[scope]]\npath = ${JSON.stringify(scope)}\npresets = ["xctest"]\n`}`,
        [`${prefix}Sources/Value.swift`]: DEFECT,
        [`${prefix}AppTests/Value.swift`]: DEFECT,
        [`${prefix}AppTests/Deep/Value.swift`]: DEFECT,
    });
    const session = await openSession(root);
    const outputs = emitAll(session).files.filter(({ path }) => path.endsWith('swiftlint.yml'));
    expect(outputs.map(({ path }) => path)).toContain(`${prefix}AppTests/.swiftlint.yml`);
    for (const output of outputs) await Bun.write(join(root, output.path), output.content);
    const planned = await planRun(session, { stage: 'commit', only: ['swift/swiftlint'], skips: [] });
    expect(planned).toHaveLength(1);
    expect(commandConfigurations(session, planned[0]!)).toContain(`${prefix}AppTests/.swiftlint.yml`);
    const command = ['check', '--only', 'swift/swiftlint', '--no-cache', '--json'];
    const broken = await run(root, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const findings = JSON.parse(broken.stdout).checks.flatMap((check: { findings: unknown[] }) => check.findings);
    expect(findings).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ file: `${prefix}Sources/Value.swift`, rule: 'force_unwrapping' }),
            expect.objectContaining({ file: `${prefix}Sources/Value.swift`, rule: 'missing_docs' }),
            expect.objectContaining({ file: `${prefix}Sources/Value.swift`, rule: 'no_magic_numbers' }),
        ]),
    );
    expect(findings.every((finding: { file: string }) => finding.file === `${prefix}Sources/Value.swift`)).toBe(true);
    await Bun.write(join(root, `${prefix}Sources/Value.swift`), CORRECT);
    const corrected = await run(root, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const cachedCommand = command.filter((part) => part !== '--no-cache');
    expect((await run(root, cachedCommand)).code).toBe(0);
    const cached = await run(root, cachedCommand);
    expect(JSON.parse(cached.stdout).checks[0].status).toBe('cache');
    const nestedPath = join(root, `${prefix}AppTests/.swiftlint.yml`);
    const nested = await Bun.file(nestedPath).text();
    await Bun.write(nestedPath, nested.replace('    - force_unwrapping\n', ''));
    const changedConfiguration = await run(root, cachedCommand);
    expect(changedConfiguration.code, changedConfiguration.stdout + changedConfiguration.stderr).toBe(1);
    expect(JSON.parse(changedConfiguration.stdout).checks[0].findings).toContainEqual(
        expect.objectContaining({ file: `${prefix}AppTests/Value.swift`, rule: 'force_unwrapping' }),
    );
    await Bun.write(nestedPath, nested);
    await Bun.write(join(root, `${prefix}Sources/Value.swift`), CORRECT.replace('value: String', 'value:String'));
    const fixed = await run(root, [...command, '--fix']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await Bun.file(join(root, `${prefix}Sources/Value.swift`)).text()).toBe(CORRECT);
    unlinkSync(join(root, `${prefix}.swiftlint.yml`));
    const missing = await run(root, command);
    expect(missing.code, missing.stdout + missing.stderr).toBe(2);
    expect(missing.stdout).toContain('Required configuration');
});

test.each(
    ['AppTests', 'AppTests/Helpers'].flatMap((scope) => ['recommended', 'all'].map((level) => ({ scope, level }))),
)('a Swift test scope $scope has one complete native configuration at $level', async ({ scope, level }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\npresets = []\n[[scope]]\npath = "${scope}"\npresets = ["xctest"]\n`,
        [`${scope}/Value.swift`]: DEFECT,
    });
    const outputs = emitAll(await openSession(sandbox.path)).files.filter(({ path }) => path.endsWith('swiftlint.yml'));
    expect(outputs.filter(({ path }) => path === `${scope}/.swiftlint.yml`)).toHaveLength(1);
    for (const output of outputs) await Bun.write(join(sandbox.path, output.path), output.content);
    const native = await runProcess(
        ['swiftlint', 'lint', '--strict', '--quiet', '--no-cache', '--reporter', 'json', 'Value.swift'],
        { cwd: join(sandbox.path, scope) },
    );
    expect(native.code, native.stdout + native.stderr).toBe(0);
    expect(JSON.parse(native.stdout)).toEqual([]);
    const result = await run(sandbox.path, ['check', '--only', 'swift/swiftlint', '--no-cache', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
});
