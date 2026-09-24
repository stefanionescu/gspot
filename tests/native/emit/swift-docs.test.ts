import { join } from 'node:path';
import { planRun } from '#cli/run/plan.ts';
import { emitAll } from '#cli/emit/targets.ts';
import { expect, spyOn, test } from 'bun:test';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { run } from '#tests/support/cli/command.ts';
import { chmodSync, existsSync, statSync } from 'node:fs';
import { run as runProcess } from '#cli/platform/spawn.ts';
import { checkSwiftlint } from '#cli/structure/swift/lint.ts';

const SOURCE =
    '/** Parses a fixture value. */\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n\n/// The literal /** example */ is documentation syntax.\npublic let example = "/** not documentation */"\n\n/* Ordinary comment with a nested /** comment */ inside. */\n';

test.each(['recommended', 'all'])('Swift documentation comment style has native diagnostics at %s', async (level) => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const policy = `version = 1\nlevel = "${level}"\nconfigurations = ["swift"]\n[rules]\ninstall = false\n`;
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
    expect(JSON.parse(broken.stdout)).toStrictEqual([
        expect.objectContaining({ rule_id: 'doc_comment_style', line: 1, character: 1 }),
    ]);
    if (level === 'all') {
        const cli = await run(root, ['check', '--only', 'swift/swiftlint', '--no-cache', '--json']);
        expect(cli.code, cli.stdout + cli.stderr).toBe(1);
        expect(JSON.parse(cli.stdout).checks[0].findings).toStrictEqual([
            expect.objectContaining({ rule: 'doc_comment_style', file: 'Value.swift', line: 1, column: 1 }),
        ]);
    }
    await Bun.write(
        join(root, 'Value.swift'),
        SOURCE.replace('/** Parses a fixture value. */', '/// Parses a fixture value.'),
    );
    const corrected = await native();
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(JSON.parse(corrected.stdout)).toStrictEqual([]);
    await Bun.write(join(root, 'Value.swift'), SOURCE);
    await Bun.write(
        join(root, 'gspot.toml'),
        `${policy}\n[[ignore]]\ncheck = "swift/swiftlint"\nrule = "doc_comment_style"\nreason = "The fixture preserves an external documentation format."\n`,
    );
    await generate();
    const excepted = await native();
    expect(excepted.code, excepted.stdout + excepted.stderr).toBe(0);
    expect(JSON.parse(excepted.stdout)).toStrictEqual([]);
});

test('Swift inline documentation retains native exceptions and original source positions', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const policy = 'version = 1\nlevel = "all"\nconfigurations = ["swift"]\n[rules]\ninstall = false\n';
    const text = [
        '/// A choice.',
        'public enum Choice {',
        '    case one /** Inline documentation. */',
        '}',
        '/// A literal.',
        'public let example = "/** literal */" /** After a string. */',
        '/* Ordinary comment. */ /** After a comment. */',
        '/// An inline /** example */ remains documentation.',
        'public let value = "safe"',
        '/* Ordinary /** nested */ comment. */',
        '/// A retained declaration.',
        '// swiftlint:disable:next doc_comment_style - An external declaration retains its layout.',
        'public let preserved = "fixed" /** Accepted. */',
        '',
    ].join('\n');
    await createFileTree(root, { 'gspot.toml': policy, 'Value.swift': text });
    const generate = async () => {
        for (const file of emitAll(await openSession(root)).files.filter(({ path }) => path.endsWith('swiftlint.yml')))
            await Bun.write(join(root, file.path), file.content);
    };
    const check = async () => {
        const result = await run(root, ['check', '--only', 'swift/swiftlint', '--no-cache', '--json']);
        expect([0, 1]).toContain(result.code);
        return JSON.parse(result.stdout).checks[0].findings.filter(
            (finding: { rule: string }) => finding.rule === 'doc_comment_style',
        );
    };
    await generate();
    chmodSync(join(root, 'Value.swift'), 0o444);
    const found = await check();
    expect(statSync(join(root, 'Value.swift')).mode & 0o777).toBe(0o444);
    chmodSync(join(root, 'Value.swift'), 0o644);
    expect(found.map(({ line, column }: { line: number; column: number }) => [line, column])).toStrictEqual([
        [3, 14],
        [6, 39],
        [7, 25],
    ]);
    expect(await Bun.file(join(root, 'Value.swift')).text()).toBe(text);
    await Bun.write(
        join(root, 'Value.swift'),
        text.replaceAll(/\/\*\* (Inline documentation\.|After a string\.|After a comment\.) \*\//gu, '// $1'),
    );
    expect(await check()).toStrictEqual([]);
    await Bun.write(join(root, 'Value.swift'), text);
    await Bun.write(
        join(root, 'gspot.toml'),
        `${policy}\n[[ignore]]\ncheck = "swift/swiftlint"\nrule = "doc_comment_style"\nreason = "The imported source retains its documentation layout."\n`,
    );
    await generate();
    expect(await check()).toStrictEqual([]);
    expect(await Bun.file(join(root, 'Value.swift')).text()).toBe(text);
    await Bun.write(join(root, 'gspot.toml'), policy);
    await Bun.write(join(root, 'Value.swift'), '/// A literal.\npublic let value = \"safe\"\n');
    await createFileTree(root, {
        'nested/Value.swift': text,
        'nested/.swiftlint.yml': 'parent_config: ../.swiftlint.yml\ndisabled_rules: [doc_comment_style]\n',
    });
    await generate();
    expect(await check()).toStrictEqual([]);
    await Bun.write(join(root, 'nested/.swiftlint.yml'), 'parent_config: ../.swiftlint.yml\n');
    expect((await check()).map(({ file }: { file: string }) => file)).toStrictEqual([
        'nested/Value.swift',
        'nested/Value.swift',
        'nested/Value.swift',
    ]);
    const session = await openSession(root);
    const planned = (await planRun(session, { stage: 'all', only: ['swift/swiftlint'], skips: [] }))[0]!;
    const execute = processes.run;
    let workspace = '';
    const malformed = spyOn(processes, 'run').mockImplementation((command, options) => {
        if (command.includes('--reporter') && options.cwd !== root) {
            workspace = options.cwd;
            return Promise.resolve({ code: 0, missing: false, stdout: '{', stderr: '', duration: 1 });
        }
        return execute(command, options);
    });
    try {
        const failed = await checkSwiftlint(session, planned);
        expect(failed.status).toBe('error');
        expect(failed.note).toContain('invalid JSON report');
        expect(workspace).not.toBe('');
        expect(existsSync(workspace)).toBe(false);
        expect(await Bun.file(join(root, 'nested/Value.swift')).text()).toBe(text);
    } finally {
        malformed.mockRestore();
    }
});
