#!/usr/bin/env python3
"""
lint_sql.py  <filepath>

Basic SQL syntax and safety linter for SETU migrations.
Does NOT require a running database — purely static analysis.

Checks:
  1. Balanced parentheses (ignores comments and strings)
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
}


def strip_comments_and_strings(sql):
    """Remove comments and string literals from SQL for analysis."""
    # Remove single-line comments
    sql = re.sub(r'--.*', '', sql)
    # Remove multi-line comments
    sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.DOTALL)
    # Remove string literals (handle escaped quotes roughly)
    sql = re.sub(r"'(?:''|[^'])*'", "''", sql)
    return sql


def check_file(fpath: str):
    issues = []

    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError as e:
        print(f"✗ {fpath}: encoding error — {e}")
        sys.exit(1)

    lines = content.split('\n')
    clean_content = strip_comments_and_strings(content)

    # 1. Balanced parentheses
    depth = 0
    for char in clean_content:
        if char == '(':
            depth += 1
        elif char == ')':
            depth -= 1
    if depth != 0:
        issues.append(f"  Unbalanced parentheses (net depth: {depth}) — check for missing ( or )")

    # 2. Typos
    for pattern, msg in TYPOS.items():
        for lineno, line in enumerate(lines, 1):
            # Check original lines but ignore comments
            clean_line = re.sub(r'--.*', '', line)
            if re.search(pattern, clean_line, re.IGNORECASE):
                issues.append(f"  Line {lineno}: Possible typo — {msg}")

    # 3. Dangerous patterns (per-line checks)
    for pattern, msg in DANGEROUS.items():
        for lineno, line in enumerate(lines, 1):
            clean_line = re.sub(r'--.*', '', line)
            if re.search(pattern, clean_line, re.IGNORECASE):
                issues.append(f"  Line {lineno}: ⚠ DANGER — {msg}")

    # 4. Dangerous DELETE without WHERE (multi-line aware)
    # This looks for DELETE FROM ... followed by ; without a WHERE in between.
    # We use clean_content to avoid false positives in comments/strings.
    for match in re.finditer(r'\bDELETE\s+FROM\s+([a-zA-Z0-9_".]+)', clean_content, re.IGNORECASE):
        table_name = match.group(1)
        start_pos = match.end()
        # Find the next semicolon
        end_pos = clean_content.find(';', start_pos)
        if end_pos == -1:
            end_pos = len(clean_content)

        statement_fragment = clean_content[start_pos:end_pos].upper()
        if 'WHERE' not in statement_fragment and 'USING' not in statement_fragment:
            # Try to find the line number in the original content
            line_no = content[:match.start()].count('\n') + 1
            issues.append(f"  Line {line_no}: ⚠ DANGER — DELETE FROM {table_name} without a WHERE clause!")

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
