import { CATEGORY_PARENTS } from '#cli/config/settings/naming.ts';

/**
Find the category whose limits a more specific category inherits.

@param category the declared naming category.
@returns the category that supplies its limits.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
export function findParentCategory(category: string): string {
    return CATEGORY_PARENTS[category] ?? category;
}
