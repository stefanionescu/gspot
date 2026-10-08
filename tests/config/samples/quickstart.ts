/** Setup commands and expected statuses shared by both unformatted tutorial scaffolds. */
export const SETUP_COMMANDS = [
    { command: ['mise', 'trust', '.mise/conf.d/gspot-tools.toml'], code: 0 },
    { command: ['mise', 'install'], code: 0 },
    { command: ['mise', 'exec', '--', 'gspot', 'install'], code: 0 },
    { command: ['mise', 'exec', '--', 'gspot', 'doctor'], code: 0 },
    { command: ['mise', 'exec', '--', 'gspot', 'check'], code: 1 },
    { command: ['mise', 'exec', '--', 'gspot', 'check', '--fix'], code: 0 },
    { command: ['mise', 'exec', '--', 'gspot', 'check'], code: 0 },
];
