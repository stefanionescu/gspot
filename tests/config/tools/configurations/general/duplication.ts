import { QUIET_INIT } from '#tests/config/harness/init.ts';
/** Bash commands copied between two source files. */
export const DUPLICATION_INIT = ['init', '--yes', '--configurations', 'bash', ...QUIET_INIT];

/** Number of metadata rows outside the selected source scan. */
export const METADATA_ENTRIES = 40;

/** Number of Bash commands in the copied source block. */
export const COMMAND_STEPS = 30;
