/** The exact native command for each authored runner and the global installation. */
export const PIN_INSTALLATIONS = [
    [undefined, 'npm install --global @gspothq/cli@9.9.9'],
    ['mise', 'mise install'],
    ['npm', 'npm install --save-dev @gspothq/cli@9.9.9'],
    ['bun', 'bun add --dev @gspothq/cli@9.9.9'],
    ['pnpm', 'pnpm add --save-dev @gspothq/cli@9.9.9'],
    ['yarn', 'yarn add --dev @gspothq/cli@9.9.9'],
] as const;
