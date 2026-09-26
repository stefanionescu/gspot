import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { chmodSync, statSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { run } from '#tests/support/cli/command.ts';
import { openSession } from '#cli/execution/session.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { run as runProcess } from '#cli/platform/spawn.ts';

const SOURCE =
    '/** Parses a fixture value. */\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n\n/// The literal /** example */ is documentation syntax.\npublic let example = "/** not documentation */"\n\n/* Ordinary comment with a nested /** comment */ inside. */\n';

test.each(['recommended', 'all'])('Swift documentation comment style has native diagnostics at %s', async (level) => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const policy = `version = 1\nlevel = "${level}"\nconfigurations = ["swift"]\n[rules]\ninstall = false\n`;
    await createFileTree(root, { 'gspot.toml': policy, 'Value.swift': SOURCE });
    const generate = async (): Promise<void> => {
        const renderSession1 = await openSession(root);
        for (const file of emitAll(
            renderSession1.policyFiles.policy,
            renderSession1.repository,
            renderSession1.scopes,
            { version: renderSession1.version, packageManager: renderSession1.packageManager },
        ).files.filter(({ path }) => path.endsWith('swiftlint.yml')))
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
    // The documentation style rule is on at the all level alone, so the CLI reports it there and passes otherwise.
    const cli = await run(root, ['check', '--only', 'swift/swiftlint', '--no-cache', '--json']);
    const docComment = expect.objectContaining({ rule: 'doc_comment_style', file: 'Value.swift', line: 1, column: 1 });
    expect(cli.code, cli.stdout + cli.stderr).toBe(level === 'all' ? 1 : 0);
    const findings = (JSON.parse(cli.stdout) as { checks: { findings: unknown[] }[] }).checks.flatMap(
        (check) => check.findings,
    );
    expect(findings).toStrictEqual(level === 'all' ? [docComment] : []);
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
        '    /// The first choice.',
        '    case one /** Inline documentation. */',
        '}',
        '/// A literal.',
        'public let example = "/** literal */" /** After a string. */',
        '/* Ordinary comment. */ /** After a comment. */',
        '/// An inline /** example */ remains documentation.',
        'public let value = "safe"',
        '/* Ordinary /** nested */ comment. */',
        '// swiftlint:disable:next doc_comment_style - An external declaration retains its layout.',
        '/** A retained declaration. */',
        'public let preserved = "fixed"',
        '',
    ].join('\n');
    await createFileTree(root, { 'gspot.toml': policy, 'Value.swift': text });
    const generate = async () => {
        const renderSession2 = await openSession(root);
        for (const file of emitAll(
            renderSession2.policyFiles.policy,
            renderSession2.repository,
            renderSession2.scopes,
            { version: renderSession2.version, packageManager: renderSession2.packageManager },
        ).files.filter(({ path }) => path.endsWith('swiftlint.yml')))
            await Bun.write(join(root, file.path), file.content);
    };
    const check = async (code: 0 | 1) => {
        const result = await run(root, ['check', '--only', 'swift/swiftlint', '--no-cache', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(code);
        const [checked] = reportSchema.parse(JSON.parse(result.stdout)).checks;
        if (checked === undefined) throw new Error('The report holds no check.');
        expect(checked).toMatchObject({ check: 'swift/swiftlint', status: code === 0 ? 'ok' : 'fail' });
        return checked.findings.filter((finding) => finding.rule === 'doc_comment_style');
    };
    await generate();
    chmodSync(join(root, 'Value.swift'), 0o444);
    const found = await check(1);
    expect(statSync(join(root, 'Value.swift')).mode & 0o777).toBe(0o444);
    chmodSync(join(root, 'Value.swift'), 0o644);
    expect(found.map(({ line, column }) => [line, column])).toStrictEqual([
        [4, 14],
        [7, 39],
        [8, 25],
    ]);
    expect(await Bun.file(join(root, 'Value.swift')).text()).toBe(text);
    await Bun.write(
        join(root, 'Value.swift'),
        text.replaceAll(/\/\*\* (Inline documentation\.|After a string\.|After a comment\.) \*\//gu, '// $1'),
    );
    expect(await check(0)).toStrictEqual([]);
    const policyExceptionText = text.replace(
        '// swiftlint:disable:next doc_comment_style - An external declaration retains its layout.\n/** A retained declaration. */',
        '/// A retained declaration.',
    );
    await Bun.write(join(root, 'Value.swift'), policyExceptionText);
    await Bun.write(
        join(root, 'gspot.toml'),
        `${policy}\n[[ignore]]\ncheck = "swift/swiftlint"\nrule = "doc_comment_style"\nreason = "The imported source retains its documentation layout."\n`,
    );
    await generate();
    expect(await check(0)).toStrictEqual([]);
    expect(await Bun.file(join(root, 'Value.swift')).text()).toBe(policyExceptionText);
    await Bun.write(join(root, 'gspot.toml'), policy);
    await Bun.write(join(root, 'Value.swift'), '/// A literal.\npublic let value = "safe"\n');
    await createFileTree(root, {
        'nested/Value.swift': policyExceptionText,
        'nested/.swiftlint.yml': 'parent_config: ../.swiftlint.yml\ndisabled_rules: [doc_comment_style]\n',
    });
    await generate();
    expect(await check(0)).toStrictEqual([]);
    await Bun.write(join(root, 'nested/.swiftlint.yml'), 'parent_config: ../.swiftlint.yml\n');
    expect((await check(1)).map(({ file }: { file: string }) => file)).toStrictEqual([
        'nested/Value.swift',
        'nested/Value.swift',
        'nested/Value.swift',
    ]);
});
