import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('production-debug', plugin.rules['production-debug'], {
    valid: [
        "import errorhandler from 'errorhandler';\nif (process.env.NODE_ENV === 'development') app.use(errorhandler());",
        'app.use(logger());',
    ],
    invalid: [
        {
            code: "const errorhandler = require('errorhandler');\nconst express = require('express');\nconst app = express();\napp.use(errorhandler());\nif (process.env.NODE_ENV === 'development') {\n  app.use(errorhandler());\n}\nconst handler = errorhandler();\napp.use([handler]);",
            errors: [
                { messageId: 'debugMiddleware', line: 4 },
                { messageId: 'debugMiddleware', line: 8 },
            ],
        },
    ],
});
