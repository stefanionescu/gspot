import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import type { CheckSpec } from '#types/manifest.ts';
import { isToolBroken } from '#cli/run/broken-tool.ts';
import { parseOutput } from '#cli/run/parse-output.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';

describe('tool output across platforms', () => {
    test('ShellCheck diagnostics retain their path, position, and rule with either line ending', async () => {
        await using fixture = await createFixture({ 'scripts/café build.sh': 'echo $1\n' });
        const spec = presetManifests()
            .get('bash')!
            .checks.find((check) => check.id === 'bash/shellcheck')!;
        const path = join('scripts', 'café build.sh');
        for (const ending of ['\n', '\r\n']) {
            const output = `${path}:1:6: note: Double quote to prevent globbing and word splitting. [SC2086]${ending}`;
            const findings = parseOutput(spec, '', output, fixture.path);
            expect(findings).toHaveLength(1);
            expect(findings[0]).toMatchObject({ file: 'scripts/café build.sh', line: 1, column: 6, rule: 'SC2086' });
            expect(isToolBroken(spec, findings, [fixture.path])).toBe(false);
        }
    });

    test('XML diagnostics with carriage returns remain findings on real files', async () => {
        await using fixture = await createFixture({ 'settings/feed.xml': '<feed><entry></feed>\n' });
        const spec = presetManifests()
            .get('config-files')!
            .checks.find((check) => check.id === 'config-files/xml')!;
        const findings = parseOutput(
            spec,
            '',
            'settings/feed.xml:1: parser error : Opening and ending tag mismatch\r\n',
            fixture.path,
        );
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ file: 'settings/feed.xml', line: 1 });
        expect(isToolBroken(spec, findings, [fixture.path])).toBe(false);
    });

    test('Taplo reports one finding from a diff, a log entry, or both', async () => {
        await using fixture = await createFixture({ 'settings/café.toml': 'a=1\n' });
        const spec = presetManifests()
            .get('config-files')!
            .checks.find((check) => check.id === 'config-files/toml-format')!;
        const path = join(fixture.path, 'settings', 'café.toml');
        const diff = `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-a=1\n+a = 1\n`;
        const log = `ERROR taplo:format_files: the file is not properly formatted path="${path}"\n`;
        for (const [stdout, stderr] of [
            [diff, 'INFO loaded configuration\n'],
            ['', log],
            [diff, log],
        ]) {
            const findings = parseOutput(spec, stdout!, stderr!, fixture.path);
            expect(findings).toHaveLength(1);
            expect(findings[0]).toMatchObject({ file: 'settings/café.toml', fixable: true });
            expect(isToolBroken(spec, findings, [fixture.path])).toBe(false);
        }
    });

    test('grouped output strips line endings and relativizes native absolute paths', async () => {
        await using fixture = await createFixture({ 'settings/café.toml': 'a=1\n' });
        const base = presetManifests()
            .get('config-files')!
            .checks.find((check) => check.id === 'config-files/toml-format')!;
        const spec: CheckSpec = { ...base, output: { format: 'grouped' } };
        const output = `${join(fixture.path, 'settings', 'café.toml')}:\r\n  1: Incorrect spacing\r\n`;
        const findings = parseOutput(spec, output, '', fixture.path);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ file: 'settings/café.toml', line: 1, message: 'Incorrect spacing' });
    });
});
