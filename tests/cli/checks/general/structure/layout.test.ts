import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { ROUTE_CASES } from '#tests/config/cli/checks/general/structure/layout.ts';

test('folder checks count code files and preserve ignored and nested directories', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], {
            tables: '[[ignore]]\ncheck = "structure/lone-files"\npaths = ["allowed/**", "parent/child/**"]\nreason = "Required entry directory."\n',
            level: 'all',
        }),
        'lone/only.ts': '',
        'typed/one.ts': '',
        'typed/one.d.ts': '',
        'module/one.mts': '',
        'module/one.d.mts': '',
        'pair/first.ts': '',
        'pair/second.ts': '',
        'component/logic.ts': '',
        'component/View.astro': '<main>Example</main>',
        'schema/parser.ts': '',
        'schema/schema.json': '{}',
        'parent/main.ts': '',
        'parent/child/first.ts': '',
        'parent/child/second.ts': '',
        'dist/pkg/lone.ts': '',
        'allowed/only.ts': '',
    });
    const result = await executeRun(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/lone-files'] }),
    );
    expect(result.report.exitCode).toBe(1);
    expect(result.report.checks.flatMap((check) => check.findings.map((finding) => finding.file))).toStrictEqual([
        'dist/pkg/lone.ts',
        'lone/only.ts',
        'module/one.mts',
        'typed/one.ts',
    ]);
});

test.each(['', 'nested'])('naming checks leave the harness folder of scope %j alone', async (scope) => {
    await using sandbox = await testdir();
    const prefix = scope === '' ? '' : `${scope}/`;
    const scopePolicy =
        scope === ''
            ? ''
            : `\n[scope."${scope}"]\nconfigurations = []\n[scope."${scope}".architecture.roles]\ntest_harness = "tests/helpers"\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'naming'], {
            tables: `[architecture.roles]\ntest_harness = "tests/helpers"\n${scopePolicy}`,
            level: 'all',
        }),
        [`${prefix}tests/helpers/startup.ts`]: '',
        [`${prefix}app/support/startup.ts`]: '',
        [`${prefix}app/python/startup.ts`]: '',
    });
    const result = await executeRun(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/folder-names', 'naming/paths'] }),
    );
    expect(result.report.checks.flatMap((check) => check.findings)).toMatchObject([
        { check: 'naming/paths', file: `${prefix}app/support/startup.ts`, line: 1, rule: 'banned-term' },
        { check: 'structure/folder-names', file: `${prefix}app/support/startup.ts`, line: 1, rule: 'container-name' },
    ]);
});

test('structural checks classify output directories by ownership at all', async () => {
    await using sandbox = await testdir();
    const authored = Object.fromEntries(
        ['build', 'dist', 'coverage'].flatMap((directory) => [
            [`${directory}/lone/only.ts`, ''],
            [`${directory}/cards/asset-one.ts`, ''],
            [`${directory}/cards/asset-two.ts`, ''],
        ]),
    );
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], {
            tables: '[[generated]]\npaths = ["emitted/**"]\nreason = "The compiler owns emitted files."\n',
            level: 'all',
        }),
        ...authored,
        'emitted/lone/only.ts': '',
        'emitted/cards/asset-one.ts': '',
        'emitted/cards/asset-two.ts': '',
    });
    const result = await executeRun(
        await openSession(sandbox.path),
        buildRunOptions({ stage: 'commit', only: ['structure/lone-files', 'structure/prefix-collisions'] }),
    );
    const findings = result.report.checks.flatMap((check) => check.findings);
    expect(findings.map(({ file }) => file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        ['build', 'dist', 'coverage']
            .flatMap((directory) => [`${directory}/lone/only.ts`, `${directory}/cards/asset-one.ts`])
            .toSorted((left, right) => left.localeCompare(right)),
    );
    expect(result.report.exitCode).toBe(1);
});

async function loneFiles(root: string): Promise<string[]> {
    const result = await executeRun(await openSession(root), buildRunOptions({ only: ['structure/lone-files'] }));
    return result.report.checks.flatMap((check) => check.findings.map((finding) => finding.file));
}

test.each(ROUTE_CASES)(
    '$framework $name route files need an explicit ignore and retain unignored neighbors',
    async ({ framework, name, directory, content }) => {
        await using sandbox = await testdir();
        const route = `${directory}/users/${name}`;
        const neighbor = `${directory}/teams/${name}`;
        const policy = buildPolicy(['typescript', framework], { level: 'all' });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'package.json': '{"name":"example","private":true,"type":"module"}\n',
            [route]: content,
            [neighbor]: content,
        });
        expect(await loneFiles(sandbox.path)).toStrictEqual([neighbor, route]);
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            policy +
                `[[ignore]]\ncheck = "structure/lone-files"\npaths = ["${route}"]\nreason = "The route file has the framework-required path."\n`,
        );
        expect(await loneFiles(sandbox.path)).toStrictEqual([neighbor]);
    },
);
