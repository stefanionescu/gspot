import { test, expect } from 'bun:test';
import { hookFiles } from '#cli/generation/hooks.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { scopeView } from '#cli/policy/settings/view.ts';
import { hookStatus } from '#cli/lifecycle/hooks-path.ts';
import { policySchema } from '#cli/policy/schema/policy.ts';
import { setKey, getScopeTable } from '#cli/policy/edit.ts';
import { knownSettings } from '#cli/policy/settings/known.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import { emitPolicy, parseTomlText } from '#cli/policy/file.ts';
import { declaredArchitectures } from '#cli/policy/settings/lookup.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

import {
    PATH_SCOPE_CASES,
    NATIVE_PATH_POLICY,
    PATH_ORIGINS_POLICY,
    POLICY_PUBLIC_REFUSALS,
    EFFECTIVE_ARCHITECTURE_POLICY,
} from '#tests/config/cli/policy/public-shape.ts';

test.each(POLICY_PUBLIC_REFUSALS)('the authored policy refuses superseded $key input', ({ source, key }) => {
    expect(policySchema.safeParse(parseTomlText(source, 'gspot.toml', 'policy')).success).toBe(false);
    expect(() => parseStrictPolicy(source)).toThrow(key);
});

test('scope and command maps retain literal identities through parsing, editing, and canonical writing', () => {
    const source = `runner = "mise"
test_files = ["qa/**"]
removed_configurations = ["swift"]

[scope."api.v1"]
configurations = ["python"]
removed_configurations = ["bash"]

[check."local.check"]
command = ["bun", "verify.ts"]
paths = ["**/*.ts"]
stage = "commit"
`;
    const raw = parseTomlText(source, 'gspot.toml', 'policy');
    setKey(getScopeTable(raw, 'api.v1'), 'test_files', ['verification/**']);
    const written = emitPolicy(source, raw);
    expect(written).toContain('[scope."api.v1"]');
    expect(written).toContain('[check."local.check"]');
    expect(emitPolicy(written, parseTomlText(written, 'gspot.toml', 'policy'))).toBe(written);
    const policy = parseStrictPolicy(written);
    expect(policy).toMatchObject({
        runner: 'mise',
        test_files: ['qa/**'],
        removed_configurations: ['swift'],
        scope: { 'api.v1': { configurations: ['python'], removed_configurations: ['bash'] } },
        scopeTables: { 'api.v1': { test_files: ['api.v1/verification/**'] } },
        check: { 'local.check': { name: 'local.check', command: ['bun', 'verify.ts'] } },
    });
    expect(policy).not.toHaveProperty('scopes');
    expect(policy).not.toHaveProperty('checks');
    expect(policy).not.toHaveProperty('ignores');
    expect(policy).not.toHaveProperty('agentRules');
});

test('scope validation reports the literal map key and its authored value position', () => {
    expect(() => parseStrictPolicy('[scope."api.v1"]\nconfigurations = ["imaginary"]\n')).toThrow(
        'scope.api.v1.configurations.0',
    );
});

test('scope path leaves normalize once while inherited roots and module identities retain their origin', () => {
    const policy = parseStrictPolicy(PATH_ORIGINS_POLICY);
    const manifests = configurationManifests();
    const selected = selectForScope(policy, 'app/worker', manifests);
    const view = scopeView(knownSettings(selected, policy.level), policy, selected, 'app/worker');
    expect(view.options('secrets').env_examples).toContain('root/.env.example');
    expect(view.options('secrets').env_examples).toContain('app/examples/.env');
    expect(view.options('secrets').env_examples).not.toContain('app/worker/app/examples/.env');
    expect(view.options('tools.eslint').runtimes).toStrictEqual({ '!app/private/**': 'browser' });
    expect(policy.scopeTables['app']?.architecture).toMatchObject({
        modules: [{ name: 'core', paths: ['app/core/**'] }],
        roles: { types: ['core', 'app/types/**'], test_harness: 'app/harness' },
    });
    expect(view.options('format').overrides).toStrictEqual([
        { paths: ['app/src/**', '!app/src/generated/**'], indent_width: 2 },
    ]);
    expect(policy.authored).toMatchObject({
        scope: {
            app: {
                test_files: ['tests/**'],
                secrets: { env_examples: ['examples/.env'] },
                tools: { eslint: { runtimes: { '!private/**': 'browser' } } },
                architecture: { roles: { types: ['core', 'types/**'], test_harness: 'harness' } },
            },
        },
    });
});

test('a hooks table needs its explicit enabled choice to generate or require hooks', () => {
    const policy = parseStrictPolicy('[hooks]\npush_files = "all"\n');
    expect(policy.hooks).toStrictEqual({ enabled: false, push_files: 'all' });
    expect(hookFiles('/repo', policy, '1.2.3')).toStrictEqual([]);
    expect(hookStatus({ policy, repository: { root: '/repo', hasGit: true } })).toStrictEqual({
        ready: true,
        text: 'none',
    });
    expect(parseStrictPolicy('[hooks]\nenabled = true\n').hooks?.enabled).toBe(true);
});

test('schema validation preserves authored absence while execution fills only declared defaults', () => {
    const raw = policySchema.parse({ hooks: {}, agent_rules: { own_rules_folder: 'instructions' } });
    expect(raw).toStrictEqual({ hooks: {}, agent_rules: { own_rules_folder: 'instructions' } });
    const policy = parseStrictPolicy('[hooks]\n[agent_rules]\nown_rules_folder = "instructions"\n');
    expect(policy.level).toBe('recommended');
    expect(policy.hooks).toStrictEqual({ enabled: false, push_files: 'changed' });
    expect(policy.agent_rules).toStrictEqual({
        enabled: true,
        folder: '.gspot/rules',
        exclude: [],
        instruction_files: [],
        own_rules_folder: 'instructions',
    });
});

test('root and scoped reasons must name a setting authored in their own table', () => {
    expect(() => parseStrictPolicy('[reasons]\nlevel = "The default is intentional."\n')).toThrow(
        'has no setting written',
    );
    expect(() =>
        parseStrictPolicy('level = "all"\n[scope."api.v1".reasons]\nlevel = "Inherited from the root."\n'),
    ).toThrow('scope.api.v1.reasons.level');
    const policy = parseStrictPolicy('level = "all"\n[reasons]\nlevel = "The project uses conventions."\n');
    expect(policy.reasons).toStrictEqual({ level: 'The project uses conventions.' });
});

test('module import edges name declared modules and preserve authored absence', () => {
    const text = `[[architecture.modules]]
name = "app"
paths = ["app/**"]
may_import = ["storage"]

[[architecture.modules]]
name = "storage"
paths = ["storage/**"]
`;
    const policy = parseStrictPolicy(text);
    expect(policy.architecture.modules).toStrictEqual([
        { name: 'app', paths: ['app/**'], may_import: ['storage'] },
        { name: 'storage', paths: ['storage/**'], may_import: [] },
    ]);
    expect(policy.authored).toMatchObject({ architecture: { modules: [{ name: 'app' }, { name: 'storage' }] } });
    expect(policy.authored).not.toHaveProperty('architecture.modules.1.may_import');
    expect(() => parseStrictPolicy(text.replace('may_import = ["storage"]', 'may_import = ["missing"]'))).toThrow(
        'architecture.modules.0.may_import.0',
    );
    expect(() =>
        parseStrictPolicy(text + '[[architecture.imports_allowed]]\nfrom = "app"\nto = ["storage"]\n'),
    ).toThrow('imports_allowed');
    expect(() => parseStrictPolicy(text.replace('paths = ["app/**"]', 'paths = [3]'))).toThrow(
        'architecture.modules.0.paths.0',
    );
});

test('architecture roles refuse misspellings and retain the declared harness name', () => {
    expect(() => parseStrictPolicy('[architecture.roles]\ntest_harnes = "tests/harness"\n')).toThrow('test_harnes');
    expect(() => parseStrictPolicy('[architecture.roles]\ntest_support = "tests/harness"\n')).toThrow('test_support');
    expect(
        parseStrictPolicy('[architecture.roles]\ntest_harness = "tests/harness"\n').architecture.roles,
    ).toStrictEqual({ test_harness: 'tests/harness' });
});

test('configuration-declared roles use the owning defaults and preserve raw authored absence', () => {
    const text = 'configurations = ["zustand"]\n';
    const policy = parseStrictPolicy(text);
    expect(policy.architecture.roles).toStrictEqual({});
    expect(policy.authored.architecture).toBeUndefined();
    const selected = selectForScope(policy, '', configurationManifests());
    const view = scopeView(knownSettings(selected), policy, selected, '');
    expect(view.roles.scripts).toStrictEqual(['scripts/**', '**/*.config.{js,mjs,cjs,ts}']);
    expect(view.roles.stores).toStrictEqual([
        '**/store.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
        '**/stores/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
        '**/store/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
        '**/*.store.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
    ]);
    expect(policy.authored.architecture).toBeUndefined();
});

test('a configuration role follows selected ancestor configurations and refuses an unrelated sibling owner', () => {
    expect(() =>
        parseStrictPolicy('configurations = ["bash"]\n[architecture.roles]\nscripts = ["scripts/**"]\n'),
    ).toThrow('not declared by a selected configuration');
    expect(() =>
        parseStrictPolicy(
            'configurations = ["javascript"]\n[scope."app".architecture.roles]\nscripts = ["scripts/**"]\n',
        ),
    ).not.toThrow();
    expect(() =>
        parseStrictPolicy(
            '[scope."web"]\nconfigurations = ["javascript"]\n[scope."other".architecture.roles]\nscripts = ["scripts/**"]\n',
        ),
    ).toThrow('not declared by a selected configuration');
});

test('test roles follow effective test files unless an authored role replaces them', () => {
    const policy = parseStrictPolicy(`configurations = ["javascript"]
test_files = ["qa/**"]
[scope.app]
test_files = ["checks/**"]
[scope.worker.architecture.roles]
tests = ["integration/**"]
`);
    const manifests = configurationManifests();
    for (const path of ['', 'app', 'worker']) {
        const selected = selectForScope(policy, path, manifests);
        const view = scopeView(knownSettings(selected), policy, selected, path);
        expect(view.roles.tests).toStrictEqual(path === 'worker' ? ['worker/integration/**'] : view.test_files);
        if (path !== 'worker') expect(view.test_files).toContain('qa/**');
        if (path === 'app') expect(view.test_files).toContain('app/checks/**');
    }
    expect(policy.authored).not.toHaveProperty('architecture');
    expect(policy.authored).not.toHaveProperty('scope.app.architecture');
});

test.each(PATH_SCOPE_CASES)(
    'scope $path retains inherited path origins and native empty disabling values',
    ({ path, functions, types, messages }) => {
        const policy = parseStrictPolicy(NATIVE_PATH_POLICY);
        const manifests = configurationManifests();
        const selected = selectForScope(policy, path, manifests);
        const view = scopeView(knownSettings(selected), policy, selected, path);
        expect(view.options('supabase')).toStrictEqual({
            functions_folder: functions,
            schemas: ['public'],
            types_file: types,
        });
        expect(view.options('i18n')).toStrictEqual({ base_locale: 'en', messages_folder: messages });
        expect(policy.authored).toMatchObject({
            scope: { app: { supabase: { types_file: 'database.ts' }, i18n: { messages_folder: 'translations' } } },
        });
    },
);

test('omitting defaults preserves path origins in every selected descendant', () => {
    const manifests = configurationManifests();
    const sources = [
        'configurations = ["supabase"]\n[supabase]\nfunctions_folder = "supabase/functions"\n[scope."apps/api"]\n',
        'configurations = ["supabase"]\n[scope.app.supabase]\nfunctions_folder = "supabase/functions"\n[scope."app/child"]\n',
        'configurations = ["supabase"]\n[supabase]\ntypes_file = ""\n[scope.app.supabase]\ntypes_file = ""\n[scope."app/child"]\n',
    ];
    for (const source of sources) {
        const before = parseStrictPolicy(source);
        const written = emitPolicy(source, parseTomlText(source, 'gspot.toml', 'policy'));
        const after = parseStrictPolicy(written);
        for (const path of ['', ...Object.keys(before.scope)]) {
            const selected = selectForScope(before, path, manifests);
            const surface = knownSettings(selected);
            expect(scopeView(surface, after, selected, path).options('supabase')).toStrictEqual(
                scopeView(surface, before, selected, path).options('supabase'),
            );
        }
        expect(emitPolicy(written, parseTomlText(written, 'gspot.toml', 'policy'))).toBe(written);
    }
});

test('effective architecture delivery inherits modules by field and preserves their authored path origin', () => {
    const policy = parseStrictPolicy(EFFECTIVE_ARCHITECTURE_POLICY);
    const manifests = configurationManifests();
    const scopes = ['', ...Object.keys(policy.scope)].map((path) => {
        const selected = selectForScope(policy, path, manifests);
        const surface = knownSettings(selected);
        return {
            scope: {
                path,
                name: path,
                configurations: policy.scope[path]?.configurations ?? [],
                source: 'gspot.toml' as const,
            },
            selected,
            surface,
            view: scopeView(surface, policy, selected, path),
        };
    });
    const architectures = declaredArchitectures(scopes);
    expect(architectures.map(({ selection }) => selection.scope.path)).toStrictEqual([
        '',
        'app',
        'app/child',
        'replaced',
        'worker',
    ]);
    for (const { selection, architecture } of architectures) {
        if (selection.scope.path === 'replaced') {
            expect(architecture.modules).toStrictEqual([
                { name: 'replacement', paths: ['replaced/src/**'], may_import: [] },
            ]);
            continue;
        }
        expect(architecture.modules).toStrictEqual([
            { name: 'client', paths: ['client/**'], may_import: [] },
            { name: 'storage', paths: ['storage/**'], may_import: [] },
        ]);
        expect(architecture.roles.tests).toStrictEqual(selection.view.test_files);
        if (selection.scope.path.startsWith('app')) expect(architecture.roles.types).toStrictEqual(['app/models/**']);
    }
    expect(policy.scope['worker']?.removed_configurations).toStrictEqual(['javascript']);
    expect(scopes.at(-1)?.selected.some(({ configuration }) => configuration.name === 'javascript')).toBe(false);
    expect(policy.authored).not.toHaveProperty('scope.app.architecture.modules');
});

test('native options named reason retain their values separately from the policy explanation', () => {
    const policy = parseStrictPolicy(`configurations = ["javascript"]
[tools.prettier.verbatim]
reason = false
[reasons]
"tools.prettier.verbatim" = "The sandbox preserves native option identity."
`);
    const manifests = configurationManifests();
    const selected = selectForScope(policy, '', manifests);
    const view = scopeView(knownSettings(selected), policy, selected, '');
    expect(view.verbatim('prettier')).toStrictEqual({ reason: false });
    expect(policy.reasons['tools.prettier.verbatim']).toBe('The sandbox preserves native option identity.');
});
