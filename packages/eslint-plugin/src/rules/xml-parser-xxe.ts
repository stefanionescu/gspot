import { createRule } from '../rule.ts';
import { readQualifiedName } from '../modules.ts';
import { XML_PARSERS } from '../config/servers.ts';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { readExpressionValue, readOptionProperties } from '../expressions.ts';

export const xmlParserXxe = createRule<[], 'entities'>({
    name: 'xml-parser-xxe',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `parseXml` and `parseXmlString` calls of `libxmljs` and `libxmljs2` whose options set `noent` to `true`.',
            why: 'The `noent` option replaces external entities with the content that they point to, so a crafted document can read files from the server or make it send requests.',
            fix: 'Remove `noent: true`, so that the parser keeps external entities unresolved.',
            example:
                'The call `libxmljs.parseXmlString(text, { noent: true })` reports `entities`. Use `libxmljs.parseXmlString(text)`.',
        },
        schema: [],
        messages: { entities: 'Turn off external entities in this XML parser. Remove noent: true.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            CallExpression(node) {
                const options = readExpressionValue(node.arguments[1], source);
                if (
                    options?.type !== AST_NODE_TYPES.ObjectExpression ||
                    !XML_PARSERS.has(readQualifiedName(node, source))
                )
                    return;
                const entities = readOptionProperties(options, source).get('noent');
                if (entities?.value.type === AST_NODE_TYPES.Literal && entities.value.value === true)
                    context.report({ node: entities, messageId: 'entities' });
            },
        };
    },
});
