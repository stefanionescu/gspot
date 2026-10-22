import { DOT_GSPOT } from '#cli/config/gspot-paths.ts';
import { GIT_FOLDER, NODE_MODULES } from '#cli/config/repository/tracked.ts';

export const TRIVY_SKIPPED_FOLDERS = [NODE_MODULES, DOT_GSPOT, GIT_FOLDER] as const;
