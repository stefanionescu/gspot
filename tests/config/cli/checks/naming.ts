export const SCOPE_POLICY =
    'configurations = ["naming", "bash"]\n[naming]\nallowed = [{name = "remoteRecord", reason = "The external JavaScript interface fixes this name."}]\n[[naming.paths]]\npaths = ["web/source.js"]\nnames = ["remoteRecord"]\nskip = true\nreason = "The external JavaScript interface fixes this name."\n[[scope]]\npath = "web"\nconfigurations = ["javascript"]\n[scope.naming]\nallowed = [{name = "remoteRecord", reason = "The external JavaScript interface fixes this name."}]\n[[scope]]\npath = "worker"\nconfigurations = ["python"]\n[scope.naming]\nallowed = [{name = "remote_record", reason = "The external Python interface fixes this name."}]\n';

export const TEST_PATH_POLICY =
    'level = "all"\nconfigurations = ["javascript", "swift", "naming"]\ntests = ["qa/**"]\n[[scope]]\npath = "apps/web"\ntests = ["verification/**"]\n[[scope]]\npath = "apps/api"\n';

export const TEST_PATH_FILES = {
    'qa/entry.js': 'export const actualValue = 1;\n',
    'tests/default.js': 'export const actualValue = 1;\n',
    'src/entry.js': 'export const actualValue = 1;\n',
    'Tests/Service.swift': 'let actualValue = 1\n',
    'Sources/ServiceTests.swift': 'let actualValue = 1\n',
    'Sources/Service.swift': 'let actualValue = 1\n',
    'apps/web/verification/entry.js': 'export const actualValue = 1;\n',
    'apps/web/qa/entry.js': 'export const actualValue = 1;\n',
    'apps/web/src/entry.js': 'export const actualValue = 1;\n',
    'apps/api/verification/entry.js': 'export const actualValue = 1;\n',
};
