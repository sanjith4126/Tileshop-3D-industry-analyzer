"""Writes the remediation slice of every open row into docs/CONFORMANCE_REPORT.md (Slice column).

The mapping below is the single source of truth for which slice closes which row; docs/REMEDIATION_PLAN.md
describes each slice. Usage: python scripts/assign_slices.py  (fails if an open row has no slice).
"""
import pathlib
import re
import sys

REPORT = pathlib.Path(__file__).resolve().parents[1] / 'docs' / 'CONFORMANCE_REPORT.md'

SLICES: dict[str, list[str]] = {
    # P0 — data honesty, security, licences
    'S01': ['2-01', '2-02', '2-03', '2-07', '2-08', '2-11', '7-06'],
    'S02': ['2-15'],
    'S03': ['12-02', '12-04', '12-05', '12-07', '12-08', '12-09', '12-10', '12-11'],
    'S04': ['4-04', '12-12', '12-13', '12-14', '12-15', '12-18', 'B-01'],
    'S05': ['12-16', '12-17', '2-17', '16-05', '17-03', 'B-02', 'B-16', 'B-17', '11-14', 'B-04', 'B-05', 'B-06', 'B-07', 'B-14', 'B-15'],
    'S06': ['12-22', '12-23', '12-24', '12-25', '12-27', '9-08', '12-31', '17-04'],
    'S07': ['12-30'],
    'S08': ['4-16', '17-07', '17-05'],
    # P1 — policy correctness, data integrity, backend authority
    'S09': ['6-04', '6-05', '6-06', '6-08', '7-14', '11-06', '11-07', '11-10', 'B-03'],
    'S10': ['5-21', '8-07'],
    'S11': ['7-01', '7-02', '7-03', '7-04', '7-05', '7-07', '7-08', '7-09', '7-10', '7-11', '7-12', '7-13', '7-15', '3-05', '18-11', '20-03'],
    'S12': ['7-16', '7-17', '7-18', '7-19', '7-20', '7-21', '7-23', '7-24', '7-25', '7-26', '7-27', '20-04'],
    'S13': ['8-02', '8-03', '8-04', '8-05', '8-06', '8-08', '8-09', '8-11', '8-12', '20-06'],
    'S14': ['9-02', '9-03', '9-04', '9-05', '9-07', '9-09', '9-10', '9-11', '9-12', '9-13', '5-25', '3-09', '20-12'],
    'S15': ['9-14', '9-15', '9-16', '9-17'],
    'S16': ['10-01', '10-02', '10-03', '10-04', '10-05', '10-06', '10-08', '10-16', 'B-09', 'B-10', '20-05'],
    'S17': ['10-09', '10-10', '10-11', '10-13', 'B-11', 'B-12', 'B-13'],
    'S18': ['10-14', '10-15', 'B-08'],
    'S19': ['7-28', '7-29', '2-09'],
    'S20': ['5-20', '11-04', '11-05', '11-08', '11-01', '11-12', '20-08'],
    # P2 — architecture, API, observability, performance, degraded modes
    'S21': ['5-24', '11-13', '3-01', '3-02', '5-04', '5-07', '5-09', '5-10', '5-11', '5-12', '3-10', '4-05', '12-20', '20-10'],
    'S22': ['5-01', '5-06', '5-19', '4-08', '8-01', '18-12', '18-13', '18-14', '17-02', '18-10'],
    'S23': ['13-01', '13-02', '13-03', '13-04', '13-06', '13-07', '13-08', '13-09', '13-10', '13-11', '20-09', '5-14', '5-15', '5-17', '12-28', '3-03'],
    'S24': ['3-04', '4-07', '19-01', '19-02', '19-03', '19-05', '19-06', '19-07', '18-15'],
    'S25': ['18-05', '18-06', '18-07', '18-08', '11-17'],
    'S26': ['16-01', '16-02', '16-03', '16-04', '16-06', '16-07', '16-09', '16-10', '16-11', '16-12', '16-13', '5-05'],
    'S27': ['22-01', '22-02', '22-03', '22-04', '22-06', '12-26', '12-29', '4-06', '4-10', '4-12', '4-17', '4-19', '4-14', '20-07'],
    'S28': ['20-11', '20-13', '20-14', '18-03'],
    # P3 — design system, accessibility, UX consistency, 3D twin
    'S29': ['3-08', '14-02', '14-03', '14-04', '14-05', '14-06', '14-08', '14-09', '14-10', '14-11', '4-02', '5-13', '5-26'],
    'S30': ['14-12', '14-13', '14-14', '14-15', '14-16', '14-17', '14-18', '14-19', '8-10', '7-30'],
    'S31': ['14-20', '14-21', '14-22', '14-23', '14-24', '14-25', '14-26', '17-01', '17-06'],
    'S32': ['6-07', '15-02', '15-04', '15-05', '15-06', '15-07', '15-08', '15-09', '15-10', '18-04'],
    # P4 — documentation, ADRs, demo script
    'S33': ['2-19', '2-20', '4-18', '5-18', '11-11', '11-18', '11-20', '12-19', '12-32', '20-01', '21-01', '21-02', '21-03',
            '21-04', '21-05', '21-06', '21-07', '21-08', '22-05', '22-07', '22-08'],
    # Approved exceptions (docs/EXCEPTIONS.md)
    'EX-01': ['11-03'],
}

CELL_SPLIT = re.compile(r'(?<!\\)\|')


def main() -> None:
    owner = {}
    for slice_id, ids in SLICES.items():
        for i in ids:
            if i in owner:
                sys.exit(f'row {i} assigned twice ({owner[i]}, {slice_id})')
            owner[i] = slice_id
    lines = REPORT.read_text(encoding='utf-8').splitlines()
    missing, unknown_status = [], []
    seen = set()
    for n, line in enumerate(lines):
        if not line.startswith('| ') or line.startswith('|---'):
            continue
        cells = CELL_SPLIT.split(line)
        inner = [c.strip() for c in cells[1:-1]]
        if len(inner) != 8 or inner[2] not in {'CONFORMS', 'PARTIAL', 'MISSING', 'VIOLATES', 'NOT_APPLICABLE'}:
            continue
        rid, status = inner[0], inner[2]
        seen.add(rid)
        if status in ('CONFORMS', 'NOT_APPLICABLE'):
            continue
        if rid not in owner:
            missing.append(rid)
            continue
        cells[-2] = f' {owner[rid]} '
        lines[n] = '|'.join(cells)
    stray = sorted(set(owner) - seen)
    if missing or stray:
        sys.exit(f'open rows without a slice: {missing}\nmapped IDs not in the report: {stray}')
    REPORT.write_text('\n'.join(lines) + '\n', encoding='utf-8', newline='\n')
    print(f'assigned {sum(len(v) for v in SLICES.values())} rows to {len(SLICES)} slices')


if __name__ == '__main__':
    main()
