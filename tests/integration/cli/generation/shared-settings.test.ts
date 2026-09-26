import { expect, test } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { containingAll } from '#tests/support/expectations.ts';
import { generatedFile } from '#tests/support/cli/generated-files.ts';

import {
    PYTHON,
    SHARED_SETTINGS_PACKAGE,
    TAILWIND_AT_RULES,
} from '#tests/constants/integration/cli/generation/generation.ts';

async function knipConfiguration(
    policy: string,
): Promise<{ entry: string[]; workspaces: Record<string, { entry: string[] }> }> {
    const content = await generatedFile(policy, '.gspot/config/knip.json', {
        'package.json': SHARED_SETTINGS_PACKAGE,
        'api/serve.js': '',
    });
    return JSON.parse(content) as { entry: string[]; workspaces: Record<string, { entry: string[] }> };
}

async function stylelintAtRules(policy: string): Promise<unknown> {
    const content = await generatedFile(policy, '.gspot/config/stylelint.json');
    return (JSON.parse(content) as { rules: Record<string, unknown> }).rules['at-rule-no-unknown'];
}

async function ruffLint(policy: string): Promise<{ select: string[]; 'per-file-ignores'?: Record<string, string[]> }> {
    const content = await generatedFile(policy, '.gspot/config/ruff.toml');
    return (parseToml(content) as { lint: { select: string[]; 'per-file-ignores'?: Record<string, string[]> } }).lint;
}

test('knip starts from the policy entries and the entry files the selected configurations declare', async () => {
    const policy =
        'version = 1\nconfigurations = ["javascript"]\n[tools.knip]\nentry = ["cli.js"]\n[[scope]]\npath = "api"\nconfigurations = ["javascript"]\n[scope.tools.knip]\nentry = ["serve.js"]\n';
    const knip = await knipConfiguration(policy);
    expect(knip.entry).toStrictEqual(containingAll(['cli.js', 'src/main.{ts,js}', 'build.ts']));
    expect(knip.entry).not.toContain('api/serve.js');
    expect(knip.workspaces['api']?.entry).toStrictEqual(containingAll(['serve.js', 'src/main.{ts,js}']));
    expect(knip.workspaces['api']?.entry).not.toContain('cli.js');
    const withoutEntries = await knipConfiguration('version = 1\nconfigurations = ["javascript"]\n');
    expect(withoutEntries.entry).toStrictEqual(containingAll(['src/main.{ts,js}']));
    expect(withoutEntries.entry).not.toContain('cli.js');
});

test('Stylelint accepts the at-rules a selected framework declares and the ones the policy adds', async () => {
    expect(await stylelintAtRules('version = 1\nconfigurations = ["css"]\n')).toBe(true);
    const withFramework = await stylelintAtRules('version = 1\nconfigurations = ["css", "nextjs"]\n');
    expect(withFramework).toStrictEqual([true, { ignoreAtRules: TAILWIND_AT_RULES }]);
    const widened = await stylelintAtRules(
        'version = 1\nconfigurations = ["css"]\n[tools.stylelint]\nignore_at_rules = ["container"]\n',
    );
    expect(widened).toStrictEqual([true, { ignoreAtRules: ['container'] }]);
});

test('Ruff selects the families the test runner and the framework declare, and ignores test rules only with a runner', async () => {
    const plain = await ruffLint(PYTHON);
    expect(plain.select).not.toContain('PT');
    expect(plain.select).not.toContain('FAST');
    expect(plain['per-file-ignores']).toBeUndefined();
    const tested = await ruffLint('version = 1\nconfigurations = ["python", "pytest"]\n');
    expect(tested.select.filter((family) => family === 'PT')).toStrictEqual(['PT']);
    expect(tested['per-file-ignores']).toStrictEqual({
        '**/tests/**': ['S101', 'ARG', 'PLR2004'],
        '**/test_*.py': ['S101', 'ARG', 'PLR2004'],
        '**/*_test.py': ['S101', 'ARG', 'PLR2004'],
        '**/conftest.py': ['S101', 'ARG', 'PLR2004'],
    });
    const served = await ruffLint('version = 1\nconfigurations = ["python", "fastapi"]\n');
    expect(served.select).toContain('FAST');
    expect(served['per-file-ignores']).toBeUndefined();
});

test('a policy ignore joins the runner ignores of the same test path', async () => {
    const lint = await ruffLint(
        'version = 1\nconfigurations = ["python", "pytest"]\n[[ignore]]\ncheck = "python/ruff"\nrule = "D103"\npaths = ["**/conftest.py"]\nreason = "Fixtures document themselves through their names."\n',
    );
    expect(lint['per-file-ignores']?.['**/conftest.py']).toStrictEqual(['S101', 'ARG', 'PLR2004', 'D103']);
});
