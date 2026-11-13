import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { DOCS_PATHS } from '#cli/config/manifests.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import { createTemporaryFolder } from '#cli/system/files/temporary.ts';
import { INVALID_LICENSES, REVIEWED_REASON, VALID_LICENSES } from '#tests/config/settings/parse.ts';
import {
    BOUNDARY_IMPORT_RULES,
    ORDERED_IMPORT_RULES,
    REFUSED_RULE_OPTIONS,
    REFUSED_SCOPE_PATHS,
} from '#tests/config/settings/validation.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';

function buildVendorPrefixSettings(ignoreProperties: string[]): string {
    return stringify({
        configurations: ['css'],
        tools: { stylelint: { rules: { 'property-no-vendor-prefix': [true, { ignoreProperties }] } } },
    });
}

test('property-no-vendor-prefix refuses an ignored property with no prefix, and accepts a prefixed name and a pattern', () => {
    expect(
        validateSettingsText(buildVendorPrefixSettings(['-webkit-backdrop-filter', 'text-size-adjust'])),
    ).toStrictEqual([
        'gspot.toml:4: tools.stylelint.rules.property-no-vendor-prefix.1.ignoreProperties.1: Stylelint matches text-size-adjust against the property as written, so it ignores nothing. Write the prefixed name, such as -webkit-text-size-adjust.',
    ]);
    expect(
        validateSettingsText(buildVendorPrefixSettings(['-webkit-backdrop-filter', '/text-size-adjust$/'])),
    ).toStrictEqual([]);
});

test.each(INVALID_LICENSES)('licenses.allowed refuses %s before running a check', (license) => {
    expect(
        validateSettingsText(stringify({ configurations: ['licenses'], licenses: { allowed: [license] } })),
    ).toStrictEqual([
        `gspot.toml:4: licenses.allowed.0: The value ${JSON.stringify(license)} is not valid for licenses.allowed.0. Use one SPDX license ID, such as MIT or Apache-2.0, not an AND or OR expression.`,
    ]);
});

test.each(VALID_LICENSES)('licenses.allowed accepts one SPDX license: %s', (license) => {
    expect(
        validateSettingsText(stringify({ configurations: ['licenses'], licenses: { allowed: [license] } })),
    ).toStrictEqual([]);
});

test('two import rules cannot share a name', () => {
    const lower = { name: 'lower', paths: ['lower/**'], can_import: [] };
    const upper = { name: 'lower', paths: ['upper/**'], can_import: ['lower'] };
    expect(validateSettingsText(stringify({ import_rule: [lower, upper] }))).toStrictEqual([
        'gspot.toml:7: import_rule.1.name: Two [[import_rule]] records name lower. Keep one.',
    ]);
    expect(validateSettingsText(stringify({ import_rule: [lower, { ...upper, name: 'upper' }] }))).toStrictEqual([]);
});

test('an ignore of ansible/ansible-lint-production is refused and names ansible/ansible-lint', () => {
    const text = `configurations = ["ansible"]\n[[ignore]]\ncheck = "ansible/ansible-lint-production"\nreason = "${REVIEWED_REASON}"\n`;
    expect(validateSettingsText(text)).toStrictEqual([
        'gspot.toml:3: ignore.0.check: There is no check called ansible/ansible-lint-production. Did you mean ansible/ansible-lint?',
    ]);
});

test('unknown configurations are refused where they are written, with a suggestion', () => {
    const text = buildSandboxSettings(['bas', 'bash', 'bas'], {
        rules: true,
        scopes: [{ path: 'api', configurations: ['pythonn', 'bas'] }],
        tables: '[removed_configurations]\npython3 = "The sample needs no Python checks."\n',
    });
    const list = `See ${DOCS_PATHS.configurations} for the available configurations.`;
    expect(validateSettingsText(text)).toStrictEqual([
        `gspot.toml:1: configurations.0: There is no configuration called bas. Did you mean bash, supabase? ${list}`,
        `gspot.toml:1: configurations.2: There is no configuration called bas. Did you mean bash, supabase? ${list}`,
        `gspot.toml:5: scope.0.configurations.0: There is no configuration called pythonn. Did you mean python? ${list}`,
        `gspot.toml:5: scope.0.configurations.1: There is no configuration called bas. Did you mean bash, supabase? ${list}`,
        `gspot.toml:7: removed_configurations.python3: There is no configuration called python3. Did you mean python? ${list}`,
    ]);
});

test('can_import names only declared rules', () => {
    expect(
        validateSettingsText(BOUNDARY_IMPORT_RULES.replace('can_import = ["storage"]', 'can_import = ["missing"]')),
    ).toStrictEqual(['gspot.toml:8: import_rule.1.can_import.0: There is no import rule called missing.']);
});

test('an import rule refuses a leading ! and accepts an extglob', () => {
    using sandbox = createTemporaryFolder();
    const refused = ORDERED_IMPORT_RULES.replace('["app/**"]', '["app/**", "!app/generated.ts"]');
    expect(validateSettingsText(refused)).toStrictEqual([
        'gspot.toml:7: import_rule.1.paths.1: The import rule app cannot exclude !app/generated.ts. Put a narrower rule for those files first, and list what it may import in can_import.',
    ]);
    const extglobs = ['app/!(procedures).*', '!(procedures)/**'];
    const text = ORDERED_IMPORT_RULES.replace('["app/**"]', () => JSON.stringify(extglobs));
    const settings = parseSettings(text, sandbox.path);
    expect(settings.import_rule[1]?.paths).toStrictEqual(extglobs);
});

test('an ignore without check needs paths and takes no rule', () => {
    using sandbox = createTemporaryFolder();
    const reason = 'Product photos and facts are data, not code.';
    const settings = parseSettings(`[[ignore]]\npaths = ["assets/products/**"]\nreason = "${reason}"\n`, sandbox.path);
    expect(settings.ignore).toStrictEqual([{ paths: ['assets/products/**'], reason }]);
    expect(validateSettingsText(`[[ignore]]\nreason = "${reason}"\n`)).toStrictEqual([
        'gspot.toml:1: ignore.0.paths: An ignore without check needs paths.',
    ]);
    expect(
        validateSettingsText(`[[ignore]]\nrule = "no-console"\npaths = ["a/**"]\nreason = "${reason}"\n`),
    ).toStrictEqual([
        'gspot.toml:2: ignore.0.rule: An ignore without check cannot name a rule. Add the check that owns the rule.',
    ]);
});

test.each([...REFUSED_SCOPE_PATHS])('scope refuses the path %j', (path, guidance) => {
    const errors = validateSettingsText(stringify({ scope: [{ path }] }));
    expect(new Set(errors)).toStrictEqual(
        new Set([
            `gspot.toml:2: scope.0.path: The value ${JSON.stringify(path)} is not valid for scope.0.path. ${guidance}`,
        ]),
    );
});

test.each([...REFUSED_RULE_OPTIONS])(
    '$tool rule settings refuse a severity with one line that names gspot ignore: $toml',
    ({ configuration, toml, start, command }) => {
        const text = buildSandboxSettings([configuration], { rules: true, tables: toml });
        const errors = validateSettingsText(text);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toStartWith(start);
        expect(errors[0]).toContain(command);
    },
);

test('the freeze cutoff refuses a word that is not none, all, or a version', () => {
    const errors = validateSettingsText('configurations = ["postgres"]\n[postgres]\nfrozen_through = "latest"\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toStartWith(
        'gspot.toml:3: postgres.frozen_through: The value "latest" is not valid for postgres.frozen_through.',
    );
});
