import { MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';

// environments
export const GSPOT_ENVIRONMENT = { NO_COLOR: '1', CI: '1' } as const;
export const OFFLINE_ENVIRONMENT = {
    HTTP_PROXY: 'http://127.0.0.1:1',
    HTTPS_PROXY: 'http://127.0.0.1:1',
    ALL_PROXY: 'http://127.0.0.1:1',
    NO_PROXY: '',
    http_proxy: undefined,
    https_proxy: undefined,
    all_proxy: undefined,
    no_proxy: undefined,
    MISE_OFFLINE: '1',
} as const;

// processes
export const CHILD_WAIT_MILLISECONDS = 15_000;
export const CHILD_TIMEOUT_SECONDS = (CHILD_WAIT_MILLISECONDS - MILLISECONDS_PER_SECOND) / MILLISECONDS_PER_SECOND;
export const TEST_TIMEOUT_MILLISECONDS = 360_000;

// sandbox errors
export const ROOT_LABEL = 'the root';

// test programs
export const CHECK_STAGED_COPY_OPTIONS = {
    file: { type: 'string' },
    bytes: { type: 'string' },
    executable: { type: 'string' },
    write: { type: 'string' },
} as const;
export const EXPECT_ARGUMENTS_OPTIONS = { includes: { type: 'string' }, equals: { type: 'string' } } as const;
export const FAKE_TOOL_OPTIONS = {
    'version-line': { type: 'string' },
    'require-cwd': { type: 'string' },
    'refuse-file': { type: 'string' },
    write: { type: 'string', multiple: true },
    'write-hex': { type: 'string', multiple: true },
    delete: { type: 'string', multiple: true },
    append: { type: 'string', multiple: true },
    text: { type: 'string' },
    record: { type: 'string' },
    environment: { type: 'string', multiple: true },
    stdin: { type: 'boolean' },
    line: { type: 'string', multiple: true },
    stdout: { type: 'string' },
    stderr: { type: 'string' },
    'stdout-hex': { type: 'string' },
    'print-pid': { type: 'boolean' },
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
export const IMPORT_DEPENDENCY_OPTIONS = { name: { type: 'string' }, write: { type: 'string' } } as const;
export const LARGE_OUTPUT_OPTIONS = {
    text: { type: 'string' },
    count: { type: 'string' },
    exit: { type: 'string' },
    'exit-now': { type: 'boolean' },
} as const;
export const PAUSING_GIT_OPTIONS = {
    git: { type: 'string' },
    operation: { type: 'string' },
    'pause-on-call': { type: 'string' },
    counter: { type: 'string' },
    marker: { type: 'string' },
} as const;
export const POLL_INTERVAL_MILLISECONDS = 10;
export const REPORT_SWIFT_COVERAGE_OPTIONS = { report: { type: 'string' }, targets: { type: 'string' } } as const;
export const SIGNAL_MARKER_OPTION = '--signal-marker';
export const SITE_BUILD_OPTIONS = { copy: { type: 'string', multiple: true }, import: { type: 'string' } } as const;
export const SPAWN_DESCENDANT_OPTIONS = {
    marker: { type: 'string' },
    line: { type: 'string' },
    forward: { type: 'string' },
} as const;
export const STYLELINT_MODULE_PATH = '.gspot/node_modules/stylelint/lib/index.mjs';
export const WAIT_INTERVAL_MILLISECONDS = 60_000;

// tool fakes
export const UNPINNED_NPM_MESSAGE = 'The npm package fake requires a pinned tool version.';
