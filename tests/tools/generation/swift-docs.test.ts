import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { statSync, chmodSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { containing } from '#tests/harness/expectations.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { SWIFT_DOCS_SOURCE, SWIFT_INLINE_DOCS } from '#tests/config/tools/generation/swift-docs.ts';

async function documentationFindings(root: string, code: 0 | 1) {
    const result = await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(code);
    const [checked] = (JSON.parse(result.stdout) as RunReport).checks;
    if (checked === undefined) throw new Error('The report holds no check.');
    expect(checked).toMatchObject({ check: 'swift/swiftlint', status: code === 0 ? 'passed' : 'failed' });
    return checked.findings.filter((finding) => finding.rule === 'doc_comment_style');
}

// SwiftLint has no Windows build; Linux and macOS own these native diagnostics.
test.skipIf(!isPosix).each(['recommended', 'all'])(
    'Swift documentation comment style has native diagnostics at %s',
    async (level) => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const policy = buildPolicy(['swift'], { tables: '[agent_rules]\nenabled = false\n', level: level });
        await createFileTree(root, { 'gspot.toml': policy, 'Value.swift': SWIFT_DOCS_SOURCE });
        const configured = await spawnGspot(root, ['apply']);
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
        const broken = await runTestCommand(
            ['swiftlint', 'lint', '--strict', '--quiet', '--no-cache', '--reporter', 'json', 'Value.swift'],
            { cwd: root },
        );
        expect(broken.code, broken.stdout + broken.stderr).toBe(level === 'all' ? 2 : 0);
        expect(JSON.parse(broken.stdout)).toStrictEqual(
            level === 'all' ? [containing({ rule_id: 'doc_comment_style', line: 1, character: 1 })] : [],
        );
        // The documentation style rule is on at the all level alone, so the CLI reports it there and passes otherwise.
        const cli = await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json']);
        const docComment = containing<Finding>({
            rule: 'doc_comment_style',
            file: 'Value.swift',
            line: 1,
            column: 1,
        });
        expect(cli.code, cli.stdout + cli.stderr).toBe(level === 'all' ? 1 : 0);
        const findings = (JSON.parse(cli.stdout) as RunReport).checks.flatMap((check) => check.findings);
        expect(findings).toStrictEqual(level === 'all' ? [docComment] : []);
        await Bun.write(
            join(root, 'Value.swift'),
            SWIFT_DOCS_SOURCE.replace('/** Parses a fixture value. */', '/// Parses a fixture value.'),
        );
        const corrected = await runTestCommand(
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
        const applied = await spawnGspot(root, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const excepted = await runTestCommand(
            ['swiftlint', 'lint', '--strict', '--quiet', '--no-cache', '--reporter', 'json', 'Value.swift'],
            { cwd: root },
        );
        expect(excepted.code, excepted.stdout + excepted.stderr).toBe(0);
        expect(JSON.parse(excepted.stdout)).toStrictEqual([]);
    },
);
test.skipIf(!isPosix)(
    'Swift inline documentation retains native exceptions and original source positions',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const policy = buildPolicy(['swift'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' });
        const text = SWIFT_INLINE_DOCS;
        await createFileTree(root, { 'gspot.toml': policy, 'Value.swift': text });
        const configured = await spawnGspot(root, ['apply']);
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
        chmodSync(join(root, 'Value.swift'), 0o444);
        const found = await documentationFindings(root, 1);
        expect(statSync(join(root, 'Value.swift')).mode & 0o777).toBe(getKeptMode(0o444));
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
        const applied = await spawnGspot(root, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect(await documentationFindings(root, 0)).toStrictEqual([]);
        expect(await Bun.file(join(root, 'Value.swift')).text()).toBe(policyExceptionText);
    },
);
test.skipIf(!isPosix)('nested Swift documentation settings retain their own native exclusions', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const policy = buildPolicy(['swift'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' });
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
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await documentationFindings(root, 0)).toStrictEqual([]);
    await Bun.write(join(root, 'nested/.swiftlint.yml'), 'parent_config: ../.swiftlint.yml\n');
    const nested = await documentationFindings(root, 1);
    expect(nested.map(({ file }) => file)).toStrictEqual([
        'nested/Value.swift',
        'nested/Value.swift',
        'nested/Value.swift',
    ]);
});
