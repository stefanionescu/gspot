const SWIFT_PACKAGE = `// swift-tools-version:5.9
import PackageDescription
let package = Package(
    name: "App",
    targets: [
        .target(name: "Core"),
        .target(name: "Feature", dependencies: ["Core"], path: "Sources/FeatureKit"),
        .testTarget(name: "CoreTests", dependencies: ["Core"]),
    ]
)
`;

export const PYTHON_IMPORT_RULES = `[python]
externals = ["folder_paths"]

[[import_rule]]
name = "core"
paths = ["src/app/core/**"]

[[import_rule]]
name = "storage"
paths = ["src/app/storage/**"]

[[import_rule]]
name = "web"
paths = ["src/app/web/**"]
can_import = ["storage"]
`;

export const PYTHON_IMPORT_FILES = {
    'src/app/__init__.py': '',
    'src/app/core/__init__.py': '',
    'src/app/core/model.py': 'VALUE = 1\n',
    'src/app/core/uses_web.py': 'from app.web import views\n',
    'src/app/storage/__init__.py': '',
    'src/app/storage/db.py': 'from app.core.model import VALUE\n',
    'src/app/web/views.py':
        'import folder_paths\nfrom app.core import model\nfrom app.storage.db import VALUE\nfrom ..core.model import VALUE as AGAIN\nimport requests\n',
    'tests/test_views.py': 'from app.web import views\n',
    'setup.py': '',
} as const;

export const SWIFT_IMPORT_RULES = `[[import_rule]]
name = "core"
paths = ["Sources/Core/**"]

[[import_rule]]
name = "feature"
paths = ["Sources/FeatureKit/**"]
`;

export const SWIFT_IMPORT_FILES = {
    'Package.swift': SWIFT_PACKAGE,
    'Sources/Core/Model.swift': 'import Foundation\nimport Feature\npublic struct Model {}\n',
    'Sources/FeatureKit/View.swift': 'import Core\npublic struct View {}\n',
    'Sources/Loose/Helper.swift': 'public struct Helper {}\n',
    'Tests/CoreTests/ModelTests.swift': 'import Core\n',
} as const;

export const REFUSAL_HINT =
    'Move the code, move that rule above this one, or list the rules it may import in can_import.';
