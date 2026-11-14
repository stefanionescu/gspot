import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { runChecks } from '#cli/engine/run/checks.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { compareText } from '#cli/system/text/order.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { ROUTE_FILE_CASES } from '#tests/config/configurations/structure/files.ts';
import { LINGUIST_GENERATED_PATTERN } from '#tests/config/configurations/general.ts';

test('lone-files and shared-prefixes check build, dist and coverage folders and skip folders marked linguist-generated', async () => {
    const authored = Object.fromEntries(
        ['build', 'dist', 'coverage'].flatMap((folder) => [
            [`${folder}/lone/only.ts`, ''],
            [`${folder}/cards/asset-one.ts`, ''],
            [`${folder}/cards/asset-two.ts`, ''],
        ]),
    );
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
        }),
        ...authored,
        '.gitattributes': LINGUIST_GENERATED_PATTERN,
        'emitted/lone/only.ts': '',
        'emitted/cards/asset-one.ts': '',
        'emitted/cards/asset-two.ts': '',
    });
    commitAll(sandbox.path);
    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ stage: 'commit', only: ['structure/lone-files', 'structure/shared-prefixes'] }),
    );
    const findings = result.report.checks.flatMap((check) => check.findings);
    expect(findings.map(({ file }) => file).toSorted(compareText)).toStrictEqual(
        ['build', 'dist', 'coverage']
            .flatMap((folder) => [`${folder}/lone/only.ts`, `${folder}/cards/asset-one.ts`])
            .toSorted(compareText),
    );
});

test('a lone astro component is reported once its framework is selected', async () => {
    const route = 'src/pages/users/index.astro';
    const neighbor = 'src/pages/teams/index.astro';
    const files = {
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        [route]: '<main>Example</main>\n',
        [neighbor]: '<main>Example</main>\n',
    };
    await using unselected = await createGitSandbox({
        ...files,
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
    });
    expect(await runSandboxCheck(unselected.path, 'structure/lone-files')).toStrictEqual([]);
    await using selected = await createGitSandbox({
        ...files,
        'gspot.toml': buildSandboxSettings(['typescript', 'astro'], { level: 'all' }),
    });
    const findings = await runSandboxCheck(selected.path, 'structure/lone-files');
    expect(findings.map((finding) => finding.file)).toStrictEqual([neighbor, route]);
});

test.each([...ROUTE_FILE_CASES])(
    'a folder with only a $framework route file is a route, not a lone file',
    async ({ configurations, files, expected }) => {
        await using sandbox = await createGitSandbox({
            ...files,
            'gspot.toml': buildSandboxSettings([...configurations], { level: 'all' }),
        });
        const findings = await runSandboxCheck(sandbox.path, 'structure/lone-files');
        expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
            { file: expected, rule: 'lone-file' },
        ]);
    },
);

test('a declaration file beside a source file leaves it lone', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'feature/api.ts': 'export const value = 1;\n',
        'feature/api.d.ts': 'export declare const other: number;\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/lone-files');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'feature/api.ts', rule: 'lone-file' },
    ]);
});
