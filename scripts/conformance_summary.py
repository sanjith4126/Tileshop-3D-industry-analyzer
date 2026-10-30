"""Count docs/CONFORMANCE_REPORT.md rows by status and priority and (re)write the dated summary block.

Usage: python scripts/conformance_summary.py [YYYY-MM-DD]
The summary sits between the markers <!-- SUMMARY:BEGIN --> and <!-- SUMMARY:END --> (or replaces the
placeholder <!-- SUMMARY --> on first run). Row format follows Appendix D of docs/MASTER_PROMPT.md.
"""
import collections
import datetime
import pathlib
import re
import sys

REPORT = pathlib.Path(__file__).resolve().parents[1] / 'docs' / 'CONFORMANCE_REPORT.md'
STATUSES = ['CONFORMS', 'PARTIAL', 'MISSING', 'VIOLATES', 'NOT_APPLICABLE']
PRIORITIES = {
    'P0': 'data honesty, security, licences',
    'P1': 'policy correctness, data integrity, backend authority',
    'P2': 'architecture, API, observability, performance, degraded modes',
    'P3': 'design system, accessibility, UX, 3D twin',
    'P4': 'documentation, ADRs, demo script',
}
CELL_SPLIT = re.compile(r'(?<!\\)\|')  # a pipe not escaped with a backslash


def rows(text: str) -> list[list[str]]:
    out = []
    for line in text.splitlines():
        if not line.startswith('| ') or line.startswith('|---'):
            continue
        cells = [c.strip() for c in CELL_SPLIT.split(line)[1:-1]]
        if len(cells) == 8 and cells[2] in STATUSES:
            out.append(cells)
    return out


def summary(found: list[list[str]], day: str) -> str:
    total = len(found)
    by_status = collections.Counter(r[2] for r in found)
    open_rows = [r for r in found if r[2] != 'CONFORMS']
    cell = collections.Counter((r[5], r[2]) for r in open_rows)
    lines = [f'## Summary ({day})', '',
             f'{total} requirement rows (sections 2–22 and Appendix B).', '',
             '| Status | Rows | Share |', '|---|---:|---:|']
    lines += [f'| {s} | {by_status.get(s, 0)} | {round(100 * by_status.get(s, 0) / total)} % |' for s in STATUSES]
    lines += ['', 'Open rows (everything not CONFORMS) by priority:', '',
              '| Priority | Meaning | PARTIAL | MISSING | VIOLATES | Total |', '|---|---|---:|---:|---:|---:|']
    for p, meaning in PRIORITIES.items():
        a, m, v = (cell.get((p, s), 0) for s in ('PARTIAL', 'MISSING', 'VIOLATES'))
        lines.append(f'| {p} | {meaning} | {a} | {m} | {v} | {a + m + v} |')
    totals = [sum(n for (p, s), n in cell.items() if s == st) for st in ('PARTIAL', 'MISSING', 'VIOLATES')]
    lines.append(f'| **All** | | {totals[0]} | {totals[1]} | {totals[2]} | **{len(open_rows)}** |')
    return '\n'.join(lines)


def main() -> None:
    day = sys.argv[1] if len(sys.argv) > 1 else datetime.date.today().isoformat()
    text = REPORT.read_text(encoding='utf-8')
    found = rows(text)
    ids = collections.Counter(r[0] for r in found)
    problems = [f'duplicate ID {i}' for i, n in ids.items() if n > 1]
    problems += [f'{r[0]}: open row needs P0-P4' for r in found if r[2] != 'CONFORMS' and r[5] not in PRIORITIES]
    problems += [f'{r[0]}: CONFORMS row must not carry a priority' for r in found if r[2] == 'CONFORMS' and r[5] != '—']
    if problems:
        sys.exit('\n'.join(problems))
    block = f'<!-- SUMMARY:BEGIN -->\n{summary(found, day)}\n<!-- SUMMARY:END -->'
    if '<!-- SUMMARY -->' in text:
        text = text.replace('<!-- SUMMARY -->', block)
    else:
        text = re.sub(r'<!-- SUMMARY:BEGIN -->.*?<!-- SUMMARY:END -->', lambda _: block, text, flags=re.S)
    REPORT.write_text(text, encoding='utf-8', newline='\n')
    print(summary(found, day))


if __name__ == '__main__':
    main()
