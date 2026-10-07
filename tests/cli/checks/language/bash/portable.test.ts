import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { readRepository } from '#cli/repository/read.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { commitAll, markExecutable } from '#tests/harness/git.ts';
import { detectConfigurations } from '#cli/configurations/detect.ts';

import {
    NODE_EMBEDS,
    SIMPLE_EXECUTABLE,
    GENERATED_LAUNCHERS,
} from '#tests/config/cli/checks/language/bash/portable.ts';

test.each(NODE_EMBEDS)('inline Node has one diagnostic owner for %s', async (source) => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['bash'], { level: 'all' }),
        'source.sh': source,
    });
    const result = await runGspot(sandbox.path, ['check', '--only', 'bash/wrappers', 'bash/embeds', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const checks = (JSON.parse(result.stdout) as RunReport).checks;
    expect(checks.find(({ check }) => check === 'bash/wrappers')).toMatchObject({ status: 'passed', findings: [] });
    expect(checks.find(({ check }) => check === 'bash/embeds')?.findings).toMatchObject([
        { file: 'source.sh', line: 1, rule: 'runtime-embed' },
    ]);
    expect(checks.flatMap(({ findings }) => findings)).toHaveLength(1);
});

test.each(['recommended', 'all'] as const)(
    '%s accepts a small executable without functions or a prescribed constant declaration',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['bash'], { level }),
            'source.sh': SIMPLE_EXECUTABLE,
        });
        commitAll(sandbox.path);
        markExecutable(sandbox.path, 'source.sh');
        const command = ['check', '--only', 'bash/contract', '--json'];
        const clean = await runGspot(sandbox.path, command);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        if (level === 'recommended') {
            expect((JSON.parse(clean.stdout) as RunReport).checks).toStrictEqual([]);
            return;
        }
        expect((JSON.parse(clean.stdout) as RunReport).checks[0]).toMatchObject({ status: 'passed', findings: [] });
        await Bun.write(
            join(sandbox.path, 'source.sh'),
            SIMPLE_EXECUTABLE + 'greet() { printf "%s\\n" "$1"; }\ngreet "$@"\n',
        );
        const structured = await runGspot(sandbox.path, command);
        expect(structured.code, structured.stdout + structured.stderr).toBe(1);
        expect((JSON.parse(structured.stdout) as RunReport).checks[0]?.findings.map(({ rule }) => rule)).toStrictEqual([
            'main-function',
            'main-call',
        ]);
    },
);

test('generated Gradle and Maven launchers do not select Bash or receive source checks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { ...GENERATED_LAUNCHERS, 'gspot.toml': buildPolicy([]) });
    const session = await openSession(sandbox.path);
    expect(session.repository.files.filter(({ path }) => path !== 'gspot.toml').map(({ kind }) => kind)).toStrictEqual([
        'generated',
        'generated',
        'generated',
        'generated',
    ]);
    expect(
        session.scopes.flatMap(({ selected }) => selected.map(({ configuration }) => configuration.name)),
    ).not.toContain('bash');
    expect(
        detectConfigurations(session.repository.files, session.manifests, []).map(({ configuration }) => configuration),
    ).not.toContain('bash');
    const declared = await readRepository(sandbox.path, [{ paths: ['mvnw'], kind: 'vendored' }], [], []);
    expect(declared.files.find(({ path }) => path === 'mvnw')).toMatchObject({
        kind: 'vendored',
        kindSource: 'vendored',
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['bash']));
    const checked = await runGspot(sandbox.path, [
        'check',
        '--only',
        'bash/syntax',
        'bash/shellcheck',
        'bash/shfmt',
        '--json',
    ]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect((JSON.parse(checked.stdout) as RunReport).checks).toStrictEqual([]);
});
