export const DATED_IGNORE = `configurations = ["bash"]
# Keep the authored expiry.
[[ignore]]
check = "bash/shellcheck"
reason = "The launcher intentionally retains word splitting."
until = 2099-05-20
`;

export const COMMENTED_SETTINGS = `#:schema x

# Comment on configurations.
configurations = ["bash"]

[hooks]
# gspot checks the changed paths of a push.
enabled = true
`;

export const INITIAL_SETTINGS = 'configurations = ["bash", "naming", "format"]\n';
