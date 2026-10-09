import { CLI_PINS } from '#cli/config/generation/pins.ts';

export const SUPPORTED_MISE = `#!/bin/sh\nprintf "${CLI_PINS.mise.version}\\n"\n`;
