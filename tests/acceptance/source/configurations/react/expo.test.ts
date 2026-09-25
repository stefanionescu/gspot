// Planted React Native repository for Expo Doctor: it waits for the push stage, fails where it cannot read the project, and is skipped in a scope without expo.
import { symlinkSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';

const MODULES = join(import.meta.dir, '../../../../../node_modules');
const DOCTOR = ['--no-cache', '--json', '--only', 'react-native/expo-doctor'];
const INIT = ['init', '--yes', '--configurations', 'typescript', 'react-native', '--without', 'naming', 'spelling'];
const PACKAGE =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "expo": "54.0.0",\n        "react": "19.1.1",\n        "react-native": "0.81.4"\n    }\n}\n';

test(
    'react-native/expo-doctor waits for push, fails where it cannot read the project, and skips a scope without expo',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gitignore': 'node_modules\n',
            'package.json': PACKAGE,
            'src/answer.ts':
                '// A value the planted files build on.\n\n/** The answer. */\nexport const answer = 42;\n',
        });
        symlinkSync(MODULES, join(sandbox.path, 'node_modules'));
        commitAll(sandbox.path);
        const environment = { PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}` };
        const quiet = ['css', 'vitest', '--no-runner', '--no-ci', '--no-hooks', '--no-rules', '--no-install'];
        await install(sandbox.path, [...INIT, ...quiet], environment);
        const committed = await run(sandbox.path, ['check', '--stage', 'commit', ...DOCTOR], environment);
        expect(committed.code, committed.stdout + committed.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(committed.stdout)).checks).toStrictEqual([]);
        const pushed = await run(sandbox.path, ['check', '--stage', 'push', ...DOCTOR], environment);
        expect(pushed.code, pushed.stdout + pushed.stderr).not.toBe(0);
        const [doctor] = reportSchema.parse(JSON.parse(pushed.stdout)).checks;
        expect(['fail', 'error'], pushed.stdout).toContain(doctor!.status);
        await Bun.write(join(sandbox.path, 'package.json'), PACKAGE.replace('        "expo": "54.0.0",\n', ''));
        const plain = await run(sandbox.path, ['check', '--stage', 'push', ...DOCTOR], environment);
        expect(plain.code, plain.stdout + plain.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(plain.stdout)).checks).toMatchObject([
            {
                check: 'react-native/expo-doctor',
                status: 'skipped',
                note: expect.stringContaining('does not depend on expo'),
            },
        ]);
    },
    PLANTED_TIMEOUT_MS * 6,
);
