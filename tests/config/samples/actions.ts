// The start of the test GitHub Actions workflow that the actions configuration tests read.
export const WORKFLOW_HEAD =
    'name: test\non: [push]\npermissions:\n    contents: read\njobs:\n    build:\n        runs-on: ubuntu-24.04\n        steps:\n';
