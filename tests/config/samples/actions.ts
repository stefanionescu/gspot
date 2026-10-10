// Shared workflow text for github-actions checks.
export const WORKFLOW_HEAD =
    'name: test\non: [push]\npermissions:\n    contents: read\njobs:\n    build:\n        runs-on: ubuntu-24.04\n        steps:\n';
