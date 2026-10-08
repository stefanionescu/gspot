import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { parse, stringify } from 'smol-toml';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policySchema } from '#cli/policy/schema/policy.ts';
import { buildPolicy, policyFindings } from '#tests/harness/policy.ts';
import { readPolicy, readPolicyText, parseStrictPolicy } from '#cli/policy/read.ts';

import {
    DISABLED_RULES,
    MALFORMED_REASON_CASES,
    REMOVED_STYLELINT_SETTING,
    REMOVED_FRAMEWORK_CONTROLS,
    REMOVED_STRUCTURE_SETTINGS,
    INVALID_ENVIRONMENT_SETTINGS,
} from '#tests/config/cli/policy/read/settings.ts';

test.each(['recommended', 'all'] as const)(
    '%s validates environment declarations in root and scope tables',
    (level) => {
        for (const scope of ['', '[scope."app"]\n']) {
            const prefix = scope === '' ? '' : 'scope.app.';
            for (const { table, value, diagnostic } of INVALID_ENVIRONMENT_SETTINGS) {
                const source = buildPolicy([], { level, tables: `${scope}[${prefix}${table}]\n${value}\n` });
                expect(() => parseStrictPolicy(source)).toThrow(diagnostic);
            }
            const source = buildPolicy([], {
                level,
                tables: `${scope}[${prefix}secrets]\nreader_functions = ["config.$env", "read_env"]\nenv_examples = ["example.env"]\n`,
            });
            expect(policyFindings(source)).toStrictEqual([]);
        }
    },
);

test.each(
    MALFORMED_REASON_CASES.flatMap((entry) => [
        { ...entry, scoped: false },
        { ...entry, scoped: true },
    ]),
)('a $name reason is refused before normalization with scoped=$scoped', (entry) => {
    const values = { limits: { file_lines: 1000 }, reasons: { 'limits.file_lines': entry.reason } };
    const source = stringify({ configurations: [], ...(entry.scoped ? { scope: { app: values } } : values) });
    const path = entry.scoped ? 'scope.app.reasons.limits.file_lines' : 'reasons.limits.file_lines';
    const diagnostic = `gspot.toml: ${path}: Invalid input: expected string, received ${entry.received}`;
    expect(policyFindings(source)).toStrictEqual([diagnostic]);
    expect(() => readPolicyText(source)).toThrow(diagnostic);
});

describe('policy value normalization', () => {
    test('normalizes plain limits and their separate explanations', () => {
        const policy = parseStrictPolicy(
            `${buildPolicy(['bash'])}[limits]\nfile_lines = 300\nfunction_lines = 80\n[reasons]\n"limits.function_lines" = "Route tables are one ordered list each."\n"limits.python.file_lines" = "Python modules retain their project-specific size allowance."\n[limits.python]\nfile_lines = 400\n`,
        );
        expect(policy.limits.root['file_lines']).toBe(300);
        expect(policy.limits.root['function_lines']).toBe(80);
        expect(policy.limits.groups['python']?.['file_lines']).toBe(400);
    });

    test('normalizes per-language naming tables and categories', () => {
        const policy = parseStrictPolicy(
            `${buildPolicy(['bash'])}[naming]\nbanned = ["dispatcher"]\n[naming.python]\nmax_words = 4\n[naming.python.parameters]\nmax_words = 3\n[reasons]\n"naming.python.parameters.max_words" = "Handler signatures read as one line."\n`,
        );
        expect(policy.naming.banned).toStrictEqual(['dispatcher']);
        expect(policy.naming.languages['python']?.max_words).toBe(4);
        expect(policy.reasons['naming.python.parameters.max_words']).toBe('Handler signatures read as one line.');
    });
});

describe('policy setting refusals', () => {
    test.each(['types_directory', 'config_directory'])('%s refuses consumer folder enforcement', (setting) => {
        const source = stringify({ configurations: ['typescript'], architecture: { [setting]: 'types' } });
        expect(() => readPolicyText(source)).toThrow(
            `\`${setting}\` is not a setting gspot knows under [architecture]`,
        );
        const corrected = readPolicyText(
            stringify({
                configurations: ['typescript'],
                architecture: { roles: { types: ['types/**'], config: ['config/**'] } },
            }),
        );
        expect(corrected.errors).toStrictEqual([]);
        expect(corrected.policy.architecture.roles).toMatchObject({ types: ['types/**'], config: ['config/**'] });
    });

    test('an unknown key names its table', () => {
        const found = policyFindings(`${buildPolicy(['bash'])}[hooks]\npush_files = "all"\npsh = "all"\n`);
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('`psh` is not a setting gspot knows under [hooks]');
    });

    test('an ignore refuses a single-word reason and accepts a substantive reason', () => {
        const found = policyFindings(`${buildPolicy(['bash'])}[[ignore]]\ncheck = "bash/shellcheck"\nreason = "N/A"\n`);
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('needs a reason that says something');
        const corrected = parseStrictPolicy(
            `${buildPolicy(['bash'])}[[ignore]]\ncheck = "bash/shellcheck"\nreason = "Reviewed sandbox"\n`,
        );
        expect(corrected.ignore).toMatchObject([{ check: 'bash/shellcheck', reason: 'Reviewed sandbox' }]);
    });

    test('a scoped disabled ESLint rule names the accepted-finding command and rule', () => {
        const found = policyFindings(
            buildPolicy(['javascript'], {
                tables: '[scope."api"]\n[scope."api".tools.eslint.rules]\n"unicorn/no-null" = "off"\n',
            }),
        );
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('scope.api.tools.eslint.rules.unicorn/no-null');
        expect(found[0]).toContain('gspot ignore');
        expect(found[0]).toContain('without a severity');
    });

    test('a verbatim table needs a reason', () => {
        expect(
            policyFindings(`${buildPolicy(['bash'])}[tools.prettier.verbatim]\nuseTabs = false\nreason = ""\n`)[0],
        ).toContain('[tools.prettier.verbatim] needs an entry in [reasons]');
    });
});

describe('authored scope and inventory policy', () => {
    test('nested and absent scopes retain authored policy', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'api/a.txt': '', 'api/inner/b.txt': '' });
        const text = `${buildPolicy(['bash'])}[scope."api"]\n[scope."api/inner"]\n[scope."missing"]\n`;
        expect(policyFindings(text, sandbox.path)).toStrictEqual([]);
        expect(Object.keys(parseStrictPolicy(text, sandbox.path).scope)).toStrictEqual(['api', 'api/inner', 'missing']);
        await mkdir(join(sandbox.path, 'missing'));
        expect(policyFindings(text, sandbox.path)).toStrictEqual([]);
    });

    test('a vendored declaration needs a reason when required', () => {
        expect(policyFindings(`${buildPolicy(['bash'])}[[vendored]]\npaths = ["vendor/**"]\n`)[0]).toContain(
            'needs a reason',
        );
    });
});

test('a missing gspot.toml points at init', async () => {
    await using sandbox = await testdir();
    expect(() => readPolicy(sandbox.path)).toThrow('Run `gspot init`');
});

test('refuses an empty correction command', () => {
    const check = `${buildPolicy(['bash'])}[check."sandbox/fixer"]
    command = ["tool", "check"]
    paths = ["source.txt"]
    stage = "commit"
    `;
    expect(policyFindings(`${check}fix = []`)).toHaveLength(1);
    expect(policyFindings(`${check}fix = []`)[0]).toContain('check.sandbox/fixer.fix');
    expect(policyFindings(`${check}fix = ["tool"]`)).toStrictEqual([]);
});

test('schema defaults preserve absent and explicitly authored empty policy tables', () => {
    const absent = readPolicyText('configurations = []\n');
    const authored = readPolicyText('configurations = []\n[naming]\n[architecture]\n[structure]\n');
    expect({
        architecture: absent.policy.architecture,
        structure: absent.policy.structure,
        naming: absent.policy.naming,
    }).toStrictEqual({
        architecture: authored.policy.architecture,
        structure: authored.policy.structure,
        naming: authored.policy.naming,
    });
    const absentRaw = policySchema.parse(parse('configurations = []\n'));
    const authoredRaw = policySchema.parse(parse('configurations = []\n[naming]\n[architecture]\n[structure]\n'));
    expect({
        naming: absentRaw.naming,
        architecture: absentRaw.architecture,
        structure: absentRaw.structure,
    }).toStrictEqual({ naming: undefined, architecture: undefined, structure: undefined });
    expect(authoredRaw.architecture).toStrictEqual({});
    expect(authoredRaw.structure).toStrictEqual({});
});

test.each(DISABLED_RULES)(
    'native $rule disabling names its actual ignore command: $value',
    ({ tool, configuration, rule, value, check }) => {
        const source = stringify({ configurations: [configuration], tools: { [tool]: { rules: { [rule]: value } } } });
        expect(() => parseStrictPolicy(source)).toThrow(`gspot ignore ${check} --rule ${rule}`);
        expect(() => readPolicyText(source)).toThrow(`gspot ignore ${check} --rule ${rule}`);
    },
);

test('native zero-valued Stylelint options and false Taplo formatting remain active options', () => {
    const source = stringify({
        configurations: ['css', 'files'],
        tools: { stylelint: { rules: { 'max-nesting-depth': 0 } }, taplo: { verbatim: { reorder_keys: false } } },
        reasons: { 'tools.taplo.verbatim': 'This sandbox retains a native formatting option.' },
    });
    const result = readPolicyText(source);
    expect(result.errors).toStrictEqual([]);
    expect(result.policy.tools).toMatchObject({
        stylelint: { rules: { 'max-nesting-depth': 0 } },
        taplo: { verbatim: { reorder_keys: false } },
    });
});

test.each(REMOVED_FRAMEWORK_CONTROLS)(
    'root and scope refuse the removed $table.$key control',
    ({ table, key, diagnostic }) => {
        for (const prefix of ['', 'scope.api.']) {
            const scope = prefix === '' ? '' : '[scope."api"]\n';
            const source = buildPolicy(['nextjs', 'nestjs'], {
                tables: `${scope}[${prefix}${table}]\n${key} = true\n`,
            });
            expect(() => parseStrictPolicy(source)).toThrow(diagnostic);
            expect(policyFindings(source)).toHaveLength(1);
        }
    },
);

test('at-rule exceptions use native Stylelint options without a duplicate setting', () => {
    expect(() => parseStrictPolicy(buildPolicy(['css'], { tables: REMOVED_STYLELINT_SETTING }))).toThrow(
        '`ignore_at_rules` is not a setting gspot knows under [tools.stylelint]',
    );
    const native = buildPolicy(['css'], {
        tables: '[tools.stylelint.rules]\nat-rule-no-unknown = [true, { ignoreAtRules = ["container"] }]\n',
    });
    expect(policyFindings(native)).toStrictEqual([]);
});

test.each(['recommended', 'all'] as const)(
    '%s refuses native documentation link flags as extra coverage controls in every scope',
    (level) => {
        for (const scope of ['', '[scope."app"]\n']) {
            const table = scope === '' ? 'tools' : 'scope.app.tools';
            const owner = scope === '' ? 'tools.lychee' : 'scope.app.tools.lychee';
            for (const field of ['offline', 'include_fragments', 'scheme', 'accept'])
                expect(() =>
                    parseStrictPolicy(
                        buildPolicy([], {
                            level,
                            tables: `${scope}[${table}.lychee]\n${field} = false\n`,
                        }),
                    ),
                ).toThrow(`\`${field}\` is not a setting gspot knows under [${owner}]`);
            expect(() =>
                parseStrictPolicy(
                    buildPolicy([], {
                        level,
                        tables: `${scope}[${table}.lychee.verbatim]\noffline = true\nreason = "Project preference"\n`,
                    }),
                ),
            ).toThrow(`\`verbatim\` is not a setting gspot knows under [${owner}]`);
        }
    },
);

test.each(REMOVED_STRUCTURE_SETTINGS)('removed structure setting %s is refused in root and scope tables', (name) => {
    for (const scope of ['', '[scope."app"]\n']) {
        const table = scope === '' ? 'structure' : 'scope.app.structure';
        const source = buildPolicy(['typescript'], { tables: `${scope}[${table}]\n${name} = []\n` });
        expect(() => parseStrictPolicy(source)).toThrow(name);
    }
});
