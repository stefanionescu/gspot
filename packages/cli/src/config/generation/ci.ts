import type { ActionPin } from '#cli/types/generation/ci.ts';

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

export const CHECKOUT_ACTION: ActionPin = {
    name: 'actions/checkout',
    sha: '34e114876b0b11c390a56381ad16ebd13914f8d5',
    version: 'v4.3.1',
};

export const MISE_ACTION: ActionPin = {
    name: 'jdx/mise-action',
    sha: '5ac50f778e26fac95da98d50503682459e86d566',
    version: 'v3.2.0',
};

export const CACHE_ACTION: ActionPin = {
    name: 'actions/cache',
    sha: '5a3ec84eff668545956fd18022155c47e93e2684',
    version: 'v4.2.3',
};

export const SETUP_NODE_ACTION: ActionPin = {
    name: 'actions/setup-node',
    sha: '820762786026740c76f36085b0efc47a31fe5020',
    version: 'v7.0.0',
};

/** The Node major the generated CI installs gspot with. */
export const NODE_VERSION = '22';

export const RUNNERS: Record<string, string> = { linux: 'ubuntu-24.04', macos: 'macos-15', windows: 'windows-2025' };
export const GITHUB_WORKFLOW = '.github/workflows/gspot.yml';

export const GITLAB_WORKFLOW = '.gitlab/ci/gspot.yml';
