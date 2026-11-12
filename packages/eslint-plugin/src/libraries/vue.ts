import { VUE_PACKAGE, VUE_THREE } from '../config/vue.ts';
import { allowsVersion, readPackageFacts } from '../language/packages.ts';
import type { FileContext } from '../types/plugin.ts';

/**
Check whether the package.json files above the file allow Vue 3 or newer. Count a Vue range that does not have the
form of a version range as Vue 3.
*/
export function isVueThreeUsed(context: FileContext): boolean {
    const range = readPackageFacts(context).dependencies.get(VUE_PACKAGE);
    if (range === undefined) return false;
    return allowsVersion(range, VUE_THREE) !== false;
}
