import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('sql-queries', plugin.rules['sql-queries'], {
    valid: [
        "import { Client } from 'pg';\nconst client = new Client();\nclient.query('SELECT * FROM users WHERE id = $1', [id]);",
        'database.query(`SELECT ${columns}`);',
    ],
    invalid: [
        {
            code: "const { Client } = require('pg');\nconst client = new Client();\nclient.query(`SELECT * FROM users WHERE id = ${id}`);\nclient.query('SELECT * FROM users WHERE id = $1', [id]);\nclient.query('SELECT * FROM users WHERE id = ' + id);\nconst mysql = require('mysql');\nconst connection = mysql.createConnection({});\nconnection.query('SELECT ' + 'x');\nconnection.query(sql.concat(id));\nconst knex = require('knex');\nknex.raw(`DROP ${table}`);",
            errors: [
                { messageId: 'builtQuery', line: 3 },
                { messageId: 'builtQuery', line: 5 },
                { messageId: 'builtQuery', line: 9 },
                { messageId: 'builtQuery', line: 11 },
            ],
        },
    ],
});
