// The messages about kits that the selection and the commands share.
import { codeList } from '#cli/platform/text.ts';

/**
 * A kit id nothing ships.
 * @param name the id as written
 * @param near the closest ids that exist
 * @returns the message
 */
export function unknownKit(name: string, near: string[]): string {
    const hint = near.length > 0 ? ` Did you mean ${codeList(near)}?` : '';
    return `There is no kit called \`${name}\`.${hint} Run \`gspot explain <kit>\` to read one.`;
}

/**
 * Requires that loop back on themselves.
 * @param chain the kit ids in the order they were followed
 * @returns the message
 */
export function circularRequires(chain: string[]): string {
    return `The kits require each other in a circle: ${chain.join(' -> ')}. This is a bug in a kit manifest.`;
}
