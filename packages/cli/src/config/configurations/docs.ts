import { RUNNER_NAMES } from '#cli/config/repository/setup.ts';

export const MARKDOWN_EXTENSIONS = ['.md', '.mdx'] as const;

export const FILE_EXTENSION = /\.[a-z0-9]+$/iu;

export const TRAILING_PUNCTUATION = '.,;:';

export const PATH_CHARACTERS = /^[\w./-]+$/u;

export const TOKEN_SEPARATORS = /[\s`'"()[\],;:!?<>|]+/u;

export const COMMAND_FENCES = new Set(['sh', 'bash', 'console', 'shell', 'zsh', 'shellsession']);

export const PATH_TOKEN_SKIPS = [/^\.\.?\/?$/u, /^\d+\/\d+$/u, /^\//u] as const;

export const REMOTE_ARGUMENTS = [
    /\bgh\s+api\s+(?:"[^"\n]*"|'[^'\n]*'|[^\s`]+)/gu,
    /\b(?:Accept|Content-Type):\s*[a-z]+\/[\w!#$&^.+-]+/giu,
] as const;

export const MISE_RUN = 'mise run ';

export const BUN_RUN = 'bun run ';

export const MISE_CONFIG_GLOB = '.mise/conf.d/*.toml';

export const README_FILE = 'README.md';

export const LICENSE_PATH = 'LICENSE';

export const TITLE_ATTRIBUTE = 'title=';

export const RELATIVE_PATH_PREFIXES = ['./', '../'] as const;

export const RUN_COMMAND = new RegExp(
    String.raw`\b(?:${RUNNER_NAMES.join('|')}) run (?:(?:-[a-z]|--[\w-]+)\s+)*[\w./][\w:/.-]*`,
    'gu',
);

export const MISSING_LICENSE_MESSAGE = 'The root has no LICENSE file.';

export const DOCS_RULES = {
    versionString: 'version-string',
    missingTask: 'missing-task',
    missingReadme: 'missing-readme',
    missingLicense: 'missing-license',
    missingPath: 'missing-path',
} as const;

export const CHANGELOG_FILE = /(?:^|\/)(?:CHANGELOG|HISTORY)[^/]*$/u;

export const VERSION_STRING_MESSAGE = 'This copy of the package version goes stale. Read it from the manifest.';

export const LYCHEE_REPOSITORY_LINKS = 'file://$1/';

export const LYCHEE_ROOT_LINKS = String.raw`^file://(.*)/\.gspot/root-links/`;

export const LYCHEE_MDX_EXPRESSION = '%7B[^/]*%7D';

export const LYCHEE_NOTES = [
    '# This file stops lychee from reading a lychee.toml in the folder where it runs.',
    '# Allow a URL with the docs.allowed_urls setting.',
];

export const LYCHEE_ROOT_NOTE = '# A link that starts with / starts at the repository root, as on GitHub.';

export const LYCHEE_SITE_NOTE = '# A link that starts with / names a route of the site, so lychee skips it.';
