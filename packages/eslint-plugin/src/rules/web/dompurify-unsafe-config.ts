import { createRule } from '../../rule.ts';
import { getQualifiedName } from '../../language/modules.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    LIST_FORMAT,
    DANGEROUS_TAGS,
    SANITIZE_FUNCTIONS,
    URI_PATTERN_OPTION,
    SANITIZE_LIST_OPTIONS,
    DANGEROUS_URI_ATTRIBUTES,
    EVENT_LISTENER_ATTRIBUTE,
    SANITIZE_BOOLEAN_OPTIONS,
    SANITIZE_CONFIG_ARGUMENT,
} from '../../config/web.ts';

function isDangerousName(kind: string | undefined, name: string): boolean {
    if (kind === 'events') return EVENT_LISTENER_ATTRIBUTE.test(name);
    const dangerous = kind === 'tags' ? DANGEROUS_TAGS : DANGEROUS_URI_ATTRIBUTES;
    return dangerous.has(name.toLowerCase());
}

function describeListAction(key: string, value: TSESTree.Node): string | undefined {
    const kind = SANITIZE_LIST_OPTIONS[key];
    const elements = value.type === AST_NODE_TYPES.ArrayExpression ? value.elements : [];
    const names = elements.flatMap((element) =>
        element?.type === AST_NODE_TYPES.Literal &&
        typeof element.value === 'string' &&
        isDangerousName(kind, element.value)
            ? [`'${element.value}'`]
            : [],
    );
    return names.length > 0 ? `remove ${LIST_FORMAT.format(names)} from '${key}'` : undefined;
}

function describeValueAction(key: string, value: TSESTree.Node): string | undefined {
    if (key === URI_PATTERN_OPTION)
        return value.type === AST_NODE_TYPES.Literal && 'regex' in value && !value.regex.pattern.startsWith('^')
            ? `anchor the '${key}' pattern with '^'`
            : undefined;
    const unsafe: unknown = Object.hasOwn(SANITIZE_BOOLEAN_OPTIONS, key) ? SANITIZE_BOOLEAN_OPTIONS[key] : undefined;
    return value.type === AST_NODE_TYPES.Literal && value.value === unsafe
        ? `set '${key}' to '${String(unsafe !== true)}'`
        : undefined;
}

function listUnsafeActions(config: TSESTree.ObjectExpression): string[] {
    return config.properties.flatMap((property) => {
        if (property.type !== AST_NODE_TYPES.Property) return [];
        const key = ASTUtils.getPropertyName(property) ?? '';
        const action = Object.hasOwn(SANITIZE_LIST_OPTIONS, key)
            ? describeListAction(key, property.value)
            : describeValueAction(key, property.value);
        return action === undefined ? [] : [action];
    });
}

export const dompurifyUnsafeConfig = createRule<[], 'unsafe'>({
    name: 'dompurify-unsafe-config',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `DOMPurify.sanitize` configurations that let dangerous markup through, such as `script` in `ADD_TAGS`, an event handler attribute in `ADD_ATTR`, or `ALLOW_UNKNOWN_PROTOCOLS` set to `true`.',
            why: 'These options let script and event handler markup through the sanitizer, so an attacker can inject code into the page.',
            fix: 'Keep the default configuration, or allow only harmless tags and attributes.',
            example:
                'The call `DOMPurify.sanitize(html, { ADD_TAGS: ["iframe"] })` reports `unsafe`. Use `DOMPurify.sanitize(html)`.',
        },
        schema: [],
        messages: { unsafe: 'To prevent DOM-based attacks, {{actions}}.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            CallExpression(node) {
                const config = node.arguments[SANITIZE_CONFIG_ARGUMENT];
                if (
                    config?.type !== AST_NODE_TYPES.ObjectExpression ||
                    !SANITIZE_FUNCTIONS.has(getQualifiedName(node, source))
                )
                    return;
                const actions = listUnsafeActions(config);
                if (actions.length > 0)
                    context.report({
                        node: config,
                        messageId: 'unsafe',
                        data: { actions: LIST_FORMAT.format(actions) },
                    });
            },
        };
    },
});
