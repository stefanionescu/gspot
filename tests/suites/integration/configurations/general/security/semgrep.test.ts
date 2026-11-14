import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { runGitStep } from '#tests/setup/system/git.ts';
import { hasToolBuild } from '#tests/setup/cli/tools.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import type { Sandbox, SandboxChanges } from '#tests/types/setup.ts';
import { SEMGREP_SANDBOX } from '#tests/config/integration/general.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { changeSandbox, applyGeneratedFiles, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';

const REPOSITORY_RULE = `rules:
    - id: test-no-double
      pattern: double(...)
      message: The test rule of the repository fires here.
      languages: [typescript]
      severity: ERROR
`;

const REPOSITORY_BASH_RULE = `rules:
    - id: test-no-eval
      pattern: eval ...
      message: The test rule of the repository fires here.
      languages: [bash]
      severity: ERROR
`;

const MALFORMED_SEMGREP_RESULTS = [
    {
        check: 'security/semgrep',
        status: 'failed',
        findings: [{ file: 'scripts/café build.sh', line: 1, column: 1, rule: 'parse-error' }],
    },
] as const;

async function applyStagedSandboxChanges(sandbox: Sandbox, changes: SandboxChanges): Promise<AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    resources.use(await changeSandbox(sandbox, changes));
    runGitStep(sandbox.root, ['add', '--all']);
    await applyGeneratedFiles(sandbox.root);
    return resources.move();
}

describe.skipIf(!hasToolBuild('semgrep'))('semgrep', () => {
    const installedSandbox = shareInstalledSandbox(SEMGREP_SANDBOX);

    test('Semgrep reports a Bash file it cannot parse as a finding at its position', async () => {
        const sandbox = installedSandbox();
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['bash', 'security'], {
                tables: '[security]\nsemgrep_rules = ["security/own.yml"]\n',
            }),
            'scripts/café build.sh': BROKEN_IF_SCRIPT,
            'security/own.yml': REPOSITORY_BASH_RULE,
        };
        await using _sourceChange = await applyStagedSandboxChanges(
            sandbox,
            buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
        );
        const malformed = parseCheckReport(
            await spawnGspot(sandbox.root, ['check', '--only', 'security/semgrep', '--json']),
        );
        expect(malformed.code, malformed.stdout + malformed.stderr).toBe(1);
        expect(malformed.report.checks).toMatchObject([...MALFORMED_SEMGREP_RESULTS]);
        await writeFile(join(sandbox.root, 'scripts/café build.sh'), 'printf "%s\\n" ready\n');
        const corrected = parseCheckReport(
            await spawnGspot(sandbox.root, ['check', '--only', 'security/semgrep', '--json']),
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ check: 'security/semgrep', status: 'passed', findings: [] }]);
    });

    test('an authored rule file reports a finding through security/semgrep and passes after the fix', async () => {
        const sandbox = installedSandbox();
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['typescript', 'security'], {
                tables: '[security]\nsemgrep_rules = ["security/own.yml"]\n',
            }),
            'src/index.ts': `export function double(value: number): number {
    return value * 2;
}
`,
            'src/use.ts': "import { double } from './index.ts';\n\nexport const four = double(2);\n",
            'security/own.yml': REPOSITORY_RULE,
        };
        await using _sourceChange = await applyStagedSandboxChanges(
            sandbox,
            buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
        );
        const own = parseCheckReport(await spawnGspot(sandbox.root, ['check', '--only', 'security/semgrep', '--json']));
        expect(own.code, own.stdout + own.stderr).toBe(1);
        expect(own.report.checks).toMatchObject([{ check: 'security/semgrep', status: 'failed' }]);
        expect(listFindingRows(own.report)).toStrictEqual([{ file: 'src/use.ts', line: 3, rule: 'test-no-double' }]);
        await writeFile(join(sandbox.root, 'src/use.ts'), 'export const four = 4;\n');
        const corrected = parseCheckReport(
            await spawnGspot(sandbox.root, ['check', '--only', 'security/semgrep', '--json']),
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ check: 'security/semgrep', status: 'passed', findings: [] }]);
    });
});
