import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { run as runProcess } from '#cli/platform/spawn.ts';
import { containing } from '#tests/support/expectations.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/cli.ts';
import { installSemgrep } from '#tests/support/cli/tools.ts';

import {
    PLIST,
    SCRIPTS,
    SWIFT_SECURITY_ARGS,
    SWIFT_SECURITY_FINDINGS,
} from '#tests/constants/integration/tools/generation.ts';

const SWIFT =
    [
        'let access = kSecAttrAccessibleAlways',
        'UserDefaults.standard.set(value, forKey: "password")',
        'let secret = Bundle.main.object(forInfoDictionaryKey: "PrivateKey")',
        'let key = "sk-' + 'a'.repeat(22) + '"',
        'let credentials = "https://alice:example@example.com"',
        // eslint-disable-next-line unicorn/prefer-https -- reason: The planted defect is an insecure URL the rule must find.
        'let address = "http://localhost.example.com"',
        'let pointer = UnsafeRawPointer(value)',
        'let hash = Insecure.MD5.hash(data: data)',
        'let web = UIWebView()',
        'configuration.preferences.javaScriptEnabled = true',
        'print(password)',
    ].join('\n') + '\n';
test.each(['recommended', 'all'])(
    'Swift security rules report native and CLI diagnostics at %s',
    async (level) => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const expected = SWIFT_SECURITY_FINDINGS.filter(
            (finding) => level === 'all' || finding.level === 'recommended',
        );
        const selectedIds = expected.map(({ rule }) => rule).toSorted((left, right) => left.localeCompare(right));
        await createFileTree(root, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["swift", "javascript", "security"]\n[rules]\ninstall = false\n`,
            'Value.swift': SWIFT,
            'scripts/build.js': SCRIPTS,
            'Info.plist': PLIST,
        });
        await installSemgrep(root);
        const broken = await runProcess(
            [
                join(root, '.gspot/.venv', process.platform === 'win32' ? 'Scripts/semgrep.exe' : 'bin/semgrep'),
                ...SWIFT_SECURITY_ARGS,
            ],
            { cwd: root },
        );
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const report = JSON.parse(broken.stdout) as {
            errors: unknown[];
            results: { check_id: string; path: string; start: { line: number } }[];
        };
        expect(report.errors).toStrictEqual([]);
        expect(
            report.results.map((entry) => entry.check_id).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(selectedIds);
        for (const { rule, path, line } of expected)
            expect(report.results).toContainEqual(containing({ check_id: rule, path, start: containing({ line }) }));
        const cli = await run(root, ['check', '--only', 'security/semgrep', '--no-cache', '--json']);
        expect(cli.code, cli.stdout + cli.stderr).toBe(1);
        expect(
            (JSON.parse(cli.stdout) as { checks: { findings: { rule: string }[] }[] }).checks
                .flatMap((check) => check.findings)
                .map((finding) => finding.rule)
                .filter((id) => id.startsWith('ios-'))
                .toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(selectedIds);
        await createFileTree(root, {
            'Value.swift':
                'let access = kSecAttrAccessibleWhenUnlockedThisDeviceOnly\nUserDefaults.standard.set(value, forKey: "theme")\nlet name = Bundle.main.object(forInfoDictionaryKey: "DisplayName")\nlet address = "https://example.com"\nlet local = "http://localhost:8080"\nlet hash = SHA256.hash(data: data)\nlet web = WKWebView()\nconfiguration.preferences.javaScriptEnabled = false\nprint("Operation completed")\n',
            'scripts/build.js': 'execFileSync("build", [input]);\n',
            'Info.plist': '<plist><dict><key>CFBundleName</key><string>Fixture</string></dict></plist>\n',
        });
        const corrected = await runProcess(
            [
                join(root, '.gspot/.venv', process.platform === 'win32' ? 'Scripts/semgrep.exe' : 'bin/semgrep'),
                ...SWIFT_SECURITY_ARGS,
            ],
            { cwd: root },
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as { results: unknown[] }).results).toStrictEqual([]);
        const clean = await run(root, ['check', '--only', 'security/semgrep', '--no-cache', '--json']);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS * 3,
);
