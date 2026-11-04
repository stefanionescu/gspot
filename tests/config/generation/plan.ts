import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { COMMITLINT_PACKAGE, STYLELINT_PACKAGE_JSON } from '#tests/config/setup/configurations.ts';

export const PRESERVE_SOURCE = 'preserve this source\n';

export const REPLACED_PYPROJECT_TABLES = [
    {
        configuration: 'python',
        table: 'tool.basedpyright',
        text: '[tool.basedpyright]\ntypeCheckingMode = "basic"\n',
        source: { file: 'main.py', text: 'VALUE = 1\n' },
        generated: 'pyrightconfig.json',
    },
    {
        configuration: 'sql',
        table: 'tool.sqlfluff',
        text: '[tool.sqlfluff.core]\ndialect = "postgres"\n',
        source: { file: 'query.sql', text: 'SELECT 1;\n' },
        generated: `${GSPOT_PATHS.configurations}/language/sql/sqlfluff.cfg`,
    },
] as const;

export const INACTIVE_CONFIGURATIONS = {
    '.commitlintrc.json': '{"rules":{}}\n',
    '.commitlintrc.mts': 'export default { rules: {} };\n',
    '.syncpackrc.json': '{"versionGroups":[]}\n',
    '.syncpackrc.yaml': 'versionGroups: []\n',
    'package.json': COMMITLINT_PACKAGE,
} as const;

export const STYLELINT_REPLACEMENT_CASES = [
    {
        name: 'a root package field',
        scope: '',
        packageText: STYLELINT_PACKAGE_JSON,
        command: ['init', '--configurations', 'css'],
        changed: ['package.json'],
        unchangedFiles: [],
    },
    {
        name: 'a scoped package field',
        scope: 'app',
        packageText: STYLELINT_PACKAGE_JSON,
        command: ['init', '--no-configurations'],
        changed: ['app/package.json'],
        unchangedFiles: [],
    },
    {
        name: 'a standalone file',
        scope: '',
        packageText: '{"private":true,"type":"module"}',
        command: ['init', '--configurations', 'css'],
        changed: [],
        unchangedFiles: [{ path: 'package.json', text: '{"private":true,"type":"module"}' }],
    },
] as const;

export const LINKED_SETUP_CONFIG = `[flake8]
ignore = E501

[sqlfluff]
exclude_rules = LT01
`;

export const SQL_PACKAGE_FILES = {
    'README.md': '# test\n',
    'db/accounts.sql': 'SELECT 1;\n',
    'db/package.json': '{"private":true}',
    'db/.sqlfluffignore': '# Templates\ntemplates/\n',
} as const;

export const SHARED_SETUP_CONFIG = `[flake8]
ignore = E501

[sqlfluff]
exclude_rules = LT01, RF01
`;

export const REPLACED_CONFIG_DELETIONS = [
    { path: '.shellcheckrc' },
    { path: '.prettierrc' },
    { path: '.eslintrc.json' },
    { path: 'typos.toml' },
] as const;

export const HOOKS_PATH_CASES = [
    { hooksPath: '', line: 'existing hooks       none' },
    { hooksPath: 'hooks', line: 'existing hooks       hooks/  pre-commit, use-thing.ts (your own)' },
    { hooksPath: '.husky', line: 'existing hooks       .husky/  pre-commit (husky)' },
] as const;

export const HOOK_NAMED_SOURCE = 'export function useThing() { return true; }\n';

export const SYNCPACK_FILE = {
    file: '.syncpackrc.yaml',
    source: `versionGroups:
  - dependencies: [shared-library]
    isIgnored: true
`,
} as const;

export const GIT_PLAN_CASES = [{ name: 'a Git repository', changes: [] }] as const;

export const QUALITY_PACKAGE_FILES = {
    'package.json': '{"name":"shop","private":true,"type":"module","dependencies":{"react":"19.0.0"}}\n',
    'src/app.tsx': 'export const App = () => null;\n',
    'quality/package.json': '{"name":"shop-quality","private":true,"dependencies":{"ts-morph":"26.0.0"}}\n',
    'quality/check.ts': 'export const value = 1;\n',
    '.commitlintrc.json': '{"extends":["@commitlint/config-conventional"]}\n',
} as const;

const UNCOMMITTED_FORMAT_FILES = [
    { path: '.prettierrc', original: '{"printWidth": 100}\n', changed: '{"printWidth": 90}\n' },
] as const;

export const UNCOMMITTED_FORMAT_CASES = ['unborn Git', 'untracked', 'staged changes', 'unstaged changes'].flatMap(
    (state) => UNCOMMITTED_FORMAT_FILES.map((file) => ({ ...file, state })),
);

export const TOOL_ONLY_PACKAGE = '{"private":true,"devDependencies":{"prettier":"3.8.1"}}\n';

export const CONFIGURATION_CHOICES = [
    { configurations: undefined, selected: ['javascript'] },
    { configurations: undefined, noConfigurations: true, selected: [] },
    { configurations: ['python'], selected: ['python'] },
] as const;

export const PLATFORM_PROJECT_FILES = {
    'package.json': '{"name":"app","private":true,"type":"module"}\n',
    'supabase/config.toml': 'project_id = "example"\n',
    'ios/Package.swift': `// swift-tools-version:6.0
import PackageDescription
let package = Package(name: "App")
`,
    'ios/Sources/App/App.swift': 'let answer = 42\n',
    'tools/lint/package.json': '{"name":"lint","private":true,"devDependencies":{"eslint":"9.39.5"}}\n',
} as const;

export const STYLE_SOURCE_FILES = {
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
    'src/styles.css': `p {
    color: #abc;
}
`,
} as const;

export const NEXTJS_LOCALE_CASES = [
    { dependency: true, named: false, isSelected: false },
    { dependency: false, named: true, isSelected: true },
] as const;

export const GENERATED_WRITE_MESSAGE = 'Generated write denied';

export const SQLFLUFF_KEPT_NOTE =
    'sqlfluff settings stay here, and the generated file for sqlfluff takes over. Delete the section; the generated file replaces it.';

export const INVALID_CSS = `a {
    invalid-property: 1;
}
`;
