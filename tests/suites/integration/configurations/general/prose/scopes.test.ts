import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { PACKAGE_STYLE_CASES, PROSE_SANDBOX } from '#tests/config/integration/prose.ts';
import { GUIDE_READ_MARKDOWN, SCHEDULE_RELEASE_MARKDOWN } from '#tests/config/setup/configurations.ts';
import { listFindingRows, parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

const installedSandbox = shareInstalledSandbox(PROSE_SANDBOX);

test('prose/dates checks a child file once at the root', async () => {
    const { root } = installedSandbox();
    const path = 'child/only.md';
    await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings([], {
                level: 'all',
                scopes: [{ path: 'child', configurations: ['prose', 'docs'] }],
            }),
            [path]: SCHEDULE_RELEASE_MARKDOWN,
        },
    });

    const checked = parseCheckReport(await spawnGspot(root, ['check', path, '--only', 'prose/dates', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'failed' },
    ]);
    expect(listFindingRows(checked.report)).toStrictEqual([{ file: path, line: 3, rule: 'ambiguous-date' }]);
});

test('prose/vale at level all runs the gspot package rules without the Microsoft and Red Hat packages', async () => {
    const { root } = installedSandbox();
    const sample = PACKAGE_STYLE_CASES.map(({ sample }) => sample).join('\n\n') + '\n';
    const path = 'sample.md';
    const settings = buildSandboxSettings(['prose'], { level: 'all' });
    await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
        files: { 'gspot.toml': settings, [path]: sample },
    });

    const checked = parseCheckReport(await spawnGspot(root, ['check', path, '--only', 'prose/vale', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const expected = PACKAGE_STYLE_CASES.flatMap(({ findings }) =>
        findings.map(([line, rule]) => ({ file: path, line, rule })),
    );
    expect(listFindingRows(checked.report)).toStrictEqual(expected);
    await writeFile(join(root, path), GUIDE_READ_MARKDOWN);
    const corrected = parseCheckReport(await spawnGspot(root, ['check', path, '--only', 'prose/vale', '--json']));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ scope: '', status: 'passed', findings: [] }]);
});
