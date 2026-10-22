export const NPM_TOOL = 'npm';

export const NYPM_DETECTION_OPTIONS = { ignoreArgv: true, ignorePackageJSON: true, includeParentDirs: false } as const;

/** The runner, the install help, and the exact pin command of each package manager. */
export const START_RUNNERS = {
    npm: {
        command: 'npm exec --no -- gspot',
        missing: 'Install Node.js and npm, then run: npm install.',
        installCommand: 'npm install --save-dev --save-exact <package>@<version>',
    },
    pnpm: {
        command: 'pnpm exec gspot',
        missing: 'Install pnpm, then run: pnpm install.',
        installCommand: 'pnpm add --save-dev --save-exact <package>@<version>',
    },
    yarn: {
        command: 'yarn exec gspot',
        missing: 'Install Yarn, then run: yarn install.',
        installCommand: 'yarn add --dev --exact <package>@<version>',
    },
    bun: {
        command: 'bun run --no-install gspot',
        missing: 'Install Bun, then run: bun install.',
        installCommand: 'bun add --dev --exact <package>@<version>',
    },
    mise: {
        command: 'mise exec -- gspot',
        missing: 'Install mise, then run: mise install.',
        installCommand: 'mise use --pin --tool-option allow_low_downloads=true npm:<package>@<version>',
    },
} as const;

/** The first Yarn major that reads .yarnrc.yml and drops the Classic flags. */
export const YARN_BERRY_MAJOR = 2;

export const PACKAGE_MANAGERS = ['npm', 'bun', 'pnpm', 'yarn'] as const;

export const PACKAGE_MANAGER_HASH_SUFFIX = '+sha';
