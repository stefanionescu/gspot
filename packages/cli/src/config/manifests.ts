import cliPackage from '#cli-package' with { type: 'json' };
import { PACKAGE_JSON, PYPROJECT_TOML, UV_LOCKFILE } from '#cli/config/parsers/projects.ts';
import { GSPOT_FOLDER, NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';

// check output defaults
export const DEFAULT_FILE_PATTERN = String.raw`^(?<file>[^\s].*):$`;
export const DEFAULT_GROUPED_PATTERN = String.raw`^\s+(?<line>\d+): (?<message>.*)$`;
export const DEFAULT_PATTERN = String.raw`^(?<file>[^:\s][^:]*):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<message>.*)$`;
export const MAX_EXIT_CODE = 255;

// detection labels
export const DETECTION_LABELS = {
    extensions: ['a file extension', 'file extensions'],
    filenames: ['a filename', 'filenames'],
    dependencies: ['a dependency on', 'a dependency on'],
    runtimes: ['a JavaScript runtime', 'JavaScript runtimes'],
    tags: ['a file with a shebang for', 'files with a shebang for'],
    paths: ['a file path', 'file paths'],
    project_files: ['a project file', 'project files'],
} as const;

// docs links
const REFERENCE_URL = `${cliPackage.homepage}/reference/`;
const SCHEMA_FILE = 'gspot.schema.json';
export const DOCS_PATHS = {
    reference: REFERENCE_URL,
    commands: `${REFERENCE_URL}commands/`,
    settings: `${REFERENCE_URL}gspot-toml/`,
    jsonOutput: `${REFERENCE_URL}json-output/`,
    configurations: `${REFERENCE_URL}configurations/`,
    checks: `${REFERENCE_URL}checks/`,
    eslintPlugin: `${REFERENCE_URL}eslint-plugin/`,
    stage: `${cliPackage.homepage}/start/concepts/#stages`,
    levels: `${cliPackage.homepage}/start/concepts/#levels`,
    schema: `${cliPackage.homepage}/${SCHEMA_FILE}`,
} as const;

// gspot command lines
export const GSPOT_ADD = 'gspot add';
export const GSPOT_CHECK = 'gspot check';
export const GSPOT_IGNORE = 'gspot ignore';
export const GSPOT_INSTALL = 'gspot install';
export const GSPOT_REMOVE = 'gspot remove';

// gspot paths
export const MISE_CONFIG_FILE = 'mise.toml';
export const MISE_LOCKFILE = 'mise.lock';
export const GSPOT_PATHS = {
    configurations: `${GSPOT_FOLDER}/configurations`,
    rules: `${GSPOT_FOLDER}/rules`,
    hooks: `${GSPOT_FOLDER}/hooks`,
    gitignore: `${GSPOT_FOLDER}/.gitignore`,
    miseProject: `${GSPOT_FOLDER}/${MISE_CONFIG_FILE}`,
    miseLockfile: `${GSPOT_FOLDER}/${MISE_LOCKFILE}`,
    npmProject: `${GSPOT_FOLDER}/${PACKAGE_JSON}`,
    nodeModules: `${GSPOT_FOLDER}/${NODE_MODULES}`,
    pythonProject: `${GSPOT_FOLDER}/${PYPROJECT_TOML}`,
    pythonEnvironment: `${GSPOT_FOLDER}/${PYTHON_ENVIRONMENT_FOLDER}`,
    uvLockfile: `${GSPOT_FOLDER}/${UV_LOCKFILE}`,
    valePackages: `${GSPOT_FOLDER}/vale`,
    valeReleases: `${GSPOT_FOLDER}/vale/releases.json`,
    valeConfig: `${GSPOT_FOLDER}/configurations/prose/vale.ini`,
    valeMessageConfig: `${GSPOT_FOLDER}/configurations/prose/commit-message.ini`,
} as const;

// manifest field patterns
export const EXTENSION_PATTERN = /^\.[a-z0-9]+$/u;
export const INSTALLER_VERSION_MESSAGE = 'This installer needs an exact version.';
export const MINIMUM_VERSION_PATTERN = /^(?:\d+|\d+\.\d+|\d+\.\d+\.\d+)$/u;
export const NAME_PATTERN = /^[a-z0-9-]+$/u;
export const NUMERIC_MINIMUM_MESSAGE = 'Use a numeric minimum version.';
export const RULE_FILE_PATTERN = /^[A-Z0-9-]+\.md$/u;
export const RULE_PLACEHOLDER = '{rule}';
export const SHEBANG_TAG = 'shebang:';
export const SHIPPED_CHECKSUM_PATTERN = /^sha256:[a-f0-9]{64}$/u;
export const VALID_UNICODE_MESSAGE = 'Use a valid Unicode regular expression.';

// manifest field values
export const CASE_NAMES = [
    'camel',
    'camel-acronym',
    'pascal',
    'pascal-acronym',
    'pascal-extension',
    'kebab',
    'snake',
    'upper-snake',
    'timestamp-snake',
] as const;
export const CHECK_CWD_VALUES = ['root', 'scope'] as const;
export const CHECK_NEEDS = [
    'build',
    'dependencies',
    'docker',
    'network',
    'project-code',
    'python-environment',
] as const;
export const CHECK_RUNS = ['files', 'scope', 'once', 'history'] as const;
export const FILE_KINDS = ['source', 'generated', 'vendored', 'binary'] as const;
export const GROUPS = [
    'language',
    'framework',
    'platform',
    'database',
    'testing',
    'infrastructure',
    'library',
    'general',
] as const;
export const LEVELS = ['basic', 'all'] as const;
export const NAMED_CATEGORIES = [
    'schemas',
    'tables',
    'columns',
    'indexes',
    'triggers',
    'policies',
    'functions',
    'parameters',
    'classes',
    'exceptions',
    'methods',
    'variables',
    'constants',
    'attributes',
    'type_aliases',
    'types',
    'properties',
    'enum_cases',
    'files',
    'folders',
    'modules',
    'packages',
    'path_parameters',
] as const;
export const ROOT_RUNS = ['once', 'history'] as const;
export const SETTING_LANGUAGES = ['typescript', 'javascript', 'python', 'bash', 'swift', 'sql', 'css', 'html'] as const;
export const STAGES = ['commit', 'push', 'manual', 'message'] as const;
export const TOOL_KINDS = ['program', 'package'] as const;

// manifest files
export const CONFIGURATIONS_FOLDER = 'src/configurations';
export const DEFAULT_OUTPUT_FORMAT = { format: 'regex', pattern: DEFAULT_PATTERN } as const;
export const MANIFEST_FILE = 'manifest.toml';
export const RULES_FOLDER = 'rules';
export const SHIPPED_FILES_FOLDER = 'files';
export const SOURCE_FILE_GROUPS = ['language', 'framework'] as const;
