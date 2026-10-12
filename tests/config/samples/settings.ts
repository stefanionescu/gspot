export const DATED_IGNORE = `configurations = ["bash"]
# Keep the authored expiry.
[[ignore]]
check = "bash/shellcheck"
reason = "The launcher intentionally retains word splitting."
until = 2099-05-20
`;

export const NPM_CHECK_IGNORES = `[[ignore]]
check = "files/v8r"
reason = "This sandbox exercises tools without JSON schema checks."
[[ignore]]
check = "format/editorconfig-checker"
reason = "This sandbox exercises tools without the npm editor checker."
[[ignore]]
check = "format/prettier"
reason = "This sandbox exercises tools without the npm formatter."
`;

export const COMMENTED_SETTINGS = `#:schema x

# Comment on configurations.
configurations = ["bash"]

[hooks]
# gspot checks the changed paths of a push.
enabled = true
`;
