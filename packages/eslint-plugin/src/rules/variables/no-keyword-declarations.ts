import { createRule } from '../../rule.ts';
import { RESERVED_DECLARATION_NAMES } from '../../config/rules.ts';

export const noKeywordDeclarations = createRule<[], 'keyword'>({
    name: 'no-keyword-declarations',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Reports declared bindings that use JavaScript reserved or future reserved words.',
            why: 'Reserved binding names can stop parsing when code changes language mode or moves between tools.',
            fix: 'Rename the declared binding and its references. Property names can keep their external API spelling.',
            example: 'Use `packageName` instead of declaring a variable named `package`.',
        },
        schema: [],
        messages: { keyword: 'Rename the {{name}} binding to avoid a reserved JavaScript word.' },
    },
    create(context) {
        return {
            'Program:exit': (node) => {
                const scopes = [context.sourceCode.getScope(node)];
                for (const scope of scopes) {
                    scopes.push(...scope.childScopes);
                    for (const variable of scope.variables) {
                        const declaration = variable.defs[0];
                        if (declaration !== undefined && RESERVED_DECLARATION_NAMES.has(variable.name))
                            context.report({
                                node: declaration.name,
                                messageId: 'keyword',
                                data: { name: variable.name },
                            });
                    }
                }
            },
        };
    },
});
