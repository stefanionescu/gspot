import { isDeepStrictEqual } from 'node:util';
import type { Drift } from '#cli/types/lifecycle/apply.ts';
import type { CapturedRules } from '#cli/types/generation/rules.ts';

/**
 * Compare generated rule data with the last successful apply, independent of edited file bytes.
 * @param previous the rule values recorded after the last successful apply
 * @param proposed the current generated rule values
 * @returns added, removed, and changed rules under each declared path
 */
export function compareRules(previous: CapturedRules, proposed: CapturedRules): NonNullable<Drift['rules']> {
    const paths = new Set([...Object.keys(previous), ...Object.keys(proposed)]);
    return [...paths].flatMap((path) => {
        const before = previous[path];
        const next = proposed[path];
        const added = (next === undefined ? [] : Object.keys(next))
            .filter((rule) => before === undefined || !Object.hasOwn(before, rule))
            .toSorted((left, right) => left.localeCompare(right));
        const removed = (before === undefined ? [] : Object.keys(before))
            .filter((rule) => next === undefined || !Object.hasOwn(next, rule))
            .toSorted((left, right) => left.localeCompare(right));
        const changed = (next === undefined ? [] : Object.keys(next))
            .filter(
                (rule) =>
                    before !== undefined &&
                    Object.hasOwn(before, rule) &&
                    !isDeepStrictEqual(before[rule], next?.[rule]),
            )
            .toSorted((left, right) => left.localeCompare(right));
        return added.length + removed.length + changed.length === 0 ? [] : [{ path, added, removed, changed }];
    });
}
