---
title: "Quickstart: Swift"
description: Initialize a Swift project and correct a source finding.
---

Read [Requirements](/guides/requirements/) and [Install](/guides/install/) first. This example runs on macOS.

Replace `<version>` with the exact version from the [npm package page](https://www.npmjs.com/package/@gspothq/cli).

## Create the project

```shell
mkdir orders-swift && cd orders-swift
git init
swift package init --type library
```

Replace the scaffold source and test with a small calculation and a test that uses it:

```swift title="Sources/orders-swift/orders_swift.swift"
public func total(_ values: [Int]) -> Int {
    values.reduce(0, +)
}
```

```swift title="Tests/orders-swiftTests/orders_swiftTests.swift"
import Testing
@testable import orders_swift

@Test func totalsValues() {
    #expect(total([1, 2, 3]) == 6)
}
```

Commit the project before initialization:

```shell
git add -A
git commit -m "feat: Create the project"
```

## Set up gspot

From a clean working tree, initialize and choose mise as the runner:

```shell
mise exec npm:@gspothq/cli@<version> -- gspot init --configurations swift
```

Read the plan and accept it. Initialization prepares lockfiles and installs applicable tools. Trust the generated mise file, then prepare and diagnose the setup:

```shell
mise trust .mise/conf.d/gspot-tools.toml
mise install
mise exec -- gspot install
mise exec -- gspot doctor
mise exec -- gspot check
```

Resolve findings in the initial project before committing. If the repository also has npm or Python dependency manifests, those select the general `licenses` configuration automatically. Choose your [dependency license policy](/guides/dependency-licenses/) explicitly; the check remains skipped until an allowed license or exception is set.

Format the scaffold's package manifest and rerun the checks:

```shell
mise exec -- gspot check --fix
mise exec -- gspot check
```

```shell
git add -A
git commit -m "chore: Set up gspot"
```

## See a finding

Temporarily replace a source file with this forced cast:

```swift title="Sources/orders-swift/orders_swift.swift"
public func total(_ value: Any) -> Int {
    value as! Int
}
```

Run the source check:

```shell
mise exec -- gspot check --only swift/swiftlint
```

The check exits nonzero and reports:

```text
Sources/orders-swift/orders_swift.swift:2:11  force_cast  Force casts should be avoided
```

Stage the changed file and attempt a commit to see the pre-commit hook reject it. The report names the file and explains the correction.

## Correct the source

Restore the valid source from the setup commit:

```shell title="Restore the Swift example"
git restore --source=HEAD --staged --worktree -- Sources/orders-swift/orders_swift.swift
mise exec -- gspot check --only swift/swiftlint
```

The same check now reports no forced-cast finding. To check additional conventions, select [level `all`](/guides/overview/#levels) with `mise exec -- gspot set level all`, run the checks, and resolve the findings before committing.

## Continue

Read [Fix findings](/guides/findings/) for individual checks and [Reuse templates](/guides/templates/) to share settings with another repository.
