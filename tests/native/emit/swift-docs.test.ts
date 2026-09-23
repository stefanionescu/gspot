import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';
import { run as runProcess } from '#cli/platform/spawn.ts';
import { run } from '#tests/support/cli/planted.ts';

const SOURCE =
    '/** Parses a fixture value. */\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n\n/// The literal /** example */ is documentation syntax.\npublic let example = "/** not documentation */"\n\n/* Ordinary comment with a nested /** comment */ inside. */\n';

test.each(['recommended', 'all'])('Swift documentation comment style has native diagnostics at %s', async (level) => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const policy = `version = 1\nlevel = "${level}"\npresets = ["swift"]\n[rules]\ninstall = false\n`;
    await createFileTree(root, { 'gspot.toml': policy, 'Value.swift': SOURCE });
    const generate = async (): Promise<void> => {
        for (const file of emitAll(await openSession(root)).files.filter(({ path }) => path.endsWith('swiftlint.yml')))
            await Bun.write(join(root, file.path), file.content);
    };
    const native = async () =>
        await runProcess(
            ['swiftlint', 'lint', '--strict', '--quiet', '--no-cache', '--reporter', 'json', 'Value.swift'],
            { cwd: root },
        );
    await generate();
    const broken = await native();
    expect(broken.code, broken.stdout + broken.stderr).toBe(2);
    expect(JSON.parse(broken.stdout)).toEqual([
        expect.objectContaining({ rule_id: 'doc_comment_style', line: 1, character: 1 }),
    ]);
    if (level === 'all') {
        const cli = await run(root, ['check', '--only', 'swift/swiftlint', '--no-cache', '--json']);
        expect(cli.code, cli.stdout + cli.stderr).toBe(1);
        expect(JSON.parse(cli.stdout).checks[0].findings).toEqual([
            expect.objectContaining({ rule: 'doc_comment_style', file: 'Value.swift', line: 1, column: 1 }),
        ]);
    }
    await Bun.write(
        join(root, 'Value.swift'),
        SOURCE.replace('/** Parses a fixture value. */', '/// Parses a fixture value.'),
    );
    const corrected = await native();
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(JSON.parse(corrected.stdout)).toEqual([]);
    await Bun.write(join(root, 'Value.swift'), SOURCE);
    await Bun.write(
        join(root, 'gspot.toml'),
        `${policy}\n[[ignore]]\ncheck = "swift/swiftlint"\nrule = "doc_comment_style"\nreason = "The fixture preserves an external documentation format."\n`,
    );
    await generate();
    const excepted = await native();
    expect(excepted.code, excepted.stdout + excepted.stderr).toBe(0);
    expect(JSON.parse(excepted.stdout)).toEqual([]);
});
