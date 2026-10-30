export const SETUP_CASES = [
    ['github', 0],
    ['github', 29],
    ['gitlab', 0],
    ['gitlab', 29],
] as const;

export const SETUP_ARGUMENTS = [
    '',
    'two words',
    "a'b",
    '$(touch unexpected)',
    'x; touch unexpected',
    'line\nbreak',
] as const;

export const LINUX_PIPELINE = {
    version: '1.2.3',
    packageManager: { name: 'npm' as const, version: '11.10.1' },
    operatingSystems: ['linux' as const],
    linuxRunner: 'ubuntu-24.04' as const,
    lockfiles: ['package-lock.json', 'web/pnpm-lock.yaml'],
    hasSwift: false,
    projectInstall: [],
    packageManagers: ['npm' as const, 'pnpm' as const],
};

export const LINT_STEPS = [
    'Check out source',
    'Restore caches',
    'Set up mise',
    'Install gspot',
    'Install gspot tools',
    'Save caches',
    'Lint',
] as const;

export const INSTALL_STEP = 'Install gspot tools';

export const GITLAB_SCRIPT = [
    'set -euo pipefail',
    "mise install node@24 'npm:@gspothq/cli[allow_low_downloads=true]@1.2.3'",
    `PATH="$(mise bin-paths node@24 'npm:@gspothq/cli[allow_low_downloads=true]@1.2.3' | paste -sd : -):$` + '{PATH}"',
    'export PATH',
    'gspot install',
    'git add --intent-to-add -- .gspot',
    'git diff --exit-code -- .gspot',
    'GSPOT_CI_BASE="${CI_MERGE_REQUEST_DIFF_BASE_SHA:-${CI_COMMIT_BEFORE_SHA:-}}"\ngspot check --changed "${GSPOT_CI_BASE}"',
] as const;

export const CACHE_CASES = [
    {
        system: 'linux',
        paths: '~/.cache/mise/downloads-cas\n~/.npm/_cacache\n~/.local/share/pnpm/store\n~/.cache/yarn\n~/.yarn/berry/cache\n~/.bun/install/cache\n~/.cache/uv\n',
    },
    {
        system: 'macos',
        paths: '~/Library/Caches/mise/downloads-cas\n~/.npm/_cacache\n~/Library/pnpm/store\n~/Library/Caches/Yarn\n~/.yarn/berry/cache\n~/.bun/install/cache\n~/.cache/uv\n',
    },
    {
        system: 'windows',
        paths: '${{ runner.temp }}/mise/downloads-cas\n~/AppData/Local/npm-cache/_cacache\n~/AppData/Local/pnpm/store\n~/AppData/Local/Yarn/Cache\n~/AppData/Local/Yarn/Berry/cache\n~/.bun/install/cache\n~/AppData/Local/uv/cache\n',
    },
] as const;
