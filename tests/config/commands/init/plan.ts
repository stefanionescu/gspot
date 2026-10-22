/** Git-dependent plan rows belong only to a repository with a Git index. */
export const GIT_PLAN_CASES = [
    { name: 'a folder outside Git', hasGit: false, changes: ['.gspot/mise.toml', '.gspot/package.json'] },
    {
        name: 'a Git repository',
        hasGit: true,
        changes: ['.gitignore', '.gitattributes', '.gspot/mise.toml', '.gspot/package.json', '.gspot/hooks'],
    },
] as const;

/** The write row of a conflicting .editorconfig. */
export const EDITORCONFIG_WRITE = [
    {
        path: '.editorconfig',
        note: 'replaces your file; read the old one with git show HEAD:.editorconfig',
    },
] as const;

/** A React app with a quality package that installs ts-morph. */
export const QUALITY_PACKAGE_FILES = {
    'package.json': '{"name":"shop","private":true,"type":"module","dependencies":{"react":"19.0.0"}}\n',
    'src/app.tsx': 'export const App = () => null;\n',
    'quality/package.json': '{"name":"shop-quality","private":true,"dependencies":{"ts-morph":"26.0.0"}}\n',
    'quality/check.ts': 'export const value = 1;\n',
    '.commitlintrc.json': '{"extends":["@commitlint/config-conventional"]}\n',
} as const;

/** A setup.cfg with flake8 and SQLFluff sections. */
export const SHARED_SETUP_FILES = {
    'setup.cfg': `[flake8]
ignore = E501
[sqlfluff]
exclude_rules = LT01
`,
    '.gitlab-ci.yml': 'quality:\n  script: npm run lint\n',
    'query.sql': 'SELECT 1;\n',
} as const;
