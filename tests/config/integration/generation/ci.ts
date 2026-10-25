export const GITLAB_PIPELINE = `stages: [test]
application:
  script: echo authored-job
`;

export const GITHUB_PIPELINE = `on: push
jobs:
  application:
    runs-on: ubuntu-24.04
    steps:
      - run: echo authored-job
`;

export const CI_CHECKS = {
    syntax: {
        id: 'project/syntax',
        stage: 'commit',
        paths: ['*.sh'],
        output: { format: 'lines' },
    },
    audit: { id: 'project/audit', stage: 'manual', paths: ['*.sh'] },
    ignore: [
        {
            check: 'data-files/v8r',
            reason: 'The jobs test the generated workflow, not the JSON schema check.',
        },
    ],
} as const;
