import type { MergedView } from '#cli/types/policy/policy.ts';

/**
 * Share effective Markdown rules between native editor and structured CLI configurations.
 * @param view the merged view of the scope
 * @returns the markdownlint rules table
 */
export function markdownlintRules(view: MergedView): Record<string, unknown> {
    const rules = (view.tool('markdownlint')['rules'] ?? {}) as Record<string, unknown>;
    const defaults =
        rules['default'] === undefined
            ? {
                  default: true,
                  MD007: { indent: view.format.indent_width },
                  MD013: false,
                  MD024: { siblings_only: true },
                  MD025: { front_matter_title: '' },
                  MD033: false,
                  MD041: true,
                  MD046: { style: 'fenced' },
                  MD048: { style: 'backtick' },
                  MD049: { style: 'underscore' },
                  MD050: { style: 'asterisk' },
                  MD060: false,
              }
            : {};
    return {
        ...defaults,
        ...rules,
        ...Object.fromEntries(view.rulesOff('markdown/markdownlint').map((rule) => [rule, false])),
    };
}
