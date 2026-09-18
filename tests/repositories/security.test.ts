// Planted repository for the security preset: an eval the shipped pack finds, and a rule of the repository's own.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'typescript,security',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const CLEAN = 'export function double(value: number): number {\n    return value * 2;\n}\n';
const EVALUATED =
    'export function run(code: string): unknown {\n    // eslint-disable-next-line no-eval -- planted\n    return eval(code);\n}\n';
const OWN_RULE =
    'rules:\n    - id: planted-no-double\n      pattern: double(...)\n      message: The planted rule of the repository fires here.\n      languages: [typescript]\n      severity: ERROR\n';

describe('the security preset', () => {
    test(
        'the shipped pack finds an eval, a repository rule runs beside it, and CodeQL waits to be asked',
        async () => {
            await using fixture = await createFixture({
                'src/index.ts': CLEAN,
                'package.json': '{\n    "name": "planted",\n    "private": true\n}\n',
            });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['semgrep', 'typos', 'ec']) };
            await install(fixture.path, INIT, environment);
            const clean = run(fixture.path, ['check', 'security/semgrep', '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            await Bun.write(join(fixture.path, 'src/run.ts'), EVALUATED);
            commitAll(fixture.path);
            const found = run(fixture.path, ['check', 'security/semgrep', '--no-cache'], environment);
            expect(found.code, found.stdout + found.stderr).toBe(1);
            expect(found.stdout).toContain('node-no-eval');
            expect(found.stdout).toContain('src/run.ts:3');
            await Bun.write(join(fixture.path, 'security/own.yml'), OWN_RULE);
            await Bun.write(
                join(fixture.path, 'src/use.ts'),
                "import { double } from './index.ts';\n\nexport const four = double(2);\n",
            );
            const policy = join(fixture.path, 'gspot.toml');
            await Bun.write(
                policy,
                `${await Bun.file(policy).text()}\n[tools.semgrep]\nrules = ["security/own.yml"]\n`,
            );
            commitAll(fixture.path);
            const own = run(fixture.path, ['check', 'security/semgrep', '--no-cache'], environment);
            expect(own.stdout).toContain('planted-no-double');
            const atPush = JSON.parse(run(fixture.path, ['check', '--at', 'push', '--json'], environment).stdout) as {
                checks: { id: string }[];
            };
            const ids = atPush.checks.map((check) => check.id);
            expect(ids).toContain('security/semgrep');
            expect(ids).not.toContain('security/codeql');
            expect(ids).not.toContain('security/semgrep-registry');
        },
        PLANTED_TIMEOUT_MS * 3,
    );
});
