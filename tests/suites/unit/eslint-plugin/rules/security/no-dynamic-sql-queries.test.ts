import { noDynamicSqlQueries } from '#eslint-plugin/rules/security/no-dynamic-sql-queries.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-dynamic-sql-queries', noDynamicSqlQueries, {
    valid: [
        "import { Client } from 'pg';\nconst client = new Client();\nclient.query('SELECT * FROM users WHERE id = $1', [id]);",
        'database.query(`SELECT ${columns}`);',
    ],
    invalid: [
        {
            code: "const { Client } = require('pg');\nconst client = new Client();\nclient.query(`SELECT * FROM users WHERE id = ${id}`);\nclient.query('SELECT * FROM users WHERE id = ' + id);\nconst mysql = require('mysql');\nconst connection = mysql.createConnection({});\nconnection.query('SELECT ' + 'x');\nconnection.query(sql.concat(id));\nconst knex = require('knex');\nknex.raw(`DROP ${table}`);",
            errors: [
                { messageId: 'builtQuery', line: 3 },
                { messageId: 'builtQuery', line: 4 },
                { messageId: 'builtQuery', line: 8 },
                { messageId: 'builtQuery', line: 10 },
            ],
        },
    ],
});
