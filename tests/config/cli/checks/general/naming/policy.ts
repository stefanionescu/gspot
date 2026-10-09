export const SCOPE_POLICY =
    'configurations = ["naming", "bash"]\n[naming]\nallowed = {remoteRecord = "The external JavaScript interface fixes this name."}\n[[naming.overrides]]\npaths = ["web/source.js"]\nallowed = ["remoteRecord"]\nreason = "The external JavaScript interface fixes this name."\n[scope."web"]\nconfigurations = ["javascript"]\n[scope."web".naming]\nallowed = {remoteRecord = "The external JavaScript interface fixes this name."}\n[scope."worker"]\nconfigurations = ["python"]\n[scope."worker".naming]\nallowed = {remote_record = "The external Python interface fixes this name."}\n';

export const TEST_PATH_FILES = {
    'qa/entry.js': 'export const testcaseCount = 1;\n',
    'tests/default.js': 'export const testcaseCount = 1;\n',
    'src/entry.js': 'export const testcaseCount = 1;\n',
    'Tests/Service.swift': 'let testcaseCount = 1\n',
    'Sources/ServiceTests.swift': 'let testcaseCount = 1\n',
    'Sources/Service.swift': 'let testcaseCount = 1\n',
    'apps/web/verification/entry.js': 'export const testcaseCount = 1;\n',
    'apps/web/qa/entry.js': 'export const testcaseCount = 1;\n',
    'apps/web/src/entry.js': 'export const testcaseCount = 1;\n',
    'apps/api/verification/entry.js': 'export const testcaseCount = 1;\n',
};

export const TEST_PATH_POLICY =
    'level = "all"\nconfigurations = ["javascript", "swift", "naming"]\ntest_files = ["qa/**"]\n[scope."apps/web"]\ntest_files = ["verification/**"]\n[scope."apps/api"]\n';
