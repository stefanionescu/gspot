/** Authored lint jobs that stop init from adding CI by itself, but not when a provider flag asks for it. */
export const LINT_JOBS = [
    { name: 'a GitLab lint job', path: '.gitlab-ci.yml', content: 'quality:\n  script: npm run lint\n' },
    {
        name: 'a GitHub lint job',
        path: '.github/workflows/application.yml',
        content: `on: push
jobs:
  quality:
    runs-on: ubuntu-24.04
    steps:
      - run: npm run lint
`,
    },
] as const;

/** Repository CI signals and the provider each signal selects. */
export const CI_PREFERENCE_CASES = [
    {
        name: 'a GitHub workflow before a GitLab remote',
        tracked: ['.github/workflows/build.yml'],
        untracked: '',
        remote: 'git@gitlab.com:example/repo.git',
        provider: 'github',
    },
    {
        name: 'tracked GitLab before GitHub',
        tracked: ['.gitlab-ci.yml', '.github/workflows/build.yml'],
        untracked: '',
        remote: 'git@github.com:example/repo.git',
        provider: 'gitlab',
    },
    {
        name: 'GitLab file before GitHub remote',
        tracked: [],
        untracked: '.gitlab-ci.yml',
        remote: 'git@github.com:example/repo.git',
        provider: 'gitlab',
    },
    {
        name: 'GitHub remote with unrelated Bitbucket configuration',
        tracked: ['bitbucket-pipelines.yml'],
        untracked: '',
        remote: 'git@github.com:example/repo.git',
        provider: 'github',
    },
    {
        name: 'GitHub SSH remote',
        tracked: [],
        untracked: '',
        remote: 'git@github.com:example/repo.git',
        provider: 'github',
    },
    {
        name: 'unrecognized remote host',
        tracked: [],
        untracked: '',
        remote: 'https://github.com.example.com/example/repo.git',
        provider: undefined,
    },
] as const;

export const IMPORT_STYLE_CASES = [
    {
        name: 'a tsconfig that imports .ts files by name',
        files: {
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"allowImportingTsExtensions":true,"noEmit":true}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: 'ts',
    },
    {
        name: 'an esbuild bundle',
        files: {
            'package.json': '{"private":true,"type":"module","devDependencies":{"esbuild":"0.25.0"}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: 'extensionless',
    },
    {
        name: 'a Node.js package',
        files: {
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext"}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: undefined,
    },
] as const;

/** A root and a site workspace. */
export const WORKSPACE_SITE_FILES = {
    'package.json': '{"name":"root","private":true,"workspaces":["apps/*"]}',
    'source.ts': 'export const root = true;\n',
    'apps/site/package.json': '{"name":"site","private":true}',
    'apps/site/source.py': 'VALUE = 1\n',
} as const;
