// The repository's installed packages, linked into a sandbox so a planted tool resolves its plugins.
import { join } from 'node:path';

/** The node_modules directory of this repository. */
export const INSTALLED_MODULES = join(import.meta.dir, '../../../node_modules');
