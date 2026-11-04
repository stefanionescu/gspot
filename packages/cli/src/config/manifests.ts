import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { NODE_MODULES, OPERATING_SYSTEMS, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';

export const MISE_CONFIG_FILE = 'mise.toml';

export const MISE_LOCKFILE = 'mise.lock';

export const UV_LOCKFILE = 'uv.lock';

export const GSPOT_PATHS = {
    configurations: `${GSPOT_FOLDER}/configurations`,
    rules: `${GSPOT_FOLDER}/rules`,
    hooks: `${GSPOT_FOLDER}/hooks`,
    gitignore: `${GSPOT_FOLDER}/.gitignore`,
    miseProject: `${GSPOT_FOLDER}/${MISE_CONFIG_FILE}`,
    miseLockfile: `${GSPOT_FOLDER}/${MISE_LOCKFILE}`,
    npmProject: `${GSPOT_FOLDER}/package.json`,
    nodeModules: `${GSPOT_FOLDER}/${NODE_MODULES}`,
    pythonProject: `${GSPOT_FOLDER}/pyproject.toml`,
    pythonEnvironment: `${GSPOT_FOLDER}/${PYTHON_ENVIRONMENT_FOLDER}`,
    uvLockfile: `${GSPOT_FOLDER}/${UV_LOCKFILE}`,
    valePackages: `${GSPOT_FOLDER}/vale`,
    valeReleases: `${GSPOT_FOLDER}/vale/releases.json`,
    valeConfig: `${GSPOT_FOLDER}/configurations/general/prose/vale.ini`,
    valeMessageConfig: `${GSPOT_FOLDER}/configurations/general/prose/commit-message.ini`,
} as const;

export const FILE_KINDS = ['source', 'generated', 'vendored', 'binary'] as const;

const SCHEMA_FILE = 'gspot.schema.json';

const REFERENCE_URL = `${cliPackage.homepage}/reference/`;

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

export const DEFAULT_GROUPED_PATTERN = String.raw`^\s+(?<line>\d+): (?<message>.*)$`;

export const DEFAULT_FILE_PATTERN = String.raw`^(?<file>[^\s].*):$`;

export const DEFAULT_PATTERN = String.raw`^(?<file>[^:\s][^:]*):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<message>.*)$`;

export const DEFAULT_OUTPUT_FORMAT = { format: 'regex', pattern: DEFAULT_PATTERN } as const;

export const MAX_EXIT_CODE = 255;

export const VALID_UNICODE_MESSAGE = 'Use a valid Unicode regular expression.';

export const NAME_PATTERN = /^[a-z0-9-]+$/u;

export const RULE_FILE_PATTERN = /^[A-Z0-9-]+\.md$/u;

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

export const MANIFEST_FILE = 'manifest.toml';

export const RULES_FOLDER = 'rules';

export const SOURCE_FILE_GROUPS = ['language', 'framework'] as const;

export const DETECTION_LABELS = {
    extensions: 'file extensions',
    filenames: 'filenames',
    dependencies: 'dependencies',
    runtimes: 'JavaScript runtimes',
    tags: 'files marked',
    paths: 'file paths',
    project_files: 'project files',
} as const;

export const CONFIGURATIONS_FOLDER = 'src/configurations';

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

export const CONFIGURATION_ORIGINS = ['named', 'template', 'detected', 'suggested', 'required', 'always'] as const;

export const IGNORE_COMMAND = 'gspot ignore';

export const STAGES = ['commit', 'push', 'manual', 'message'] as const;

export const CHECK_RUNS = ['files', 'scope', 'once', 'history'] as const;

export const CHECK_NEEDS = ['build', 'dependencies', 'docker', 'network', 'python-environment'] as const;

export const CHECK_CWD_VALUES = ['root', 'scope'] as const;

export const TOOL_KINDS = ['program', 'package'] as const;

export const SETTING_TYPES = ['number', 'string', 'path', 'boolean', 'list', 'table'] as const;

export const TOOL_BUILDS = OPERATING_SYSTEMS.map((system) => system.name);

export const SHIPPED_FILES_FOLDER = 'files';

export const MINIMUM_VERSION_PATTERN = /^(?:\d+|\d+\.\d+|\d+\.\d+\.\d+)$/u;

export const EXTENSION_PATTERN = /^\.[a-z0-9]+$/u;

export const INSTALLER_VERSION_MESSAGE = 'This installer needs an exact version.';

export const NUMERIC_MINIMUM_MESSAGE = 'Use a numeric minimum version.';

export const SHIPPED_CHECKSUM_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export const RULE_PLACEHOLDER = '{rule}';

export const REASON_DESCRIPTIONS = {
    raising: 'Why this code needs more than the default; required when you raise the value.',
    lowering: 'Why this code needs less than the default; required when you lower the value.',
    adding: 'Why these entries belong; required when you add an entry.',
} as const;

export const BOUND_REASON_DESCRIPTION =
    'Why this code needs a looser bound than the default; required when you loosen it.';

export const BOUND_PREFIXES = { max_: 'raising', min_: 'lowering' } as const;

export const SETTING_LANGUAGES = ['typescript', 'javascript', 'python', 'bash', 'swift', 'sql', 'css', 'html'] as const;

export const PATH_ROLES = ['source', 'destination', 'build'] as const;
