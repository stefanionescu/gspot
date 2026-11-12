import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { compareText } from '#cli/system/text.ts';
import { FRAMEWORK_COMPONENT_CASE, ROUTE_FILE_CASES } from '#tests/config/configurations/structure/files.ts';
import { LINGUIST_GENERATED_PATTERN } from '#tests/config/setup/programs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

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
    const { framework, name, folder, content } = FRAMEWORK_COMPONENT_CASE;
    const route = `${folder}/users/${name}`;
    const neighbor = `${folder}/teams/${name}`;
    const settings = buildSandboxSettings(['typescript', framework], { level: 'all' });
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        [route]: content,
        [neighbor]: content,
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/lone-files');
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
