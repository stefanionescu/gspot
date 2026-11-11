import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { BASE_INSTALLED_FILES } from '#tests/config/integration/commands.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildSandboxChanges, writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

const AUTOPLAY_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Example</title></head>
<body>
<main>
<h1>Example</h1>
<audio src="sound.ogg" autoplay controls></audio>
<video src="movie.mp4" autoplay controls></video>
</main>
</body>
</html>
`;

const CONTROLLED_PLAYBACK_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Example</title></head>
<body>
<main>
<h1>Example</h1>
<audio src="sound.ogg" controls></audio>
<video src="movie.mp4" controls></video>
</main>
</body>
</html>
`;

const HTML_SANDBOX = {
    configurations: ['html', 'site'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;

const installedSandbox = shareInstalledSandbox(HTML_SANDBOX);

test('html/html-validate reports audio and video autoplay and accepts user-controlled playback', async () => {
    const { root } = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['html'], { level: 'all' }),
        'index.html': AUTOPLAY_PAGE,
    };
    await using _sourceChange = await writeSandboxChanges(
        installedSandbox(),
        buildSandboxChanges(HTML_SANDBOX.files, sourceFiles),
    );

    const command = ['check', 'index.html', '--json', '--only', 'html/html-validate'];
    const checked = parseCheckReport(await spawnGspot(root, command));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.report.checks).toMatchObject([
        {
            check: 'html/html-validate',
            scope: '',
            status: 'failed',
            findings: [
                matchFields({ file: 'index.html', line: 7, column: 24, rule: 'no-autoplay' }),
                matchFields({ file: 'index.html', line: 8, column: 24, rule: 'no-autoplay' }),
            ],
        },
    ]);
    await writeFile(join(root, 'index.html'), CONTROLLED_PLAYBACK_PAGE);
    const corrected = parseCheckReport(await spawnGspot(root, command));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([
        { check: 'html/html-validate', scope: '', status: 'passed', findings: [] },
    ]);
});
