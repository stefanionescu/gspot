export const PROGRAM_NAMES = [
    'fakes/tool',
    'checks/search',
    'checks/replacement',
    'checks/arguments',
    'checks/contents',
    'checks/staged',
    'checks/dependency',
    'checks/bash',
    'processes/call',
    'processes/output',
    'processes/descendant',
    'processes/process-group',
    'checks/stylelint',
    'processes/modules',
    'processes/node-version',
    'processes/cli',
    'processes/command',
    'fakes/logger',
    'fakes/git',
    'fakes/mise',
    'fakes/swift',
    'fakes/vale',
    'fakes/xcodebuild',
    'processes/revisions',
    'processes/manifests',
    'processes/environment',
    'processes/assets',
    'processes/eslint-plugin',
    'fakes/exec',
    'fakes/generator',
    'fakes/site-build',
    'fakes/package-bin',
    'runner/preload',
    'runner/environment.test',
    'runner/interrupt.test',
] as const;

export const WAIT_INTERVAL_MILLISECONDS = 60_000;

export const FAKE_TOOL_OPTIONS = {
    'version-line': { type: 'string' },
    'require-cwd': { type: 'string' },
    'refuse-file': { type: 'string' },
    'refuse-exit': { type: 'string' },
    write: { type: 'string', multiple: true },
    'write-hex': { type: 'string', multiple: true },
    delete: { type: 'string', multiple: true },
    append: { type: 'string', multiple: true },
    'copy-environment-file': { type: 'string' },
    'replace-with-folder': { type: 'string' },
    text: { type: 'string' },
    'log-arguments': { type: 'string' },
    'record-cwd': { type: 'string' },
    line: { type: 'string', multiple: true },
    stdout: { type: 'string' },
    stderr: { type: 'string' },
    'stdout-hex': { type: 'string' },
    'print-arguments': { type: 'boolean' },
    'print-cwd': { type: 'boolean' },
    'print-pid': { type: 'boolean' },
    'print-environment': { type: 'string', multiple: true },
    mark: { type: 'string' },
    until: { type: 'string' },
    wait: { type: 'boolean' },
    repeat: { type: 'string' },
    signal: { type: 'string' },
    'copy-stdin': { type: 'boolean' },
    exit: { type: 'string' },
} as const;

export const FIND_TEXT_OPTIONS = {
    text: { type: 'string' },
    match: { type: 'string' },
    report: { type: 'string' },
    message: { type: 'string' },
    log: { type: 'string' },
} as const;

export const EXPECT_ARGUMENTS_OPTIONS = { includes: { type: 'string' }, equals: { type: 'string' } } as const;

export const CHECK_STAGED_COPY_OPTIONS = {
    file: { type: 'string' },
    bytes: { type: 'string' },
    executable: { type: 'string' },
    write: { type: 'string' },
} as const;

export const SITE_BUILD_OPTIONS = { copy: { type: 'string', multiple: true }, import: { type: 'string' } } as const;

export const IMPORT_DEPENDENCY_OPTIONS = { name: { type: 'string' }, write: { type: 'string' } } as const;

export const DESCRIBE_CALL_OPTIONS = {
    environment: { type: 'string', multiple: true },
    stdin: { type: 'boolean' },
} as const;

export const LARGE_OUTPUT_OPTIONS = {
    text: { type: 'string' },
    count: { type: 'string' },
    exit: { type: 'string' },
} as const;

export const SPAWN_DESCENDANT_OPTIONS = {
    marker: { type: 'string' },
    line: { type: 'string' },
    forward: { type: 'string' },
} as const;

export const SIGNAL_MARKER_OPTION = '--signal-marker';

export const STYLELINT_MODULE_PATH = '.gspot/node_modules/stylelint/lib/index.mjs';

export const PAUSING_GIT_OPTIONS = {
    git: { type: 'string' },
    operation: { type: 'string' },
    'pause-on-call': { type: 'string' },
    counter: { type: 'string' },
    marker: { type: 'string' },
} as const;

export const FAKE_CI_MISE_OPTIONS = {
    'native-mise': { type: 'string' },
    'cli-bin': { type: 'string' },
    'failure-marker': { type: 'string' },
} as const;

export const CLI_PACKAGE_REQUEST = 'npm:@gspothq/cli[allow_low_downloads=true]@';

export const REPORT_SWIFT_COVERAGE_OPTIONS = { report: { type: 'string' }, targets: { type: 'string' } } as const;

export const VALE_PACKAGE_FOLDERS = [
    'Google',
    'write-good',
    'proselint',
    'alex',
    'Harper',
    'config/dictionaries',
] as const;
