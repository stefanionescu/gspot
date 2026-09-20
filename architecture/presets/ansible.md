# `ansible`

Kind: tool. Requires: config-files.

## Detects and claims

|        |                                             |
| ------ | ------------------------------------------- |
| Detect | `ansible.cfg` at any depth                  |
| Claims | `ansible.cfg`; YAML stays with config-files |

## Tools

ansible-lint. It has no Windows build, so the check is a platform skip there.

## Checks

| Id             | Stage  | Command                                                                                                 |
| -------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `ansible/lint` | commit | `ansible-lint --offline -f pep8` in every folder that holds an `ansible.cfg`; findings carry the folder |

A rule turned off is `gspot ignore ansible/lint --rule <rule> --reason`, passed as `--skip-list`.

## Why a preset

The check lived in config-files in an earlier draft. A preset installs its tools, so every
repository with a YAML file installed ansible-lint. Detection by `ansible.cfg` installs it only
where a playbook exists.
