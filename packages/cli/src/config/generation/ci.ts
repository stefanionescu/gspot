// The paths the job caches between runs: the package caches and the installed tools.
export const CACHED_PATHS = [
    '~/.npm/_cacache',
    '~/.bun/install/cache',
    '~/.cache/uv',
    '~/.cache/mise',
    '~/.local/share/mise/installs',
    '~/.local/share/pnpm/store',
    '~/.yarn/berry/cache',
];

export const CHECKOUT = 'actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5';

export const MISE = 'jdx/mise-action@5ac50f778e26fac95da98d50503682459e86d566';

export const CACHE = 'actions/cache@5a3ec84eff668545956fd18022155c47e93e2684';

export const NODE = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020';

/** The Node major the generated CI installs gspot with. */
export const NODE_VERSION = '22';

export const RUNNERS: Record<string, string> = { linux: 'ubuntu-24.04', macos: 'macos-15', windows: 'windows-2025' };
export const GITHUB_WORKFLOW = '.github/workflows/gspot.yml';

export const GITLAB_WORKFLOW = '.gitlab/ci/gspot.yml';
