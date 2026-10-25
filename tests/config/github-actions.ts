export const CI_INJECTION_SETTINGS =
    '[ci]\nenabled = true\nsetup_command = ["echo", "${{ github.event.pull_request.title }}"]\n';

export const CI_SOURCE_WORKFLOW =
    'on: workflow_dispatch\npermissions: {}\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo safe\n';
