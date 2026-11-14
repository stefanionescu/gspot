import type { FileContext } from '../types/plugin.ts';
import { allowsVersion } from '../language/versions.ts';
import { VUE_THREE, VUE_PACKAGE } from '../config/vue.ts';
import { readPackageFacts } from '../language/packages.ts';

/**
Check whether the package.json files above the file allow Vue 3 or newer. Count a Vue range that does not have the
form of a version range as Vue 3.
*/
export function isVueThreeUsed(context: FileContext): boolean {
    const range = readPackageFacts(context).dependencies.get(VUE_PACKAGE);
    if (range === undefined) return false;
    return allowsVersion(range, VUE_THREE) !== false;
}
