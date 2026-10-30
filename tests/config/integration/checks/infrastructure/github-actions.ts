export const COMPOSITE_ACTION = `name: Greet
inputs:
    message:
        description: Message to print
        required: true
runs:
    using: composite
    steps:
        - shell: bash
          run: echo "\${{ inputs.message }}"
`;

export const CHECKOUT_WORKFLOW = `on: workflow_dispatch
permissions: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
        with:
          persist-credentials: false
`;

export const REQUIRED_INPUT_WORKFLOW = `on:
  workflow_call:
    inputs:
      greeting:
        type: string
        required: true
jobs:
  greet:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
`;

export const TEMPLATE_INJECTION_WORKFLOW = `on: pull_request
permissions: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "\${{ github.event.pull_request.title }}"
`;
