import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const GIT_PLAN_CASES = [
    { name: 'a folder outside Git', hasGit: false, changes: [GSPOT_PATHS.miseProject, GSPOT_PATHS.npmProject] },
    {
        name: 'a Git repository',
        hasGit: true,
        changes: [],
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

export const ATTRIBUTES_PLAN_ROW = {
    path: '.gitattributes',
    note: 'marks the generated files and keeps LF line endings',
} as const;
