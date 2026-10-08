/** Authored lint jobs that suppress automatic CI selection but must not override a provider flag. */
export const INIT_CI_CASES = [
    { name: 'a GitLab lint job', path: '.gitlab-ci.yml', content: 'quality:\n  script: npm run lint\n' },
    {
        name: 'a GitHub lint job',
        path: '.github/workflows/application.yml',
        content: 'on: push\njobs:\n  quality:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: npm run lint\n',
    },
];

/** Repository CI signals and the provider each signal selects. */
export const CI_PREFERENCE_CASES = [
    [
        'tracked GitLab before GitHub',
        ['.gitlab-ci.yml', '.github/workflows/build.yml'],
        '',
        'git@github.com:example/repo.git',
        'gitlab',
    ],
    ['untracked GitLab before remote', [], '.gitlab-ci.yml', 'git@github.com:example/repo.git', 'gitlab'],
    ['Bitbucket before GitHub remote', ['bitbucket-pipelines.yml'], '', 'git@github.com:example/repo.git', 'none'],
    ['GitHub SSH remote', [], '', 'git@github.com:example/repo.git', 'github'],
    ['unrecognized remote host', [], '', 'https://github.com.example.com/example/repo.git', 'none'],
] as const;
