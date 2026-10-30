export const CALLER_WORKFLOW = `on: workflow_dispatch
jobs:
  caller:
    uses: $/.github/workflows/called.yml
`;
