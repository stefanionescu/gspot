#!/usr/bin/env python3
"""Pack the installed Ruff binary for private-index credential tests."""

import io
import csv
import sys
import base64
import hashlib
from pathlib import Path
import zipfile


def main() -> int:
    """Pack the installed Ruff binary and relocation marker into a wheel.

    Returns:
        Zero after the wheel archive is written.

    """
    binary_path, wheel_path, version = sys.argv[1:]
    wheel_metadata = f'ruff-{version}.dist-info'
    entries = {
        f'ruff-{version}.data/scripts/ruff': Path(binary_path).read_bytes(),
        'gspot_marker.py': b'def main():\n import sys\n print(sys.prefix)\n',
        wheel_metadata + '/entry_points.txt': b'[console_scripts]\ngspot-relocation-marker = gspot_marker:main\n',
        wheel_metadata + '/METADATA': (f'Metadata-Version: 2.1\nName: ruff\nVersion: {version}\n').encode(),
        wheel_metadata
        + '/WHEEL': b'Wheel-Version: 1.0\nGenerator: gspot-acceptance\nRoot-Is-Purelib: false\nTag: py3-none-any\n',
    }
    record = io.StringIO()
    writer = csv.writer(record)
    for path, data in entries.items():
        writer.writerow(
            [
                path,
                'sha256=' + base64.urlsafe_b64encode(hashlib.sha256(data).digest()).decode().rstrip('='),
                len(data),
            ]
        )
    writer.writerow([wheel_metadata + '/RECORD', '', ''])
    entries[wheel_metadata + '/RECORD'] = record.getvalue().encode()
    with zipfile.ZipFile(wheel_path, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path, data in entries.items():
            entry = zipfile.ZipInfo(path)
            entry.external_attr = (0o100755 if path.endswith('/ruff') else 0o100644) << 16
            archive.writestr(entry, data)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
