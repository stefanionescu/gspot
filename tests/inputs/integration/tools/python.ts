export const PYTHON_PROJECTS = [
    ['uv.toml', 'none'],
    ['pyproject.toml', 'mise'],
    ['pyproject.toml', 'none'],
] as const;
export const RUFF_WHEEL = String.raw`import sys, zipfile, hashlib, base64, csv, io
binary, target, version = sys.argv[1:]
info = "ruff-" + version + ".dist-info"
entries = {
 "ruff-" + version + ".data/scripts/ruff": open(binary, "rb").read(),
 "gspot_marker.py": b"def main():\n import sys\n print(sys.prefix)\n",
 info + "/entry_points.txt": b"[console_scripts]\ngspot-relocation-marker = gspot_marker:main\n",
 info + "/METADATA": ("Metadata-Version: 2.1\nName: ruff\nVersion: " + version + "\n").encode(),
 info + "/WHEEL": b"Wheel-Version: 1.0\nGenerator: gspot-acceptance\nRoot-Is-Purelib: false\nTag: py3-none-any\n"
}
record = io.StringIO(); writer = csv.writer(record)
for path, data in entries.items(): writer.writerow([path, "sha256=" + base64.urlsafe_b64encode(hashlib.sha256(data).digest()).decode().rstrip("="), len(data)])
writer.writerow([info + "/RECORD", "", ""]); entries[info + "/RECORD"] = record.getvalue().encode()
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
 for path, data in entries.items():
  entry = zipfile.ZipInfo(path); entry.external_attr = (0o100755 if path.endswith("/ruff") else 0o100644) << 16; archive.writestr(entry, data)
`;
