import { createRule } from '../rule.ts';
import { getQualifiedName } from '../language/modules.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    LIST_FORMAT,
    DANGEROUS_TAGS,
    SANITIZE_FUNCTIONS,
    URI_PATTERN_OPTION,
    SANITIZE_LIST_OPTIONS,
    EVENT_LISTENER_ATTRIBUTE,
    DANGEROUS_URI_ATTRIBUTES,
    SANITIZE_BOOLEAN_OPTIONS,
    SANITIZE_CONFIG_ARGUMENT,
} from '../config/web.ts';

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

function describeAction(property: TSESTree.Property): string | undefined {
    const key = ASTUtils.getPropertyName(property) ?? '';
    if (Object.hasOwn(SANITIZE_LIST_OPTIONS, key)) return describeListAction(key, property.value);
    return describeValueAction(key, property.value);
}

export const dompurifyUnsafeConfig = createRule<[], 'unsafe'>({
    name: 'dompurify-unsafe-config',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `DOMPurify.sanitize` configurations that let dangerous markup through: tags such as `script` and `iframe` in `ADD_TAGS` or `ALLOWED_TAGS`, event handler attributes in `ADD_ATTR` or `ALLOWED_ATTR`, URL attributes in `ADD_URI_SAFE_ATTR`, an `ALLOWED_URI_REGEXP` without a leading `^`, and unsafe values of `ALLOW_UNKNOWN_PROTOCOLS`, `WHOLE_DOCUMENT`, `SAFE_FOR_XML`, `SANITIZE_DOM`, and `RETURN_TRUSTED_TYPE`.',
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
                const actions = config.properties.flatMap((property) => {
                    const action = property.type === AST_NODE_TYPES.Property ? describeAction(property) : undefined;
                    return action === undefined ? [] : [action];
                });
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
