import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('content-length', plugin.rules['content-length'], {
    valid: [
        "import multer from 'multer';\nmulter({ limits: { fileSize: 4000000 } });",
        "import formidable from 'formidable';\nformidable({ maxFileSize: 1000000 });",
        "import bodyParser from 'body-parser';\nbodyParser.json({ limit: '1mb' });",
    ],
    invalid: [
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
