import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { openSession } from '#cli/execution/session.ts';
import { run as runProcess } from '#cli/platform/spawn.ts';
import { containing } from '#tests/support/expectations.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { installPythonProject, resolvePythonProject } from '#cli/tools/python-project.ts';

const SWIFT =
    [
        'let access = kSecAttrAccessibleAlways',
        'UserDefaults.standard.set(value, forKey: "password")',
        'let secret = Bundle.main.object(forInfoDictionaryKey: "PrivateKey")',
        'let key = "sk-' + 'a'.repeat(22) + '"',
        'let credentials = "https://alice:example@example.com"',
        // eslint-disable-next-line unicorn/prefer-https -- the planted defect is an insecure URL the rule must find
        'let address = "http://localhost.example.com"',
        'let pointer = UnsafeRawPointer(value)',
        'let hash = Insecure.MD5.hash(data: data)',
        'let web = UIWebView()',
        'configuration.preferences.javaScriptEnabled = true',
        'print(password)',
    ].join('\n') + '\n';
const SCRIPTS = 'eval(code);\nexecSync(`build ${input}`);\n';
const PLIST =
    '<plist><dict><key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><true/></dict></dict></plist>\n';
const IDS = [
    'ios-keychain-accessible-always',
    'ios-no-secrets-in-userdefaults',
    'ios-no-secrets-in-plist',
    'ios-hardcoded-api-key',
    'ios-hardcoded-url-with-credentials',
    'ios-insecure-http-url',
    'ios-unsafe-pointer-cast',
    'ios-weak-hash-algorithm',
    'ios-no-uiwebview',
    'ios-wkwebview-javascript-enabled',
    'ios-log-sensitive-data',
    'ios-no-ats-exception-in-plist',
    'ios-scripts-no-eval',
    'ios-scripts-no-unquoted-shell-var-in-exec',
];

test.each(['recommended', 'all'])(
    'Swift security rules report native and CLI diagnostics at %s',
    async (level) => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["swift", "javascript", "security"]\n[rules]\ninstall = false\n`,
            'Value.swift': SWIFT,
            'scripts/build.js': SCRIPTS,
            'Info.plist': PLIST,
        });
        const renderSession1 = await openSession(root);
        const files = emitAll(renderSession1.policyFiles.policy, renderSession1.repository, renderSession1.scopes, {
            version: renderSession1.version,
            packageManager: renderSession1.packageManager,
        }).files.filter(({ path }) => path.startsWith('.gspot/config/semgrep/') || path === '.gspot/pyproject.toml');
        await withLifecycleOwner(root, async (owner) => {
            await resolvePythonProject(root, files, owner);
        });
        for (const file of files) await Bun.write(join(root, file.path), file.content);
        await installPythonProject(root);
        const native = async () =>
            await runProcess(
                [
                    join(root, '.gspot/.venv/bin/semgrep'),
                    'scan',
                    '--config',
                    '.gspot/config/semgrep/ios.yml',
                    '--metrics',
                    'off',
                    '--disable-version-check',
                    '--no-rewrite-rule-ids',
                    '--error',
                    '--json',
                    'Value.swift',
                    'scripts/build.js',
                    'Info.plist',
                ],
                { cwd: root },
            );
        const broken = await native();
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const report = JSON.parse(broken.stdout) as {
            errors: unknown[];
            results: { check_id: string; path: string; start: { line: number } }[];
        };
        expect(report.errors).toStrictEqual([]);
        expect(
            report.results.map((entry) => entry.check_id).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual([...IDS].toSorted((left, right) => left.localeCompare(right)));
        for (const [index, rule] of IDS.entries()) {
            const path = index < 11 ? 'Value.swift' : index === 11 ? 'Info.plist' : 'scripts/build.js';
            const line = index < 11 ? index + 1 : index === 11 ? 1 : index - 11;
            expect(report.results).toContainEqual(containing({ check_id: rule, path, start: containing({ line }) }));
        }
        const cli = await run(root, ['check', '--only', 'security/semgrep', '--no-cache', '--json']);
        expect(cli.code, cli.stdout + cli.stderr).toBe(1);
        expect(
            (JSON.parse(cli.stdout) as { checks: { findings: { rule: string }[] }[] }).checks
                .flatMap((check) => check.findings)
                .map((finding) => finding.rule)
                .filter((id) => id.startsWith('ios-'))
                .toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual([...IDS].toSorted((left, right) => left.localeCompare(right)));
        await Bun.write(
            join(root, 'Value.swift'),
            'let access = kSecAttrAccessibleWhenUnlockedThisDeviceOnly\nUserDefaults.standard.set(value, forKey: "theme")\nlet name = Bundle.main.object(forInfoDictionaryKey: "DisplayName")\nlet address = "https://example.com"\nlet local = "http://localhost:8080"\nlet hash = SHA256.hash(data: data)\nlet web = WKWebView()\nconfiguration.preferences.javaScriptEnabled = false\nprint("Operation completed")\n',
        );
        await Bun.write(join(root, 'scripts/build.js'), 'execFileSync("build", [input]);\n');
        await Bun.write(
            join(root, 'Info.plist'),
            '<plist><dict><key>CFBundleName</key><string>Fixture</string></dict></plist>\n',
        );
        const corrected = await native();
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as { results: unknown[] }).results).toStrictEqual([]);
        const clean = await run(root, ['check', '--only', 'security/semgrep', '--no-cache', '--json']);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS * 3,
);
