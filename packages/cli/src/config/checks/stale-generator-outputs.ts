import { NODE_MODULES } from '#cli/config/repository/tracked.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/tools/python.ts';

/** Exclude installed dependencies from generated output snapshots. */
export const GENERATOR_SCAN_EXCLUSIONS = [NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER] as const;
