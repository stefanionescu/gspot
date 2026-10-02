import { test, expect } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { kitManifests } from '#cli/kits/manifests.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { containingAll } from '#tests/harness/expectations.ts';
import { generatedFile } from '#tests/harness/cli/generated.ts';

// What the kits declare, read from their manifests so the test pins no copy of shipped lists.
const MANIFESTS = kitManifests();
const ENTRY = MANIFESTS.get('javascript')!.entry_files[0]!;
const TAILWIND_AT_RULES = MANIFESTS.get('nextjs')!.defaults['tools.stylelint.ignore_at_rules'];
const PYTEST = MANIFESTS.get('pytest')!.defaults;
const TEST_FILES = PYTEST['tools.ruff.test_files'] as string[];
const TEST_IGNORES = PYTEST['tools.ruff.test_ignores'] as string[];
const KNIP = '.gspot/config/knip.json';
const STYLELINT = '.gspot/config/stylelint.json';
const RUFF = '.gspot/config/ruff.toml';
const PYTHON = policyOf(['python']);

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every case reads one generated configuration, JSON or TOML, through this.
async function generatedDocument<Shape>(
    policy: string,
    path: string,
    files: Record<string, string> = {},
): Promise<Shape> {
    const content = await generatedFile(policy, path, files);
    return (path.endsWith('.toml') ? parseToml(content) : JSON.parse(content)) as Shape;
}

test('knip starts from the policy entries and the entry files the selected kits declare', async () => {
    const files = { 'package.json': '{"private":true,"type":"module"}\n', 'api/serve.js': '' };
    const policy = policyOf(
        ['javascript'],
        '[tools.knip]\nentry = ["cli.js"]\n[[scope]]\npath = "api"\nkits = ["javascript"]\n[scope.tools.knip]\nentry = ["serve.js"]\n',
    );
    const knip = await generatedDocument<{ entry: string[]; workspaces: Record<string, { entry: string[] }> }>(
        policy,
        KNIP,
        files,
    );
    expect(knip.entry).toStrictEqual(containingAll(['cli.js', ENTRY]));
    expect(knip.entry).not.toContain('api/serve.js');
    expect(knip.workspaces['api']?.entry).toStrictEqual(containingAll(['serve.js', ENTRY]));
    expect(knip.workspaces['api']?.entry).not.toContain('cli.js');
    const withoutEntries = await generatedDocument<{ entry: string[] }>(policyOf(['javascript']), KNIP, files);
    expect(withoutEntries.entry).toStrictEqual(containingAll([ENTRY]));
    expect(withoutEntries.entry).not.toContain('cli.js');
});

test.each([
    ['no framework', policyOf(['css']), true],
    ['the Next.js at-rules', policyOf(['css', 'nextjs']), [true, { ignoreAtRules: TAILWIND_AT_RULES }]],
    [
        'the at-rules the policy adds',
        policyOf(['css'], '[tools.stylelint]\nignore_at_rules = ["container"]\n'),
        [true, { ignoreAtRules: ['container'] }],
    ],
])('Stylelint accepts %s', async (_name, policy, expected) => {
    const stylelint = await generatedDocument<{ rules: Record<string, unknown> }>(policy, STYLELINT);
    expect(stylelint.rules['at-rule-no-unknown']).toStrictEqual(expected);
});

test('Ruff selects the families the test runner and the framework declare, and ignores test rules only with a runner', async () => {
    const plain = await generatedDocument<{ lint: { select: string[]; 'per-file-ignores'?: unknown } }>(PYTHON, RUFF);
    expect(plain.lint.select).not.toContain('PT');
    expect(plain.lint.select).not.toContain('FAST');
    expect(plain.lint['per-file-ignores']).toBeUndefined();
    const tested = await generatedDocument<{ lint: { select: string[]; 'per-file-ignores': unknown } }>(
        policyOf(['python', 'pytest']),
        RUFF,
    );
    expect(tested.lint.select).toStrictEqual(containingAll(PYTEST['tools.ruff.select'] as string[]));
    expect(tested.lint['per-file-ignores']).toStrictEqual(
        Object.fromEntries(TEST_FILES.map((path) => [path, TEST_IGNORES])),
    );
    const served = await generatedDocument<{ lint: { select: string[]; 'per-file-ignores'?: unknown } }>(
        policyOf(['python', 'fastapi']),
        RUFF,
    );
    expect(served.lint.select).toContain('FAST003');
    expect(served.lint['per-file-ignores']).toBeUndefined();
});

test('a policy ignore joins the runner ignores of the same test path', async () => {
    const ignored = await generatedDocument<{ lint: { 'per-file-ignores': Record<string, string[]> } }>(
        policyOf(
            ['python', 'pytest'],
            '[[ignore]]\ncheck = "python/ruff"\nrule = "D103"\npaths = ["**/conftest.py"]\nreason = "Fixtures document themselves through their names."\n',
        ),
        RUFF,
    );
    expect(ignored.lint['per-file-ignores']['**/conftest.py']).toStrictEqual([...TEST_IGNORES, 'D103']);
});
