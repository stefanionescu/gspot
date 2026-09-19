// apply --lower-baselines: a held count is no zero, and a check that did not run keeps its baseline.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, script, toolsPath } from '#tests/harness/planted.ts';

const INIT = ['init', '--yes', '--presets', 'bash', '--runner', 'none', '--ci', 'none', '--no-rules', '--no-install'];
const CLEAN = script.replace('main() {', () => '# main: runs the script.\nmain() {');
const LONE_FILE = '.gspot/baselines/structure.single-file-folder.lone-file.json';
const CONTAINER = '.gspot/baselines/structure.folder-names.container-name.json';

describe('apply --lower-baselines', () => {
    test(
        'held findings keep their baselines, after a run of one check and after a full run',
        async () => {
            await using fixture = await createFixture({
                'tools/only/one.sh': CLEAN,
                'helpers/first.sh': CLEAN,
                'helpers/second.sh': CLEAN,
            });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['shellcheck', 'shfmt', 'typos', 'ec', 'ast-grep']) };
            await install(fixture.path, INIT, environment);
            expect(existsSync(join(fixture.path, LONE_FILE))).toBe(true);
            expect(existsSync(join(fixture.path, CONTAINER))).toBe(true);

            run(fixture.path, ['check', 'structure/folder-names', '--no-cache'], environment);
            const partial = run(fixture.path, ['apply', '--lower-baselines'], environment);
            expect(partial.stdout).toContain('kept     structure/single-file-folder:lone-file');
            expect(existsSync(join(fixture.path, LONE_FILE))).toBe(true);
            expect(existsSync(join(fixture.path, CONTAINER))).toBe(true);

            // A full run holds both rules, and a held count is a count: lowering finds nothing to change.
            run(fixture.path, ['check', '--no-cache'], environment);
            const full = run(fixture.path, ['apply', '--lower-baselines'], environment);
            expect(full.stdout).not.toContain('removed');
            expect(existsSync(join(fixture.path, LONE_FILE))).toBe(true);
            expect(existsSync(join(fixture.path, CONTAINER))).toBe(true);

            run(fixture.path, ['check', '--staged', '--no-cache'], environment);
            const narrowed = run(fixture.path, ['apply', '--lower-baselines'], environment);
            expect(narrowed.code).toBe(2);
            expect(narrowed.stdout + narrowed.stderr).toContain('its counts are partial');
            expect(existsSync(join(fixture.path, LONE_FILE))).toBe(true);
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
