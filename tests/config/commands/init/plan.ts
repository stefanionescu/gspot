import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const GIT_PLAN_CASES = [
    { name: 'a folder outside Git', hasGit: false, changes: [GSPOT_PATHS.miseProject, GSPOT_PATHS.npmProject] },
    {
        name: 'a Git repository',
        hasGit: true,
        changes: [
            '.gitignore',
            '.gitattributes',
            GSPOT_PATHS.miseProject,
            GSPOT_PATHS.npmProject,
            GSPOT_PATHS.pythonProject,
            GSPOT_PATHS.hooks,
        ],
    },
] as const;

export const EDITORCONFIG_WRITE = [
    {
        path: '.editorconfig',
        note: 'replaces your file; read the old one with git show HEAD:.editorconfig',
    },
] as const;

export const QUALITY_PACKAGE_FILES = {
    'package.json': '{"name":"shop","private":true,"type":"module","dependencies":{"react":"19.0.0"}}\n',
    'src/app.tsx': 'export const App = () => null;\n',
    'quality/package.json': '{"name":"shop-quality","private":true,"dependencies":{"ts-morph":"26.0.0"}}\n',
    'quality/check.ts': 'export const value = 1;\n',
    '.commitlintrc.json': '{"extends":["@commitlint/config-conventional"]}\n',
} as const;

export const SHARED_SETUP_FILES = {
    'setup.cfg': `[flake8]
ignore = E501
[sqlfluff]
exclude_rules = LT01
`,
    '.gitlab-ci.yml': 'quality:\n  script: npm run lint\n',
    'query.sql': 'SELECT 1;\n',
} as const;

export const MANAGED_PLAN_CHANGES = [
    {
        path: '.gitignore',
        note: 'one managed block',
    },
    {
        path: '.gitattributes',
        note: 'marks the generated files and keeps LF line endings',
    },
    {
        path: '.gspot/mise.toml',
        note: '9 tool pins',
    },
] as const;

export const TOOL_PLAN_CHANGES = [
    {
        path: '.gspot/pyproject.toml',
        note: '2 pinned Python tools; matching uv.lock and tool environment',
    },
    {
        path: '.gspot/hooks',
        note: 'gspot install points core.hooksPath here; a repository that already runs hooks gets the lines to add instead',
    },
] as const;

export const EXACT_DEPENDENCY_CHANGES = [
    ...MANAGED_PLAN_CHANGES,
    {
        path: '.gspot/package.json',
        note: '23 pinned npm tools; matching lockfile',
    },
    ...TOOL_PLAN_CHANGES,
    {
        path: 'package.json',
        note: 'typescript is now pinned in .gspot/package.json; remove it from package.json if nothing else uses it',
    },
] as const;
