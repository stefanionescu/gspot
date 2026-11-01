import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('file-uploads', plugin.rules['file-uploads'], {
    valid: [
        "import formidable from 'formidable';\nformidable({ uploadDir: '/var/uploads' });",
        "import multer from 'multer';\nmulter({ storage: multer.diskStorage({ destination: '/var/uploads' }) });",
    ],
    invalid: [
        {
            code: "const formidable = require('formidable');\nconst form = formidable();\nform.uploadDir = '/tmp';\nconst form2 = formidable();\nformidable({ keepExtensions: true });\nformidable({ uploadDir: '/a', keepExtensions: true });\nformidable({ uploadDir: '/a' });\nconst multer = require('multer');\nconst storage = multer.diskStorage({ filename: f });\nmulter({ storage });\nmulter({ storage: multer.diskStorage({ destination: d }) });\nconst form3 = formidable();\nform3.keepExtensions = true;",
            errors: [
                { messageId: 'folder', line: 4 },
                { messageId: 'extensionAndFolder', line: 5 },
                { messageId: 'extension', line: 6 },
                { messageId: 'folder', line: 10 },
                { messageId: 'extensionAndFolder', line: 12 },
            ],
        },
    ],
});
