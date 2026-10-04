export const PATH_KEYS = new Set([
    'folder',
    'project_folder',
    'instruction_files',
    'stub_file',
    'paths',
    'patterns',
    'path',
    'file',
    'types_file',
    'migrations_folder',
    'functions_folder',
    'document',
    'config',
    'directory',
    'output',
    'files',
    'excludeFiles',
    'basePath',
    'ignores',
    'exclude',
    'glob',
    'roles',
]);

export const GITHUB_PREFIX = 'github:';

export const RAW_HOST = 'https://raw.githubusercontent.com';

export const TEMPLATE_FILE = 'gspot.template.toml';

export const REQUEST_TIMEOUT_MS = 10_000;

/** The tables a template never holds, because each one belongs to one repository. */
export const REPOSITORY_TABLES = ['scope', 'generated', 'vendored', 'check', 'exclude'] as const;

export const TEMPLATE_EXTENSION = /\.template\.toml$|\.toml$/u;

export const LOCAL_MODULE_PATH = /^(?:\.|\/|\\|[A-Za-z]:)/u;
