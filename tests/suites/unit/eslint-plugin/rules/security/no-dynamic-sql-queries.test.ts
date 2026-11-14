import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noDynamicSqlQueries } from '#eslint-plugin/rules/security/no-dynamic-sql-queries.ts';

buildRuleTester().run('no-dynamic-sql-queries', noDynamicSqlQueries, {
    valid: [
        "import { Client } from 'pg';\nconst client = new Client();\nclient.query('SELECT * FROM users WHERE id = $1', [id]);",
        'database.query(`SELECT ${columns}`);',
    ],
    invalid: [
        {
            code: "const { Client } = require('pg');\nconst client = new Client();\nclient.query(`SELECT * FROM users WHERE id = ${id}`);\nclient.query('SELECT * FROM users WHERE id = ' + id);\nconst mysql = require('mysql');\nconst connection = mysql.createConnection({});\nconnection.query('SELECT ' + 'x');\nconnection.query(sql.concat(id));",
            errors: [
                { messageId: 'builtQuery', line: 3 },
                { messageId: 'builtQuery', line: 4 },
                { messageId: 'builtQuery', line: 8 },
            ],
        },
    ],
});
