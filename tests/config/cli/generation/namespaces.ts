/** Current configuration identities and the native inputs each project owns. */
export const CONFIGURATION_NAMESPACES = [
    {
        name: 'github-actions',
        retired: 'actions',
        kind: 'infra',
        check: 'github-actions/zizmor',
        target: '.gspot/config/zizmor.yml',
        detectsChild: true,
        files: {
            '.github/workflows/ci.yml':
                'name: Checks\non: push\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo checked\n',
        },
    },
    {
        name: 'translations',
        retired: 'i18n',
        kind: 'library',
        check: 'translations/locales',
        target: '.gspot/config/eslint.config.mjs',
        detectsChild: true,
        files: {
            'package.json': '{"dependencies":{"next-intl":"4.3.9"}}',
            'messages/en.json': '{"heading":"Welcome"}',
        },
    },
    {
        name: 'swift-tests',
        retired: 'xctest',
        kind: 'test',
        check: 'swift-tests/skip-reasons',
        target: '.gspot/config/swiftlint.yml',
        detectsChild: true,
        files: { 'AppTests/HomeTests.swift': 'import XCTest\nfinal class HomeTests: XCTestCase {}\n' },
    },
    {
        name: 'site',
        retired: 'static-site',
        kind: 'framework',
        check: 'site/build',
        target: '.gspot/config/html-validate-built.json',
        detectsChild: false,
        files: {
            'site.webmanifest': '{"name":"Example","short_name":"Example"}',
            'index.html': '<!doctype html><title>Example</title>',
            'assets/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        },
    },
] as const;
