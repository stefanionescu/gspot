import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { environmentExecutable } from '#cli/platform/paths.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { licensesPackages } from '#cli/checks/general/licenses.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { installGeneratedPythonTools } from '#tests/harness/python-installation.ts';

test(
    'native Python license scanning ignores project scanner exclusions and matches an exception by its normalized name',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const files = {
            'gspot.toml': buildPolicy(['licenses'], { tables: '[licenses]\nallowed = ["MIT"]\n', level: 'all' }),
            'pyproject.toml':
                '[project]\nname = "fixture"\nversion = "0.0.0"\n[tool.pip-licenses]\nignore-packages = ["licensed-example"]\n',
        };
        await createFileTree(root, files);
        const environment = await runTestCommand(['uv', 'venv', '.venv'], { cwd: root });
        expect(environment.code, environment.stdout + environment.stderr).toBe(0);
        const applied = await runGspot(root, ['apply', '--json']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installGeneratedPythonTools(root);
        const location = await runTestCommand(
            [
                environmentExecutable(join(root, '.venv'), 'python'),
                '-I',
                '-c',
                'import sysconfig; print(sysconfig.get_path("purelib"))',
            ],
            { cwd: root },
        );
        expect(location.code, location.stderr).toBe(0);
        const metadata = join(location.stdout.trim(), 'licensed_example-1.0.0.dist-info/METADATA');
        await Bun.write(
            metadata,
            `Metadata-Version: 2.1\nName: licensed-example\nVersion: 1.0.0\nLicense: GPL-3.0-only\n`,
        );
        expect(await licensesPackages(buildCheckInput(await openSession(root), 'licenses/packages'))).toStrictEqual([
            containing({
                file: 'pyproject.toml',
                rule: 'disallowed-license',
                message: textContaining('licensed-example@1.0.0 reports GPL-3.0-only'),
            }),
        ]);
        await Bun.write(
            join(root, 'gspot.toml'),
            buildPolicy(['licenses'], {
                tables: '[licenses]\nallowed = ["MIT"]\n[[licenses.exceptions]]\npackage = "Licensed._Example@1.0.0"\nlicense = "GPL-3.0-only"\nreason = "Fixture tests exact reported license consent."\n',
                level: 'all',
            }),
        );
        const corrected = await runGspot(root, ['apply', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await licensesPackages(buildCheckInput(await openSession(root), 'licenses/packages'))).toStrictEqual([]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test(
    'native installed font metadata justifies its root exception in a descendant without a root manifest',
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['licenses'], {
                tables: 'run_with = "mise"\n[licenses]\nallowed = ["MIT"]\n[[licenses.exceptions]]\npackage = "@fontsource/inter@5.2.8"\nlicense = "OFL-1.1"\nreason = "Documentation distributes the font."\n[[scope]]\npath = "docs"\n',
            }),
            'docs/package.json': '{"name":"docs","private":true,"dependencies":{"@fontsource/inter":"5.2.8"}}',
            'docs/node_modules/@fontsource/inter/package.json':
                '{"name":"@fontsource/inter","version":"5.2.8","license":"OFL-1.1"}',
        });
        const applied = await runGspot(sandbox.path, ['apply', '--json']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const session = await openSession(sandbox.path);
        expect(await licensesPackages(buildCheckInput(session, 'licenses/packages'))).toStrictEqual([]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
