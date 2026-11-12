export const NODE_TOOL = 'node';

export const CI_NODE = 'node@24.20.0';

export const SETUP_NODE_VERSION = '24';

const SETUP_NODE = `node@${SETUP_NODE_VERSION}`;

export const MISE_NODE_PIN_COMMAND = `mise use --pin ${SETUP_NODE}`;

export const GSPOT_MISE_TOOL = 'npm:@gspothq/cli';

export const GSPOT_PACKAGES = ['@gspothq/cli', '@gspothq/eslint-plugin'] as const;

export const GSPOT_MISE_OPTIONS = { allow_low_downloads: 'true' } as const;

export const JSON_INDENT_PATTERN = /^[\t ]+(?=")/mu;

export const DEFAULT_JSON_INDENT = '  ';

export const START_RUNNERS = {
    npm: {
        command: 'npm exec --no -- gspot',
        hasBinFolder: true,
        installCommand: 'npm install --save-dev --save-exact <package>@<version>',
    },
    pnpm: {
        command: 'pnpm exec gspot',
        hasBinFolder: true,
        installCommand: 'pnpm add --save-dev --save-exact <package>@<version>',
    },
    yarn: {
        command: 'yarn exec -- gspot',
        hasBinFolder: false,
        installCommand: 'yarn add --dev --exact <package>@<version>',
    },
    bun: {
        command: 'bunx --no-install gspot',
        hasBinFolder: true,
        installCommand: 'bun add --dev --exact <package>@<version>',
    },
    mise: {
        command: 'mise exec -- gspot',
        hasBinFolder: false,
        installCommand: 'mise use --pin --tool-option allow_low_downloads=true npm:<package>@<version>',
    },
} as const;

export const PNPM_WORKSPACE_INSTALL = 'pnpm add --workspace-root --save-dev --save-exact <package>@<version>';

export const PACKAGE_MANAGER_LABELS = { bun: 'Bun', npm: 'npm', pnpm: 'pnpm', yarn: 'Yarn', mise: 'mise' } as const;
