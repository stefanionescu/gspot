import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noAnyOriginPolicy } from '#eslint-plugin/rules/servers/no-any-origin-policy.ts';

buildRuleTester().run('no-any-origin-policy', noAnyOriginPolicy, {
    valid: [
        "import cors from 'cors';\nimport express from 'express';\nconst app = express();\napp.use(cors({ origin: ['https://app.example.com'] }));",
        "import express from 'express';\nconst app = express();\napp.get('/v', function (req, res) {\n  const origin = req.header('Origin');\n  if (origin === 'https://trusted.example.com') res.setHeader('Access-Control-Allow-Origin', origin);\n});",
        ...[
            'app.use(express.json());',
            "app.get('/', handler);",
            "app.get('/', (req, res) => { res.setHeader('X-Frame-Options', 'DENY'); });",
            "app.get('/x', (req, res) => { const origin = req.headers.origin; if (ALLOWED.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin); res.end(); });",
        ].map((code) => `import express from 'express';\nimport http from 'http';\nconst app = express();\n${code}`),
    ],
    invalid: [
        {
            code: "const http = require('http');\nconst express = require('express');\nconst cors = require('cors');\nconst app = express();\nhttp.createServer(function (req, res) {\n  res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });\n});\napp.use(cors());\napp.use(cors({ origin: '*' }));\napp.use(cors({ credentials: true }));\napp.get('/', function (req, res) {\n  res.setHeader('Access-Control-Allow-Origin', req.headers.origin);\n});",
            errors: [
                { messageId: 'permissive', line: 6 },
                { messageId: 'permissive', line: 8 },
                { messageId: 'permissive', line: 9 },
                { messageId: 'permissive', line: 10 },
                { messageId: 'permissive', line: 12 },
            ],
        },
        {
            code: "import http from 'http';\nhttp.createServer((req, res) => { res.writeHead(200, { 'access-control-allow-origin': '*' }); });",
            errors: [{ messageId: 'permissive' }],
        },
        {
            code: "import express from 'express';\nconst app = express();\napp.get('/v', function (req, res) {\n  res.setHeader('Access-Control-Allow-Origin', req.header('Origin'));\n});",
            errors: [{ messageId: 'permissive' }],
        },
        ...[
            "app.use('/api', cors());",
            'app.use(cors({ origin: true }));',
            'const router = express.Router(); router.use(cors());',
        ].map((code) => ({
            code: `import cors from 'cors';\nimport express from 'express';\nconst app = express();\n${code}`,
            errors: [{ messageId: 'permissive' as const }],
        })),
    ],
});
