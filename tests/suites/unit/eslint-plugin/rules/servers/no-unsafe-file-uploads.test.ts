import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noUnsafeFileUploads } from '#eslint-plugin/rules/servers/no-unsafe-file-uploads.ts';

buildRuleTester().run('no-unsafe-file-uploads', noUnsafeFileUploads, {
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
        {
            code: 'import formidable from "formidable";\nconst form = formidable(read());',
            errors: [{ messageId: 'folder' }],
        },
    ],
});
