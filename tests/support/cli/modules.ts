// The repository's installed packages, linked into a sandbox so a planted tool resolves its plugins.
import { join, delimiter } from 'node:path';

/** The root store of this repository. Its .bun folder holds every installed package beside the packages it resolves. */
export const INSTALLED_MODULES = join(import.meta.dir, '../../../node_modules');
/** The tests workspace store, where the isolated linker links the packages the planted repositories use. */
export const PLANTED_MODULES = join(import.meta.dir, '../../node_modules');
/** The executable folders of both stores, planted packages first, as the head of a PATH. */
export const INSTALLED_BIN_PATH = [PLANTED_MODULES, INSTALLED_MODULES]
    .map((store) => join(store, '.bin'))
    .join(delimiter);
