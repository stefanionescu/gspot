import { noUncheckedRequestData } from '#eslint-plugin/rules/servers/no-unchecked-request-data.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-unchecked-request-data', noUncheckedRequestData, {
    valid: [
        "res.redirect(req.query.next === 'home' ? '/home' : '/');",
        'const page = parseInt(req.query.page, 10);\nres.send(`<p>Page ${page}</p>`);',
        "const sql = 'SELECT * FROM users WHERE id = $1';\ndb.query(sql, [req.params.id]);",
        'res.sendFile(req.params.name, { root: publicFolder });',
        'res.json({ name: req.query.name });',
        "import { spawn } from 'node:child_process';\nspawn('git', ['log', req.query.ref]);",
        "import { readFileSync } from 'node:fs';\nfunction read(name) {\n    return readFileSync(name);\n}",
    ],
    invalid: [
        { code: 'res.redirect(302, req.query.next);', errors: [{ messageId: 'redirect', line: 1 }] },
        { code: "res.redirect(req.query.next || '/');", errors: [{ messageId: 'redirect' }] },
        { code: "res.redirect(req.get('referer'));", errors: [{ messageId: 'redirect' }] },
        { code: 'res.redirect(await resolve(req.query.next));', errors: [{ messageId: 'redirect' }] },
        {
            code: 'const { name } = req.query;\nconst page = `<p>${name}</p>`;\nres.send(page);',
            errors: [{ messageId: 'html', line: 3 }],
        },
        { code: 'res.render(req.params.view);', errors: [{ messageId: 'template', line: 1 }] },
        {
            code: "import { readFile } from 'node:fs/promises';\nimport path from 'node:path';\nconst file = path.join(root, req.query.file);\nawait readFile(file);",
            errors: [{ messageId: 'path', line: 4 }],
        },
        {
            code: "const target = request.headers.get('x-target');\nawait fetch(target);",
            errors: [{ messageId: 'outbound', line: 2 }],
        },
        {
            code: "const sql = 'SELECT * FROM users WHERE name = ' + req.query.name;\ndb.query(sql);",
            errors: [{ messageId: 'sql', line: 2 }],
        },
        { code: 'const pattern = new RegExp(req.query.search);', errors: [{ messageId: 'regexp', line: 1 }] },
        { code: 'const pattern = RegExp(req.query.search);', errors: [{ messageId: 'regexp' }] },
        {
            code: "import { spawn } from 'node:child_process';\nspawn('sh', ['-c', `convert ${req.body.file}`]);",
            errors: [{ messageId: 'shell', line: 2 }],
        },
        {
            code: 'const key = req.body.key;\nsettings[key] = req.body.value;',
            errors: [{ messageId: 'prototype', line: 2 }],
        },
    ],
});
