import { join } from 'node:path';
import { renameSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { TYPO } from '#tests/harness/spelling.ts';
import { testdir, createFileTree } from 'testdirs';
import { GspotError } from '#cli/platform/errors.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { parseOutput } from '#cli/execution/tool/formats.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { isToolBroken, checkedFindings } from '#cli/execution/tool/findings.ts';

test('native Markdown JSON preserves filename delimiters, positions, and fixability', async () => {
    await using sandbox = await testdir();
    const paths = ['space name.md', ...(process.platform === 'win32' ? [] : ['name:5.md', 'line\nbreak.md'])];
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['markdown'],
            '[tools.markdownlint.rules]\ndefault = false\nMD009 = true\nMD033 = true\nMD041 = true\n',
            'all',
        ),
        ...Object.fromEntries(paths.map((path) => [path, 'café <span>Content</span>   \n'])),
    });
    const session = await openSession(sandbox.path);
    const configuration = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.find(({ path }) => path === '.gspot/config/markdownlint-cli2.mjs')!;
    await Bun.write(join(sandbox.path, configuration.path), configuration.content);
    const plans = planRun(session, { stage: 'all', only: ['markdown/markdownlint'], skips: [] });
    const planned = plans[0]!;
    const command = [
        'markdownlint-cli2',
        '--no-globs',
        '--config',
        configuration.path,
        ...paths.map((path) => `:${path}`),
    ];
    const failed = Bun.spawnSync(command, { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    expect(failed.exitCode, failed.stderr.toString()).toBe(1);
    const findings = parseOutput(planned.spec, failed.stdout.toString(), failed.stderr.toString(), sandbox.path);
    for (const file of paths) {
        expect(findings).toContainEqual(containing({ file, line: 1, column: 6, rule: 'MD033', fixable: false }));
        expect(findings).toContainEqual(containing({ file, line: 1, rule: 'MD009', fixable: true }));
        expect(findings).toContainEqual(containing({ file, line: 1, rule: 'MD041', fixable: false }));
    }
    const declared = { ...planned };
    delete declared.manifest;
    const result = { stdout: failed.stdout.toString(), stderr: '', code: 1, missing: false, duration: 1 };
    for (const check of [planned, declared]) {
        expect(checkedFindings(check, result, [sandbox.path, sandbox.path])).toStrictEqual(findings);
        expect(() => checkedFindings(check, { ...result, code: 2 }, [sandbox.path, sandbox.path])).toThrow(GspotError);
        expect(() => checkedFindings(check, { ...result, stdout: '[]' }, [sandbox.path, sandbox.path])).toThrow(
            GspotError,
        );
    }
    for (const path of paths) await Bun.write(join(sandbox.path, path), '# Title\n');
    const corrected = Bun.spawnSync(command, { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
    expect(parseOutput(planned.spec, corrected.stdout.toString(), '', sandbox.path)).toStrictEqual([]);
});

test('native spelling JSON retains filename delimiters, Unicode columns, and forbidden words without a correction', async () => {
    await using sandbox = await testdir();
    const paths = [
        'space name.txt',
        `${TYPO.the}.txt`,
        ...(process.platform === 'win32' ? [] : ['name:part.txt', 'line\nbreak.txt']),
    ];
    await createFileTree(sandbox.path, {
        'native.toml': '[default.extend-words]\nforbidden = ""\n',
        'nested/word.txt': 'forbidden\n',
        ...Object.fromEntries(paths.map((path) => [`nested/${path}`, `café ${TYPO.the}\n`])),
    });
    const configuration = join(sandbox.path, 'native.toml');
    const spec = kitManifests()
        .get('spelling')!
        .checks.find((check) => check.name === 'spelling/typos')!;
    const cwd = join(sandbox.path, 'nested');
    const typos = ['typos', '--isolated', '--config', configuration, '--format', 'json', 'word.txt'];
    const options = { cwd, stdout: 'pipe', stderr: 'pipe', timeout: 30_000 } as const;
    const native = Bun.spawnSync([...typos, ...paths], options);
    expect(native.exitCode, native.stderr.toString()).toBe(2);
    const findings = parseOutput(spec, native.stdout.toString(), native.stderr.toString(), sandbox.path, cwd);
    for (const path of paths)
        expect(findings).toContainEqual(containing({ file: `nested/${path}`, line: 1, column: 6, fixable: true }));
    expect(findings).toStrictEqual(
        containingAll([
            containing({
                file: `nested/${TYPO.the}.txt`,
                message: `Filename: \`${TYPO.the}\` should be \`the\``,
                fixable: false,
            }),
            containing({
                file: 'nested/word.txt',
                line: 1,
                column: 1,
                fixable: false,
                message: '`forbidden` is not allowed',
            }),
        ]),
    );
    expect(isToolBroken(spec, findings, [sandbox.path])).toBe(false);
    for (const path of paths) await Bun.write(join(cwd, path), 'café the\n');
    await Bun.write(join(cwd, 'word.txt'), 'permitted\n');
    renameSync(join(cwd, `${TYPO.the}.txt`), join(cwd, 'the.txt'));
    const renamed = paths.map((path) => (path === `${TYPO.the}.txt` ? 'the.txt' : path));
    const corrected = Bun.spawnSync([...typos, ...renamed], options);
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
    expect(
        parseOutput(spec, corrected.stdout.toString(), corrected.stderr.toString(), sandbox.path, cwd),
    ).toStrictEqual([]);
});
