import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { statSync, chmodSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { run as runProcess } from '#cli/platform/spawn.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { writeSwiftlint } from '#tests/harness/cli/swift.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { onPosix, keptMode } from '#tests/harness/cli/platforms.ts';

const SWIFT_DOCS_SOURCE =
    '/** Parses a fixture value. */\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n\n/// The literal /** example */ is documentation syntax.\npublic let example = "/** not documentation */"\n\n/* Ordinary comment with a nested /** comment */ inside. */\n';

const SWIFT_INLINE_DOCS = [
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

async function documentationFindings(root: string, code: 0 | 1) {
    const result = await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(code);
    const [checked] = (JSON.parse(result.stdout) as RunReport).checks;
    if (checked === undefined) throw new Error('The report holds no check.');
    expect(checked).toMatchObject({ check: 'swift/swiftlint', status: code === 0 ? 'passed' : 'failed' });
    return checked.findings.filter((finding) => finding.rule === 'doc_comment_style');
}

// SwiftLint has no Windows build; Linux and macOS own these native diagnostics.
if (onPosix) {
    test.each(['recommended', 'all'])(
        'Swift documentation comment style has native diagnostics at %s',
        async (level) => {
            await using sandbox = await testdir();
            const root = sandbox.path;
            const policy = policyOf(['swift'], '[rules]\ninstall = false\n', level);
            await createFileTree(root, { 'gspot.toml': policy, 'Value.swift': SWIFT_DOCS_SOURCE });
            await writeSwiftlint(root);
            const broken = await runProcess(
                ['swiftlint', 'lint', '--strict', '--quiet', '--no-cache', '--reporter', 'json', 'Value.swift'],
                { cwd: root },
            );
            expect(broken.code, broken.stdout + broken.stderr).toBe(level === 'all' ? 2 : 0);
            expect(JSON.parse(broken.stdout)).toStrictEqual(
                level === 'all' ? [containing({ rule_id: 'doc_comment_style', line: 1, character: 1 })] : [],
            );
            // The documentation style rule is on at the all level alone, so the CLI reports it there and passes otherwise.
            const cli = await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json']);
            const docComment = containing({ rule: 'doc_comment_style', file: 'Value.swift', line: 1, column: 1 });
            expect(cli.code, cli.stdout + cli.stderr).toBe(level === 'all' ? 1 : 0);
            const findings = (JSON.parse(cli.stdout) as { checks: { findings: unknown[] }[] }).checks.flatMap(
                (check) => check.findings,
            );
            expect(findings).toStrictEqual(level === 'all' ? [docComment] : []);
            await Bun.write(
                join(root, 'Value.swift'),
                SWIFT_DOCS_SOURCE.replace('/** Parses a fixture value. */', '/// Parses a fixture value.'),
            );
            const corrected = await runProcess(
                ['swiftlint', 'lint', '--strict', '--quiet', '--no-cache', '--reporter', 'json', 'Value.swift'],
                { cwd: root },
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(JSON.parse(corrected.stdout)).toStrictEqual([]);
            await Bun.write(join(root, 'Value.swift'), SWIFT_DOCS_SOURCE);
            await Bun.write(
                join(root, 'gspot.toml'),
                `${policy}\n[[ignore]]\ncheck = "swift/swiftlint"\nrule = "doc_comment_style"\nreason = "The fixture preserves an external documentation format."\n`,
            );
            await writeSwiftlint(root);
            const excepted = await runProcess(
                ['swiftlint', 'lint', '--strict', '--quiet', '--no-cache', '--reporter', 'json', 'Value.swift'],
                { cwd: root },
            );
            expect(excepted.code, excepted.stdout + excepted.stderr).toBe(0);
            expect(JSON.parse(excepted.stdout)).toStrictEqual([]);
        },
    );

    test('Swift inline documentation retains native exceptions and original source positions', async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const policy = policyOf(['swift'], '[rules]\ninstall = false\n', 'all');
        const text = SWIFT_INLINE_DOCS;
        await createFileTree(root, { 'gspot.toml': policy, 'Value.swift': text });
        await writeSwiftlint(root);
        chmodSync(join(root, 'Value.swift'), 0o444);
        const found = await documentationFindings(root, 1);
        expect(statSync(join(root, 'Value.swift')).mode & 0o777).toBe(keptMode(0o444));
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
        expect(await documentationFindings(root, 0)).toStrictEqual([]);
        const policyExceptionText = text.replace(
            '// swiftlint:disable:next doc_comment_style - An external declaration retains its layout.\n/** A retained declaration. */',
            '/// A retained declaration.',
        );
        await Bun.write(join(root, 'Value.swift'), policyExceptionText);
        await Bun.write(
            join(root, 'gspot.toml'),
            `${policy}\n[[ignore]]\ncheck = "swift/swiftlint"\nrule = "doc_comment_style"\nreason = "The imported source retains its documentation layout."\n`,
        );
        await writeSwiftlint(root);
        expect(await documentationFindings(root, 0)).toStrictEqual([]);
        expect(await Bun.file(join(root, 'Value.swift')).text()).toBe(policyExceptionText);
    });

    test('nested Swift documentation settings retain their own native exclusions', async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const policy = policyOf(['swift'], '[rules]\ninstall = false\n', 'all');
        const policyExceptionText = SWIFT_INLINE_DOCS.replace(
            '// swiftlint:disable:next doc_comment_style - An external declaration retains its layout.\n/** A retained declaration. */',
            '/// A retained declaration.',
        );
        await Bun.write(join(root, 'gspot.toml'), policy);
        await Bun.write(join(root, 'Value.swift'), '/// A literal.\npublic let value = "safe"\n');
        await createFileTree(root, {
            'nested/Value.swift': policyExceptionText,
            'nested/.swiftlint.yml': 'parent_config: ../.swiftlint.yml\ndisabled_rules: [doc_comment_style]\n',
        });
        await writeSwiftlint(root);
        expect(await documentationFindings(root, 0)).toStrictEqual([]);
        await Bun.write(join(root, 'nested/.swiftlint.yml'), 'parent_config: ../.swiftlint.yml\n');
        const nested = await documentationFindings(root, 1);
        expect(nested.map(({ file }: { file: string }) => file)).toStrictEqual([
            'nested/Value.swift',
            'nested/Value.swift',
            'nested/Value.swift',
        ]);
    });
}
