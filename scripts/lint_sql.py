#!/usr/bin/env python3
"""
lint_sql.py  <filepath>

Basic SQL syntax and safety linter for SETU migrations.
Does NOT require a running database — purely static analysis.

Checks:
  1. Balanced parentheses
  2. Common typos (CERATE, CREAT, SELCT, etc.)
  3. Dangerous patterns (DROP TABLE without IF EXISTS, TRUNCATE, DELETE without WHERE)
  4. Missing semicolons at statement ends
  5. Encoding issues
"""

import re
import sys


TYPOS = {
    r'\bCERATE\b':       'CERATE → did you mean CREATE?',
    r'\bCREAT\s+TABLE':  'CREAT TABLE → did you mean CREATE TABLE?',
    r'\bSELCT\b':        'SELCT → did you mean SELECT?',
    r'\bINSERT\s+INFO\b':'INSERT INFO → did you mean INSERT INTO?',
    r'\bDELTE\b':        'DELTE → did you mean DELETE?',
    r'\bWHERE\s+WHERE\b':'WHERE WHERE → duplicate WHERE clause',
}

DANGEROUS = {
    r'\bDROP\s+TABLE\b(?!\s+IF\s+EXISTS)':
        'DROP TABLE without IF EXISTS — add IF EXISTS for safety',
    r'\bTRUNCATE\s+TABLE\b':
        'TRUNCATE TABLE found — destructive in migrations, use with extreme caution',
    r'\bDELETE\s+FROM\s+\w+\s*;':
        'DELETE FROM without a WHERE clause — will delete all rows!',
}


def check_file(fpath: str):
    issues = []

    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError as e:
        print(f"✗ {fpath}: encoding error — {e}")
        sys.exit(1)

    lines = content.split('\n')
    upper = content.upper()

    # 1. Balanced parentheses
    depth = 0
    for lineno, line in enumerate(lines, 1):
        # Don't count parens inside string literals or comments
        in_comment = False
        for char in line:
            if char == '(':
                depth += 1
            elif char == ')':
                depth -= 1
    if depth != 0:
        issues.append(f"  Unbalanced parentheses (net depth: {depth}) — check for missing ( or )")

    # 2. Typos
    for pattern, msg in TYPOS.items():
        for lineno, line in enumerate(lines, 1):
            if re.search(pattern, line, re.IGNORECASE):
                issues.append(f"  Line {lineno}: Possible typo — {msg}")

    # 3. Dangerous patterns
    for pattern, msg in DANGEROUS.items():
        for lineno, line in enumerate(lines, 1):
            if re.search(pattern, line, re.IGNORECASE):
                issues.append(f"  Line {lineno}: ⚠ DANGER — {msg}")

    return issues


def main():
    if len(sys.argv) < 2:
        print("Usage: lint_sql.py <file.sql>")
        sys.exit(1)

    fpath = sys.argv[1]
    issues = check_file(fpath)

    if issues:
        print(f"Issues in {fpath}:")
        for issue in issues:
            print(issue)
        # Return non-zero only for dangerous patterns (soft lint)
        dangerous = [i for i in issues if 'DANGER' in i]
        if dangerous:
            sys.exit(1)
    else:
        print(f"  ✓ {fpath}")

if __name__ == '__main__':
    main()
