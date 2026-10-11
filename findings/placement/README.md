# Placement

Where every file, function, constant, type, and test goes, or that it is deleted: one row for each
item, with the decision, the target file and name, and the reason. Every row has a decision, a target, and a reason;
no two items claim the same target name; every unit test sits at the path of the source file it tests.

**9313 rows.** move 3708, keep 2320, delete 1929, rename 531, merge 345, inline 314, split 166.

`target-tree.md` lists every file of the target layout. The pages below hold the rows, one page per part.

| Page                                                                                                                                | Rows | keep | rename | move | merge | inline | delete | split |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---: | ---: | -----: | ---: | ----: | -----: | -----: | ----: |
| [Source: the general checks](source-checks-general.md)                                                                              |  320 |   87 |     52 |  108 |     7 |     13 |     53 |     0 |
| [Source: the language, framework, library, platform, infrastructure, testing, and database checks](source-checks-other.md)          |  325 |  100 |    102 |   89 |     3 |      6 |     25 |     0 |
| [Source: the CLI entry, commands, terminal, ESLint plugin, scripts, and docs site](source-commands-plugin-scripts-docs.md)          |  604 |  211 |     97 |  146 |    16 |     21 |    112 |     1 |
| [Source: running checks and writing generated files](source-execution-generation.md)                                                |  394 |  142 |     19 |  187 |     3 |      2 |     40 |     1 |
| [Source: install, apply, ownership, planning, tools, rules, and the shipped configurations](source-install-tools-configurations.md) |  684 |  170 |     19 |  389 |    23 |     11 |     66 |     6 |
| [Source: system (was platform) and repository](source-system-repository.md)                                                         |  441 |   51 |     14 |  317 |     5 |     13 |     41 |     0 |
| [Source: parsers/schema, parsers/tool, parsers/output](source-parsers-schema-tool-output.md)                                        |  222 |    0 |      3 |  173 |     6 |      6 |     33 |     1 |
| [Source: the other parsers](source-parsers-other.md)                                                                                |  504 |   97 |     49 |  299 |     9 |      4 |     46 |     0 |
| [Source: settings (was policy)](source-settings.md)                                                                                 |  292 |    0 |    143 |   91 |     9 |      8 |     41 |     0 |
| [Tests: the general checks](tests-checks-general.md)                                                                                |  491 |  147 |      0 |  167 |     6 |     11 |    141 |    19 |
| [Tests: the other checks](tests-checks-other.md)                                                                                    |  545 |  127 |      0 |  180 |    36 |     11 |    177 |    14 |
| [Tests: file generation](tests-generation.md)                                                                                       |  683 |  146 |      0 |  306 |    41 |      6 |    168 |    16 |
| [Tests: commands, configurations, rules](tests-commands.md)                                                                         |  704 |  283 |      0 |  142 |    10 |     25 |    228 |    16 |
| [Tests: execution, install, apply, ownership](tests-execution-install.md)                                                           |  401 |  148 |      0 |   88 |    15 |     16 |    121 |    13 |
| [Tests: parsers and settings](tests-parsers-settings.md)                                                                            |  577 |  154 |      0 |  140 |    36 |     13 |    216 |    18 |
| [Tests: planning, system, repository, tools](tests-system-repository.md)                                                            |  552 |  204 |      0 |  172 |     5 |     26 |    125 |    20 |
| [Tests: integration tests of the configurations](tests-integration-configurations.md)                                               |  775 |  175 |     29 |  297 |    63 |     59 |    135 |    17 |
| [Tests: the other integration tests](tests-integration-other.md)                                                                    |  332 |   66 |      3 |  107 |    43 |     15 |     88 |    10 |
| [Tests: shared test code, shared test data, end-to-end tests, ESLint plugin tests](tests-setup-data-e2e-eslint-plugin.md)           |  467 |   12 |      1 |  310 |     9 |     48 |     73 |    14 |
