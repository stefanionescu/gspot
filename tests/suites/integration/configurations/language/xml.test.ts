import { test } from 'bun:test';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

const installedSandbox = shareInstalledSandbox({ configurations: ['xml'], files: {} });

test('xml/xmllint reports a malformed XML file and passes after the fix', async () => {
    await assertCheckSample(installedSandbox(), {
        check: 'xml/xmllint',
        files: { 'settings/feed.xml': '<feed>&missing;</feed>\n' },
        expected: { file: 'settings/feed.xml', line: 1 },
        corrected: { files: { 'settings/feed.xml': '<feed>&amp;</feed>\n' } },
    });
});
