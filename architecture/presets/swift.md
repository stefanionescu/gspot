# `swift`

Kind: language. Requires: structure, naming, formatting, spelling.

## Detects and claims

|                      |                                                                  |
| -------------------- | ---------------------------------------------------------------- |
| Detect               | `.swift` in the tree; `Package.swift`; `*.xcodeproj`             |
| Claims               | `.swift`, `Package.swift`, `Package.resolved`                    |
| Required inspections | format, syntax, style, types, structure, naming, prose, spelling |

## Tools

swiftlint, swiftformat, periphery, xcodebuild (host), swift (host).

## Generated configuration

| Target                       | Stub                                  | Holds                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.gspot/swiftlint.yml`       | `.swiftlint.yml` with `parent_config` | the 87 opt-in rules, 4 analyzer rules, limits from `[limits]`, `identifier_name` and `type_name` off, `missing_docs` on open and public, `explicit_acl`, `explicit_top_level_acl`, `private_over_fileprivate`, `file_name_no_space`, `file_header`, custom rules for `///` and banned-term regexes as a second line of defense |
| `.gspot/swiftlint.tests.yml` | none                                  | the snapshot-test config from `[tools.swiftlint.extra_configs]`                                                                                                                                                                                                                                                                |
| `.gspot/swiftformat`         | `.swiftformat`                        | the enabled and disabled rule lists, options from `[format]`                                                                                                                                                                                                                                                                   |
| `.gspot/periphery.yml`       | none                                  | project, schemes, retain options                                                                                                                                                                                                                                                                                               |

## Checks

| Id                                                                                                                                         | Stage       | Command                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------- |
| `swift/swiftlint`                                                                                                                          | commit      | `swiftlint lint --strict --quiet --config .gspot/swiftlint.yml --reporter json {files}`       |
| `swift/swiftformat`                                                                                                                        | commit      | `swiftformat --lint --config .gspot/swiftformat {files}`; fix order format                    |
| `swift/build`                                                                                                                              | push, build | `xcodebuild build-for-testing` or `swift build`, log kept for analyze                         |
| `swift/swiftlint-analyze`                                                                                                                  | push, build | `swiftlint analyze --strict --compiler-log-path <log>`                                        |
| `swift/periphery`                                                                                                                          | push, build | `periphery scan --config .gspot/periphery.yml --strict`                                       |
| `structure/trivial-function`, `call-through`, `duplicate-functions`, `single-file-folder`, `prefix-collisions`, `file-directory-collision` | commit      | engine                                                                                        |
| `structure/private-before-public`                                                                                                          | commit      | `private` and `fileprivate` top-level declarations above `internal`, `public` and `open` ones |
| `structure/env-access-owner`                                                                                                               | commit      | `ProcessInfo.processInfo.environment` read only in the configuration owner                    |

Every check here is a platform skip on Linux and Windows.

The five SwiftLint rules the reference repository measured and left off (`no_magic_numbers`,
`type_contents_order`, `one_declaration_per_file`, `file_types_order`, `no_empty_block`) are on
and enter with a baseline.

## Shipped rule sets

The preset renders these lists. They are the measured set of the reference repository, so the
acceptance run compares like with like. A person turns one rule off with
`gspot ignore swift/swiftlint --rule <id>` and a reason.

SwiftLint opt-in rules, 87:

```text
missing_docs explicit_init fatal_error_message first_where last_where empty_count empty_string
contains_over_first_not_nil contains_over_filter_count contains_over_filter_is_empty
contains_over_range_nil_comparison direct_return empty_collection_literal
flatmap_over_map_reduce untyped_error_in_catch accessibility_label_for_image
accessibility_trait_for_button private_swiftui_state prefer_self_in_static_references
closure_body_length closure_spacing array_init sorted_first_last collection_alignment
enum_case_associated_values_count switch_case_on_newline vertical_whitespace_between_cases
multiline_arguments multiline_arguments_brackets multiline_function_chains
multiline_literal_brackets multiline_parameters multiline_parameters_brackets number_separator
vertical_parameter_alignment_on_call vertical_whitespace_closing_braces
vertical_whitespace_opening_braces async_without_await convenience_type fallthrough
force_unwrapping function_default_parameter_at_end implicitly_unwrapped_optional
joined_default_parameter legacy_multiple legacy_random literal_expression_end_indentation
lower_acl_than_parent operator_usage_whitespace overridden_super_call
prefer_zero_over_explicit_init private_action private_outlet prohibited_super_call
raw_value_for_camel_cased_codable_enum reduce_into redundant_nil_coalescing
redundant_type_annotation static_operator toggle_bool trailing_closure unavailable_function
unneeded_parentheses_in_closure_argument unowned_variable_capture yoda_condition
balanced_xctest_lifecycle empty_xctest_method final_test_case test_case_accessibility
xct_specific_matcher unhandled_throwing_task discarded_notification_center_observer
identical_operands return_value_from_void_function weak_delegate superfluous_else
pattern_matching_keywords optional_enum_case_matching shorthand_optional_binding self_binding
prefer_key_path implicit_return redundant_self local_doc_comment period_spacing
prefer_self_type_over_type_of_self unneeded_override
```

SwiftLint opt-in rules added beyond the reference set, on with a baseline at `init`:

```text
no_magic_numbers type_contents_order one_declaration_per_file file_types_order no_empty_block
explicit_acl explicit_top_level_acl private_over_fileprivate file_name_no_space file_header
```

SwiftLint analyzer rules, 4, run by `swift/swiftlint-analyze`:

```text
capture_variable typesafe_array_init unused_import unused_declaration
```

SwiftLint disabled rules, 10. `identifier_name` and `type_name` are off because the naming
engine owns names. `trailing_whitespace`, `opening_brace` and `statement_position` are off because
SwiftFormat owns layout:

```text
trailing_whitespace opening_brace statement_position todo identifier_name type_name
discouraged_optional_collection discouraged_optional_boolean notification_center_detachment
large_tuple
```

SwiftLint options. Each number comes from `[limits]` and `[limits.swift]`, and warning equals error:

| Rule                    | Setting                            | Shipped                                    | Options                                                            |
| ----------------------- | ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `line_length`           | `format.print_width`               | 120                                        | `ignores_comments`, `ignores_urls`, `ignores_interpolated_strings` |
| `file_length`           | `limits.file_lines`                | 300                                        | `ignore_comment_only_lines`                                        |
| `type_body_length`      | `limits.swift.type_body_length`    | 300                                        |                                                                    |
| `function_body_length`  | `limits.function_lines`            | 60                                         |                                                                    |
| `closure_body_length`   | `limits.swift.closure_body_length` | 60                                         |                                                                    |
| `cyclomatic_complexity` | `limits.cyclomatic_complexity`     | 8                                          | `ignores_case_statements`                                          |
| `nesting`               | `limits.nesting`                   | type 1, function 2                         |                                                                    |
| `missing_docs`          | none                               | error for `open` and `public`              | `excludes_extensions`, `excludes_inherited_types`                  |
| `unused_import`         | `tools.swiftlint.keep_imports`     | `CoreGraphics`                             |                                                                    |
| `file_header`           | none                               | `forbidden_pattern` for any header comment | agrees with SwiftFormat `--header strip`                           |

`included` and `excluded` are not rendered: gspot passes the file list. The shipped exclusions
are file natures: `Pods`, `DerivedData`, `build`, `.build` and `Generated` folders are vendored
or generated, and `*.generated.swift` is generated.

SwiftFormat options. `--indent`, `--maxwidth` and `--linebreaks` come from `[format]`.
`--swiftversion` comes from `tools.swiftformat.swift_version`, and `init` reads the proposal from
`Package.swift` or the project's `SWIFT_VERSION`:

```text
--indent 4
--indentcase false
--ifdef indent
--maxwidth 120
--wraparguments before-first
--wrapparameters before-first
--wrapcollections before-first
--wrapreturntype preserve
--wrapconditions preserve
--closingparen same-line
--nospaceoperators ...,..<
--operatorfunc spaced
--ranges spaced
--allman false
--elseposition same-line
--guardelse next-line
--emptybraces no-space
--trimwhitespace always
--linebreaks lf
--importgrouping length,alpha
--self init-only
--header strip
--swiftversion 5.9
```

SwiftFormat rules enabled, 50:

```text
blankLineAfterImports blankLinesAroundMark blankLinesAtEndOfScope blankLinesAtStartOfScope
blankLinesBetweenScopes consecutiveBlankLines consecutiveSpaces duplicateImports elseOnSameLine
emptyBraces hoistPatternLet leadingDelimiters linebreakAtEndOfFile linebreaks modifierOrder
redundantBackticks redundantBreak redundantClosure redundantExtensionACL redundantFileprivate
redundantGet redundantInit redundantLet redundantLetError redundantNilInit redundantObjc
redundantParens redundantPattern redundantRawValues redundantReturn redundantVoidReturnType
semicolons sortImports spaceAroundBraces spaceAroundBrackets spaceAroundComments
spaceAroundGenerics spaceAroundOperators spaceAroundParens spaceInsideBraces
spaceInsideBrackets spaceInsideComments spaceInsideGenerics spaceInsideParens strongOutlets
strongifiedSelf todos trailingSpace typeSugar void
```

SwiftFormat rules disabled, 17. `redundantSelf` is off because `--self init-only` and the
SwiftLint rule `redundant_self` own it. The wrap rules are off because a formatter that rewraps
every argument list makes diffs nobody reads:

```text
redundantSelf trailingCommas wrapMultilineStatementBraces sortSwitchCases wrapEnumCases
unusedArguments acronyms organizeDeclarations sortDeclarations markTypes trailingClosures wrap
wrapArguments wrapAttributes initCoderUnavailable blankLinesBetweenImports numberFormatting
```

Periphery: `retain_public`, `retain_objc_accessible`, `retain_assign_only_properties`,
`retain_unused_protocol_func_params`, `retain_swift_ui_previews` and `retain_codable_properties`
are true. `project` and `schemes` come from `tools.xcode.project` and `tools.xcode.scheme`, and
`init` proposes the first shared scheme `xcodebuild -list` prints.

The engine analyses `trivial-function`, `call-through` and `duplicate-functions` read shell
scripts today. The SwiftLint rules `type_contents_order`, `file_types_order`, and
`unused_declaration` cover ordering and dead code for Swift until those analyses read the Swift grammar.

## Settings

`tools.swiftlint.extra_configs`, `tools.swiftlint.keep_imports`, `tools.swiftformat.swift_version` (a rule turned off is `gspot ignore swift/swiftlint --rule <id>`, rendered into `disabled_rules`), `tools.swiftformat.options`,
`tools.periphery.retain`, `tools.xcodebuild.scheme`, `tools.xcodebuild.destination`.

## Rule files

`language/SWIFT.md`, `language/naming/SWIFT.md`; `framework/swiftui/SWIFTUI.md` and
`framework/uikit/UIKIT.md` when the corresponding import appears in the sources.

## Not covered here

Package dependency scanning: osv-scanner has no `Package.resolved` extractor. The dependencies
preset reports the gap.
