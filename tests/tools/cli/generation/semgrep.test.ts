import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/harness/cli/command.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { toolShipsHere } from '#tests/harness/cli/platforms.ts';
import { installSemgrep } from '#tests/harness/tools/install.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';

const APP_SEMGREP =
    '[guides]\ninstall = false\n[[scope]]\npath = "app"\nkits = ["express"]\n[scope.tools.semgrep]\nignore = [{ paths = ["app/**/ignored.js"], reason = "Generated fixtures are checked by their producer." }]\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n';

if (toolShipsHere('semgrep'))
    test('framework security packs stay within inherited scopes and preserve sibling input', async () => {
        await using sandbox = await testdir();
        const policy = policyOf(['javascript', 'security'], APP_SEMGREP);
        const source = 'res.send(req.body);\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'source.js': source,
            'app/source.js': source,
            'app/child/source.js': source,
            'sibling/source.js': source,
            'app/ignored.js': 'eval(input);\n',
            'app/child/ignored.js': 'eval(input);\n',
            'sibling/ignored.js': 'eval(input);\n',
        });
        await installSemgrep(sandbox.path);
        const command = ['check', '--only', 'security/semgrep', '--json'];
        const broken = await run(sandbox.path, command);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const findingsByScope = (JSON.parse(broken.stdout) as RunReport).checks.flatMap(({ scope, findings }) =>
            findings.map((finding) => ({ scope, finding })),
        );
        expect(findingsByScope).toStrictEqual([
            {
                scope: 'app',
                finding: containing({ file: 'app/source.js', line: 1, rule: 'express-res-send-raw-input' }),
            },
            {
                scope: 'app/child',
                finding: containing({
                    file: 'app/child/source.js',
                    line: 1,
                    rule: 'express-res-send-raw-input',
                }),
            },
            {
                scope: 'sibling',
                finding: containing({ file: 'sibling/ignored.js', line: 1, rule: 'node-no-eval' }),
            },
        ]);
        for (const path of ['app/source.js', 'app/child/source.js'])
            await Bun.write(join(sandbox.path, path), 'res.json({ message: "Accepted" });\n');
        await Bun.write(join(sandbox.path, 'sibling/ignored.js'), 'JSON.parse(input);\n');
        const corrected = await run(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'source.js')).text()).toBe(source);
        expect(await Bun.file(join(sandbox.path, 'sibling/source.js')).text()).toBe(source);
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
        const invalidRule = join(sandbox.path, '.gspot/config/app/semgrep/broken.yml');
        await Bun.write(invalidRule, 'rules: [');
        const invalid = await run(sandbox.path, command);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
        expect((JSON.parse(invalid.stdout) as RunReport).checks.find((check) => check.scope === 'app')?.status).toBe(
            'error',
        );
        expect(await Bun.file(invalidRule).text()).toBe('rules: [');
        await Bun.file(invalidRule).delete();
        const recovered = await run(sandbox.path, command);
        expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
    }, 120_000);

// One Swift rule of each level, after the Bash rules the bash kit adds.
const SWIFT_DEFECTS = 'let access = kSecAttrAccessibleAlways\nlet pointer = UnsafeRawPointer(value)\n';

if (toolShipsHere('semgrep'))
    test('Semgrep rules follow the selected kits and the level', async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const script = '#!/usr/bin/env bash\ncurl https://example.com/setup.sh | bash\neval "$1"\n';
        await createFileTree(root, {
            'gspot.toml': policyOf(['bash', 'swift', 'security'], '[guides]\ninstall = false\n', 'recommended'),
            'script.sh': script,
            'Value.swift': SWIFT_DEFECTS,
        });
        await installSemgrep(root);
        const command = ['check', '--only', 'security/semgrep', '--json'];
        const recommended = await run(root, command);
        expect(recommended.code, recommended.stdout + recommended.stderr).toBe(1);
        expect(
            (JSON.parse(recommended.stdout) as RunReport).checks
                .flatMap((check) => check.findings)
                .flatMap(({ rule }) => (rule?.startsWith('ios-') === true ? [rule] : [])),
        ).toStrictEqual(['ios-keychain-accessible-always']);
        await Bun.write(
            join(root, 'gspot.toml'),
            policyOf(['bash', 'swift', 'security'], '[guides]\ninstall = false\n', 'all'),
        );
        const session = await openSession(root);
        for (const output of emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageClient: session.packageClient,
        }).files.filter(({ path }) => path.includes('/semgrep/')))
            await Bun.write(join(root, output.path), output.content);
        const all = await run(root, command);
        expect(all.code, all.stdout + all.stderr).toBe(1);
        const findings = (JSON.parse(all.stdout) as RunReport).checks.flatMap((check) => check.findings);
        expect(findings).toStrictEqual(
            containingAll([
                containing({ file: 'script.sh', line: 2, rule: 'gspot.bash.curl-pipe-shell' }),
                containing({ file: 'script.sh', line: 3, rule: 'gspot.bash.eval' }),
                containing({ file: 'Value.swift', line: 1, rule: 'ios-keychain-accessible-always' }),
                containing({ file: 'Value.swift', line: 2, rule: 'ios-unsafe-pointer-cast' }),
            ]),
        );
        expect(await Bun.file(join(root, 'script.sh')).text()).toBe(script);
        await Bun.write(join(root, 'script.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "$1"\n');
        await Bun.write(join(root, 'Value.swift'), 'let access = kSecAttrAccessibleWhenUnlockedThisDeviceOnly\n');
        const clean = await run(root, command);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    }, 120_000);
