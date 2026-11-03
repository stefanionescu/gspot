import picomatch from 'picomatch';
import { createRule } from '../../rule.ts';
import { PLUGIN_PREFIX } from '../../config/plugin.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import { findPathInFolder } from '../../language/modules.ts';
import type { RestrictedSyntaxOptions } from '../../types/structure.ts';
import { RESTRICTED_SYNTAX_OPTIONS_SCHEMA } from '../../config/structure.ts';

function isSelected(path: string | undefined, { files, ignores }: RestrictedSyntaxOptions[number]): boolean {
    if (path === undefined) return files === undefined;
    const isIncluded = files === undefined || picomatch([...files], { dot: true })(path);
    return isIncluded && (ignores === undefined || !picomatch([...ignores], { dot: true })(path));
}

export const restrictedSyntax = createRule<RestrictedSyntaxOptions, 'restricted'>({
    name: 'restricted-syntax',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            example:
                'With the option `{ selector: "TSEnumDeclaration", message: "Use a literal union instead of an enum." }`, `enum Color { Red }` reports `restricted` with that message. With `files: ["src/**"]`, a file outside `src/` does not report it.',
            description:
                'Reports each node that an option selector matches, with the message of that option, like the core no-restricted-syntax. Each option can name the `files` it applies to and the `ignores` it skips.',
            why: 'A pattern that a project bans should report everywhere it applies, with the reason in the message.',
            fix: 'Follow the message of the finding, which names the shape to write instead.',
        },
        schema: RESTRICTED_SYNTAX_OPTIONS_SCHEMA,
        messages: { restricted: '{{message}}' },
    },
    create(context) {
        const path = findPathInFolder(
            (context.settings[PLUGIN_PREFIX] as { root?: string } | undefined)?.root ?? context.cwd,
            context.physicalFilename,
        );
        const messages = new Map<string, string[]>();
        for (const option of context.options)
            if (isSelected(path, option))
                messages.set(option.selector, [...(messages.get(option.selector) ?? []), option.message]);
        return Object.fromEntries(
            messages.entries().map(([selector, selectorMessages]) => [
                selector,
                (node: TSESTree.Node) => {
                    for (const message of selectorMessages)
                        context.report({ node, messageId: 'restricted', data: { message } });
                },
            ]),
        );
    },
});
