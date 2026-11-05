import { maxRequestSize } from '#eslint-plugin/rules/servers/max-request-size.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('max-request-size', maxRequestSize, {
    valid: [
        'settings.size = 1;',
        'let size;\nsize = 1;',

        "import multer from 'multer';\nmulter({ limits: { fileSize: 4000000 } });",
        "import formidable from 'formidable';\nformidable({ maxFileSize: 1000000 });",
        "import bodyParser from 'body-parser';\nbodyParser.json({ limit: '1mb' });",
        "import bodyParser from 'body-parser';\nbodyParser.json({ limit: config.limit });",
        "import bodyParser from 'body-parser';\nbodyParser.json({ limit: 'unknown' });",
        "import bodyParser from 'body-parser';\nbodyParser.json({ limit: '1000' });",
        "import multer from 'multer';\nmulter({ limits: uploadLimits });",
        "import multer from 'multer';\nmulter(options);",
        "import multer from 'multer';\nmulter.memoryStorage();",
        "import formidable from 'formidable';\nconst form = formidable();\nform.maxFileSize = readLimit();",
        "import formidable from 'formidable';\nconst form = formidable({ maxFileSize: 1000 });\nform.multiples = true;",
    ],
    invalid: [
        {
            code: "import formidable from 'formidable';\nlet form;\nform = formidable();",
            errors: [{ messageId: 'unlimited' }],
        },

        {
            code: "const formidable = require('formidable');\nconst form = formidable();\nconst form2 = formidable();\nform2.maxFileSize = 1000;\nformidable({ maxFileSize: 10 * 1024 * 1024 });\nformidable({});\nconst multer = require('multer');\nmulter();\nmulter({ dest: 'x' });\nmulter({ limits: { fileSize: 9000000 } });\nmulter({ limits: { fileSize: 100 } });\nmulter({ limits: {} });\nconst bodyParser = require('body-parser');\nbodyParser.json();\nbodyParser.json({ limits: '5mb' });\nbodyParser.json({ limits: '1mb' });",
            errors: [
                { messageId: 'unlimited', line: 2 },
                { messageId: 'unlimited', line: 5 },
                { messageId: 'unlimited', line: 6 },
                { messageId: 'unlimited', line: 8 },
                { messageId: 'unlimited', line: 9 },
                { messageId: 'unlimited', line: 10 },
                { messageId: 'unlimited', line: 12 },
                { messageId: 'unlimited', line: 15 },
            ],
        },
    ],
});
