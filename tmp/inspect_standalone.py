import re

with open('public/standalone.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Let's inspect line 890-1050
print("Total lines:", len(lines))
for idx, line in enumerate(lines[890:950], start=891):
    if "Official Header" in line or "docs-table th, .docs-table td" in line:
        print(f"Line {idx}: {repr(line)}")
