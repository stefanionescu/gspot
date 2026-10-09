import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rename } from 'node:fs/promises';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { TYPO } from '#tests/config/samples/spelling.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { parseOutput } from '#cli/parsers/output/public.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { checkedFindings } from '#cli/execution/command/contracts.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';

// Uses the installed Markdown tool and emitted native configuration for both output contracts.
async function runMarkdown(root: string, paths: string[]) {
    const session = await openSession(root);
    const generated = emitAll(session);
    using log = openOwnership(root);
    writeGeneratedFiles(session, generated, log);
    const configuration = generated.files.find(({ path }) => path === '.gspot/config/markdownlint-cli2.mjs')!;
    const plans = planRun(session, { stage: 'all', only: ['markdown/markdownlint'], skips: [] });
    const planned = plans[0]!;
    const command = [
        'markdownlint-cli2',
        '--no-globs',
        '--config',
        configuration.path,
        ...paths.map((path) => `:${path}`),
    ];
    const failed = await runTestCommand(command, { cwd: root, env: { PATH: buildToolsPath(['markdownlint-cli2']) } });
    return { planned, command, failed };
}

test('native Markdown JSON preserves filename delimiters, positions, and fixability', async () => {
    await using sandbox = await testdir();
    const paths = ['space name.md', ...(isPosix ? ['name:5.md', 'line\nbreak.md'] : [])];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['markdown'], {
            level: 'all',
        }),
        ...Object.fromEntries(paths.map((path) => [path, 'café <img src="example.png">   \n'])),
    });
    const { planned, command, failed } = await runMarkdown(sandbox.path, paths);
    expect(failed.code, failed.stderr).toBe(1);
    const findings = parseOutput(planned.check, failed.stdout, failed.stderr, {
        root: sandbox.path,
        cwd: sandbox.path,
    });
    for (const file of paths) {
        expect(findings).toContainEqual(containing({ file, line: 1, column: 6, rule: 'MD045', fixable: false }));
        expect(findings).toContainEqual(containing({ file, line: 1, rule: 'MD009', fixable: true }));
        expect(findings).toContainEqual(containing({ file, line: 1, rule: 'MD041', fixable: false }));
    }
    for (const path of paths) await Bun.write(join(sandbox.path, path), '# Title\n');
    const corrected = await runTestCommand(command, {
        cwd: sandbox.path,
        env: { PATH: buildToolsPath(['markdownlint-cli2']) },
    });
    expect(corrected.code, corrected.stderr).toBe(0);
    expect(parseOutput(planned.check, corrected.stdout, '', { root: sandbox.path, cwd: sandbox.path })).toStrictEqual(
        [],
    );
});

test('native Markdown output refuses crashes and failures without attributed findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['markdown'], {
            level: 'all',
            tables: '[check."sandbox/markdown"]\ncommand = ["markdownlint-cli2"]\npaths = ["*.md"]\nstage = "commit"\nexit_codes = [1]\n[check."sandbox/markdown".output]\nformat = "markdownlint"\n',
        }),
        'sample.md': 'café <img src="example.png">   \n',
    });
    const { planned, failed } = await runMarkdown(sandbox.path, ['sample.md']);
    expect(failed.code, failed.stderr).toBe(1);
    const declared = planRun(await openSession(sandbox.path), {
        stage: 'all',
        only: ['sandbox/markdown'],
        skips: [],
    })[0]!;
    for (const check of [planned, declared]) {
        const findings = parseOutput(check.check, failed.stdout, failed.stderr, {
            root: sandbox.path,
            cwd: sandbox.path,
        });
        expect(checkedFindings(check, failed, { cwd: sandbox.path, root: sandbox.path })).toStrictEqual(findings);
        expect(() => checkedFindings(check, { ...failed, code: 2 }, { cwd: sandbox.path, root: sandbox.path })).toThrow(
            'exit 2',
        );
        expect(() =>
            checkedFindings(check, { ...failed, stdout: '[]' }, { cwd: sandbox.path, root: sandbox.path }),
        ).toThrow('exit 1');
    }
});

test('native spelling JSON retains filename delimiters, Unicode columns, and forbidden words without a correction', async () => {
    await using sandbox = await testdir();
    const paths = ['space name.txt', `${TYPO.the}.txt`, ...(isPosix ? ['name:part.txt', 'line\nbreak.txt'] : [])];
    await createFileTree(sandbox.path, {
        'native.toml': '[default.extend-words]\nforbidden = ""\n',
        'nested/word.txt': 'forbidden\n',
        ...Object.fromEntries(paths.map((path) => [`nested/${path}`, `café ${TYPO.the}\n`])),
    });
    const configuration = join(sandbox.path, 'native.toml');
    const check = configurationManifests()
        .get('spelling')!
        .checks.find((check) => check.name === 'spelling/typos')!;
    const cwd = join(sandbox.path, 'nested');
    const typos = ['typos', '--isolated', '--config', configuration, '--format', 'json', 'word.txt'];
    const options = { cwd, env: { PATH: buildToolsPath(['typos']) } };
    const native = await runTestCommand([...typos, ...paths], options);
    expect(native.code, native.stderr).toBe(2);
    const findings = parseOutput(check, native.stdout, native.stderr, {
        root: sandbox.path,
        cwd: cwd,
    });
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
    expect(
        checkedFindings({ check, manifest: configurationManifests().get('spelling')! }, native, {
            cwd,
            root: sandbox.path,
        }),
    ).toStrictEqual(findings);
    for (const path of paths) await Bun.write(join(cwd, path), 'café the\n');
    await Bun.write(join(cwd, 'word.txt'), 'permitted\n');
    await rename(join(cwd, `${TYPO.the}.txt`), join(cwd, 'the.txt'));
    const renamed = paths.map((path) => (path === `${TYPO.the}.txt` ? 'the.txt' : path));
    const corrected = await runTestCommand([...typos, ...renamed], options);
    expect(corrected.code, corrected.stderr).toBe(0);
    expect(parseOutput(check, corrected.stdout, corrected.stderr, { root: sandbox.path, cwd: cwd })).toStrictEqual([]);
});
