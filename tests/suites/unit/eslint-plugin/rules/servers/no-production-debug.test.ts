import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noProductionDebug } from '#eslint-plugin/rules/servers/no-production-debug.ts';

buildRuleTester().run('no-production-debug', noProductionDebug, {
    valid: [
        "import errorhandler from 'errorhandler';\nif (process.env.NODE_ENV === 'development') app.use(errorhandler());",
        'app.use(logger());',
    ],
    invalid: [
        {
            code: "const errorhandler = require('errorhandler');\nconst express = require('express');\nconst app = express();\napp.use(errorhandler());\nconst handler = errorhandler();\napp.use([handler]);",
            errors: [
                { messageId: 'debugMiddleware', line: 4 },
                { messageId: 'debugMiddleware', line: 5 },
            ],
        },
    ],
});
