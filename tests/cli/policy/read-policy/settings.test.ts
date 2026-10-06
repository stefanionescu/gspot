import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { parse, stringify } from 'smol-toml';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policySchema } from '#cli/policy/schema/policy.ts';
import { buildPolicy, policyProblems } from '#tests/harness/policy.ts';
import { readPolicy, readPolicyText, parseStrictPolicy } from '#cli/policy/read.ts';

import {
    DISABLED_RULES,
    MALFORMED_REASON_CASES,
    REMOVED_STYLELINT_SETTING,
    REMOVED_FRAMEWORK_CONTROLS,
    INVALID_ENVIRONMENT_SETTINGS,
} from '#tests/config/cli/policy/read/settings.ts';

test.each(['recommended', 'all'] as const)(
    '%s validates environment declarations in root and scope tables',
    (level) => {
        for (const scope of ['', '[[scope]]\npath = "app"\n']) {
            const prefix = scope === '' ? '' : 'scope.';
            for (const { table, value, diagnostic } of INVALID_ENVIRONMENT_SETTINGS) {
                const source = buildPolicy([], { level, tables: `${scope}[${prefix}${table}]\n${value}\n` });
                expect(() => parseStrictPolicy(source)).toThrow(diagnostic);
            }
            const source = buildPolicy([], {
                level,
                tables: `${scope}[${prefix}env]\nreader_functions = { value = ["config.$env", "read_env"], reason = "These project functions own environment reads." }\ntemplates = { value = ["example.env"], reason = "This project declares its template filename." }\n`,
            });
            expect(policyProblems(source)).toStrictEqual([]);
        }
    },
);

test.each(
    MALFORMED_REASON_CASES.flatMap((entry) => [
        { ...entry, scoped: false, requireReasons: false },
        { ...entry, scoped: false, requireReasons: true },
        { ...entry, scoped: true, requireReasons: false },
        { ...entry, scoped: true, requireReasons: true },
    ]),
)(
    'a $name wrapper reason is refused before normalization with scoped=$scoped and require_reasons=$requireReasons',
    (entry) => {
        const site = { build: { value: 'npm run build', reason: entry.reason } };
        const document = {
            configurations: ['site'],
            require_reasons: entry.requireReasons,
            ...(entry.scoped ? { scope: [{ path: 'app', site }] } : { site }),
        };
        const source = stringify(document);
        const path = entry.scoped ? 'scope.0.site.build.reason' : 'site.build.reason';
        const diagnostic = `gspot.toml: ${path}: Invalid input: expected string, received ${entry.received}`;
        expect(policyProblems(source)).toStrictEqual([diagnostic]);
        expect(() => readPolicyText(source)).toThrow(diagnostic);
    },
);

describe('policy value normalization', () => {
    test('normalizes reasoned limits into value and reason', () => {
        const policy = parseStrictPolicy(
            `${buildPolicy(['bash'])}[limits]\nfile_lines = 300\nfunction_lines = { value = 80, reason = "Route tables are one ordered list each." }\n[limits.python]\nfile_lines = 400\n`,
        );
        expect(policy.limits.root['file_lines']).toStrictEqual({ value: 300 });
        expect(policy.limits.root['function_lines']).toStrictEqual({
            value: 80,
            reason: 'Route tables are one ordered list each.',
        });
        expect(policy.limits.groups['python']?.['file_lines']).toStrictEqual({ value: 400 });
    });

    test('normalizes per-language naming tables and categories', () => {
        const policy = parseStrictPolicy(
            `${buildPolicy(['bash'])}[naming]\nbanned = ["dispatcher"]\n[naming.python]\nmax_words = 4\n[naming.python.parameters]\nmax_words = { value = 3, reason = "Handler signatures read as one line." }\n`,
        );
        expect(policy.naming.banned).toStrictEqual(['dispatcher']);
        expect(policy.naming.languages['python']?.max_words).toStrictEqual({ value: 4 });
        expect(policy.naming.languages['python']?.categories['parameters']?.max_words?.reason).toBe(
            'Handler signatures read as one line.',
        );
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
        expect(corrected.problems).toStrictEqual([]);
        expect(corrected.policy.architecture.roles).toMatchObject({ types: ['types/**'], config: ['config/**'] });
    });

    test('an unknown key names its table', () => {
        const found = policyProblems(`${buildPolicy(['bash'])}[hooks]\npush_files = "all"\npsh = "all"\n`);
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('`psh` is not a setting gspot knows under [hooks]');
    });

    test('an ignore refuses a single-word reason and accepts a substantive reason', () => {
        const found = policyProblems(
            `${buildPolicy(['bash'])}require_reasons = true\n[[ignore]]\ncheck = "bash/shellcheck"\nreason = "N/A"\n`,
        );
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('needs a reason that says something');
        const corrected = parseStrictPolicy(
            `${buildPolicy(['bash'])}require_reasons = true\n[[ignore]]\ncheck = "bash/shellcheck"\nreason = "Reviewed fixture"\n`,
        );
        expect(corrected.ignores).toMatchObject([{ check: 'bash/shellcheck', reason: 'Reviewed fixture' }]);
    });

    test('a scoped disabled ESLint rule names the accepted-finding command and rule', () => {
        const found = policyProblems(
            buildPolicy(['javascript'], {
                tables: '[[scope]]\npath = "api"\n[scope.tools.eslint.rules]\n"unicorn/no-null" = "off"\n',
            }),
        );
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('scope.0.tools.eslint.rules.unicorn/no-null');
        expect(found[0]).toContain('gspot ignore');
        expect(found[0]).toContain('without a severity');
    });

    test('a verbatim table needs a reason', () => {
        expect(
            policyProblems(
                `${buildPolicy(['bash'])}require_reasons = true\n[tools.prettier.verbatim]\nuseTabs = false\nreason = ""\n`,
            )[0],
        ).toContain('[tools.prettier.verbatim] needs a `reason`');
    });
});

describe('authored scope and inventory policy', () => {
    test('nested and absent scopes retain authored policy', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'api/a.txt': '', 'api/inner/b.txt': '' });
        const text = `${buildPolicy(['bash'])}[[scope]]\npath = "api"\n[[scope]]\npath = "api/inner"\n[[scope]]\npath = "missing"\n`;
        expect(policyProblems(text, sandbox.path)).toStrictEqual([]);
        expect(parseStrictPolicy(text, sandbox.path).scopes.map((scope) => scope.path)).toStrictEqual([
            'api',
            'api/inner',
            'missing',
        ]);
        mkdirSync(join(sandbox.path, 'missing'));
        expect(policyProblems(text, sandbox.path)).toStrictEqual([]);
    });

    test('a vendored declaration needs a reason when required', () => {
        expect(
            policyProblems(`${buildPolicy(['bash'])}require_reasons = true\n[[vendored]]\npaths = ["vendor/**"]\n`)[0],
        ).toContain('needs a reason');
    });
});

describe('readPolicy', () => {
    test('a missing gspot.toml points at init', async () => {
        await using sandbox = await testdir();
        expect(() => readPolicy(sandbox.path)).toThrow('Run `gspot init`');
    });
});

describe('repository correction contracts', () => {
    const check = `${buildPolicy(['bash'])}[[check]]
name = "sandbox/fixer"
command = ["tool", "check"]
paths = ["source.txt"]
stage = "commit"
`;

    test('refuses an empty correction command', () => {
        expect(policyProblems(`${check}fix = []`)).toHaveLength(1);
        expect(policyProblems(`${check}fix = []`)[0]).toContain('check.0.fix');
        expect(policyProblems(`${check}fix = ["tool"]`)).toStrictEqual([]);
    });
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
    expect(authoredRaw.architecture).toStrictEqual({ modules: [], imports_allowed: [], roles: {} });
    expect(authoredRaw.structure).toStrictEqual({
        reexports: 'none',
        lone_files_allowed: [],
        prefix_collisions_allowed: [],
        folder_names_allowed: [],
        python: {},
    });
});

test.each(DISABLED_RULES)(
    'native $tool rule disabling names its actual ignore command: $value',
    ({ tool, configuration, rule, value, check }) => {
        const source = stringify({ configurations: [configuration], tools: { [tool]: { rules: { [rule]: value } } } });
        expect(() => parseStrictPolicy(source)).toThrow(`gspot ignore ${check} --rule ${rule}`);
        expect(() => readPolicyText(source)).toThrow(`gspot ignore ${check} --rule ${rule}`);
    },
);

test('native zero-valued Stylelint options and false Taplo formatting remain active options', () => {
    const source = stringify({
        configurations: ['css', 'files'],
        tools: { stylelint: { rules: { 'max-nesting-depth': 0 } }, taplo: { formatting: { reorder_keys: false } } },
    });
    const result = readPolicyText(source);
    expect(result.problems).toStrictEqual([]);
    expect(result.policy.tools).toMatchObject({
        stylelint: { rules: { 'max-nesting-depth': 0 } },
        taplo: { formatting: { reorder_keys: false } },
    });
});

test.each(REMOVED_FRAMEWORK_CONTROLS)(
    'root and scope refuse the removed $table.$key control',
    ({ table, key, diagnostic }) => {
        for (const prefix of ['', 'scope.']) {
            const scope = prefix === '' ? '' : '[[scope]]\npath = "api"\n';
            const source = buildPolicy(['nextjs', 'nestjs'], {
                tables: `${scope}[${prefix}${table}]\n${key} = true\n`,
            });
            expect(() => parseStrictPolicy(source)).toThrow(diagnostic);
            expect(policyProblems(source)).toHaveLength(1);
        }
    },
);

test('at-rule exceptions use native Stylelint options without a duplicate setting', () => {
    expect(() => parseStrictPolicy(buildPolicy(['css'], { tables: REMOVED_STYLELINT_SETTING }))).toThrow(
        'No selected configuration has the setting `tools.stylelint.ignore_at_rules`',
    );
    const native = buildPolicy(['css'], {
        tables: '[tools.stylelint.rules]\nat-rule-no-unknown = [true, { ignoreAtRules = ["container"] }]\n',
    });
    expect(policyProblems(native)).toStrictEqual([]);
});

test.each(['recommended', 'all'] as const)(
    '%s refuses native documentation link flags as extra coverage controls in every scope',
    (level) => {
        for (const scope of ['', '[[scope]]\npath = "app"\n']) {
            const table = scope === '' ? 'tools' : 'scope.tools';
            const owner = scope === '' ? 'tools.lychee' : 'scope.0.tools.lychee';
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
