import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

export const OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        trivialFunctionStatements: {
            description: 'The rule reports each function with this many statements or fewer.',
            type: 'integer',
            minimum: 1,
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

export const TRIVIAL_FUNCTION_STATEMENTS = 2;

export const INLINE_VALUE_PARENTS = new Set<string>([
    'ArrayExpression',
    'ReturnStatement',
    'JSXExpressionContainer',
    'ArrowFunctionExpression',
    'AssignmentPattern',
]);

export const FUNCTION_SELECTOR = ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)';

export const FUNCTION_MEMBER_PARENTS = new Set<string>(['Property', 'MethodDefinition', 'PropertyDefinition']);

export const PASSED_VALUE_TYPES = new Set<string>(['Identifier', 'Literal', 'ThisExpression', 'Super']);
