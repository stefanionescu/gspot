/** Commands that install the repository's pinned CLI as a project dependency. */
export const PIN_INSTALL_COMMANDS = {
    mise: 'mise install',
    npm: 'npm install --save-dev',
    bun: 'bun add --dev',
    pnpm: 'pnpm add --save-dev',
    yarn: 'yarn add --dev',
} as const;
