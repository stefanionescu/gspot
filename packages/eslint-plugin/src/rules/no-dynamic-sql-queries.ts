import { createRule } from '../rule.ts';
import { getQualifiedName } from '../language/modules.ts';
import { isDynamicString } from '../language/expressions.ts';
import { SQL_FUNCTIONS, SQL_BUILDING_METHODS } from '../config/servers.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

export const noDynamicSqlQueries = createRule<[], 'builtQuery'>({
    name: 'no-dynamic-sql-queries',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds query calls of `pg`, `mysql`, `mysql2`, `sqlite3`, `better-sqlite3`, `mssql`, `oracledb`, `pg-promise`, `knex`, `sequelize`, and `typeorm` whose query text is a template literal with an expression, a concatenation with a computed part, or the result of `concat` or `replace`.',
            why: 'A query built from values lets an attacker who controls a value change the query: read, change, or delete other data.',
            fix: 'Write the query text as a constant, and pass the values as query parameters.',
            example:
                'The call ``client.query(`SELECT * FROM users WHERE id = ${id}`)`` reports `builtQuery`. Use `client.query("SELECT * FROM users WHERE id = $1", [id])`.',
        },
        schema: [],
        messages: { builtQuery: 'Pass the values of this query as parameters, not inside the query text.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'CallExpression[arguments.length>0]'(node: TSESTree.CallExpression) {
                const [query] = node.arguments;
                const method =
                    query?.type === AST_NODE_TYPES.CallExpression &&
                    query.callee.type === AST_NODE_TYPES.MemberExpression
                        ? ASTUtils.getPropertyName(query.callee)
                        : null;
                const isBuilt = query !== undefined && (isDynamicString(query) || SQL_BUILDING_METHODS.has(method));
                if (isBuilt && SQL_FUNCTIONS.has(getQualifiedName(node.callee, source)))
                    context.report({ node: node.callee, messageId: 'builtQuery' });
            },
        };
    },
});
