/** Authored lint jobs that suppress automatic CI selection but must not override a provider flag. */
export const INIT_CI_CASES = [
    { name: 'a GitLab lint job', path: '.gitlab-ci.yml', content: 'quality:\n  script: npm run lint\n' },
    {
        name: 'a GitHub lint job',
        path: '.github/workflows/application.yml',
        content: 'on: push\njobs:\n  quality:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: npm run lint\n',
    },
];
