import { CLI_PINS } from '#cli/config/configurations.ts';

export const FORMATTER_INIT = [
    'init',
    '--json',
    '--yes',
    '--configurations',
    'format',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];

export const SUPPORTED_MISE = `#!/bin/sh\nprintf "${CLI_PINS.mise}\\n"\n`;
export const OUTDATED_MISE = '#!/bin/sh\nprintf "2026.5.15\\n"\n';
