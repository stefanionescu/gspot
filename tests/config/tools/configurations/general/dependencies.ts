import { QUIET_INIT } from '#tests/config/harness/init.ts';

export const CLEAN = `{\n    "name": "example",\n    "version": "1.0.0",\n    "private": true,\n    "packageManager": "bun@${Bun.version}"\n}\n`;

export const DEPENDENCIES_INIT = ['init', '--yes', '--configurations', 'dependencies', ...QUIET_INIT];
