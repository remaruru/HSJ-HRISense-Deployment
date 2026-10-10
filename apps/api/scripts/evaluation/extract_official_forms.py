"""
Extracts Hospicio de San Jose's official evaluation forms (the Word documents
HR supplied) into JSON, for src/data/official-evaluation-templates.data.ts and
for verify_official_forms.ts.

    python scripts/evaluation/extract_official_forms.py <folder with the .docx files> > forms.json

Only presentation is normalised, never wording:
  * a table cell that wraps onto a second line is joined with one space;
  * runs of spaces collapse to one;
  * the numbering ("1.", "a)", "a.") is dropped — HRISense re-letters items
    in the same order;
  * stray backtick characters (typing slips in EVAL FORM 4) are removed.
The sample names and positions typed into each form's header are NOT read.
"""
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W = '{%s}' % NS['w']

FILES = {
    'HSJ_EPR_FORM_1': 'EVAL FORM 1.docx',
    'HSJ_EPR_FORM_2': 'EVAL FORM 2.docx',
    'HSJ_EPR_FORM_3': 'EVAL FORM 3.docx',
    'HSJ_EPR_FORM_4': 'EVAL FORM 4.docx',
    'HSJ_SIMPLIFIED_SUPERVISORY': 'SIMPLIFIED EVALUATIONfor Coordinators.docx',
}


def text_of(el):
    out = []
    for node in el.iter():
        if node.tag == W + 't':
            out.append(node.text or '')
        elif node.tag == W + 'tab':
            out.append(' ')
    return ''.join(out)


def clean(s):
    s = s.replace('`', '')
    s = re.sub(r'\s+', ' ', s)
    return s.strip()


def cell_text(tc):
    """A cell's paragraphs joined with a space (a wrapped line is one sentence)."""
    return clean(' '.join(text_of(p) for p in tc.findall('.//w:p', NS) if text_of(p).strip()))


def cell_paragraphs(tc):
    return [clean(text_of(p)) for p in tc.findall('.//w:p', NS) if text_of(p).strip()]


def body_paragraphs(body):
    return [clean(text_of(p)) for p in body.findall('w:p', NS) if text_of(p).strip()]


def areas_from(table, item_prefix):
    areas = []
    for tr in table.findall('w:tr', NS):
        cells = tr.findall('w:tc', NS)
        if not cells:
            continue
        first = cell_text(cells[0])
        if not first or first.upper().startswith(('REVIEW AREA', 'PERFORMANCE FACTORS', 'OVERALL RATING')):
            continue
        m = re.match(r'^(\d+)\.\s*(.+)$', first)
        if m:
            areas.append({'name': clean(m.group(2)), 'items': []})
            continue
        if not areas:
            raise SystemExit(f'Item before any area: {first!r}')
        areas[-1]['items'].append(clean(re.sub(item_prefix, '', first)))
    return areas


def extract(path, code):
    root = ET.fromstring(zipfile.ZipFile(path).read('word/document.xml'))
    body = root.find('w:body', NS)
    tables = body.findall('w:tbl', NS)
    paras = body_paragraphs(body)

    if code.startswith('HSJ_EPR_FORM_'):
        header = tables[0].findall('w:tr', NS)
        instr = cell_paragraphs(header[2].findall('w:tc', NS)[0])
        appraisal_cell = cell_text(header[1].findall('w:tc', NS)[1])
        areas = areas_from(tables[1], r'^[a-z]\)\s*')
        tail = [cell_text(tr.findall('w:tc', NS)[0]) for tr in tables[2].findall('w:tr', NS)]
        goals = next(t for t in tail if t.upper().startswith('GOALS AND OBJECTIVES'))
        goals_prompt = re.search(r'\((.*)\)', goals).group(1).strip()
        additional = next(t for t in tail if t.lower().startswith('additional comments'))
        ack = next(p for p in paras if 'discussed this review' in p)
        form_code = next(re.search(r'(EPRForm\d)', p).group(1) for p in paras if 'EPRForm' in p)
        return {
            'formCode': form_code,
            'areas': areas,
            'layout': {
                'instructions': [p for p in instr],
                'appraisalLabel': 'Nature of Appraisal',
                'appraisalSource': appraisal_cell,
                'overallLabel': tail[0].title(),
                'generalCommentsLabel': additional.rstrip(':').strip(),
                'goalsLabel': 'Goals and Objectives',
                'goalsPrompt': goals_prompt.rstrip('.').strip() + '.',
                'acknowledgment': ack,
                'itemComments': True,
            },
        }

    # Simplified evaluation for coordinators, supervisors and heads
    instr = cell_paragraphs(tables[0].findall('w:tr', NS)[0].findall('w:tc', NS)[1])
    areas = areas_from(tables[1], r'^[a-z]\.\s*')
    type_line = next(p for p in paras if p.upper().startswith('TYPE OF EVALUATION'))
    return {
        'formCode': 'Simplified',
        'areas': areas,
        'layout': {
            'instructions': instr,
            'appraisalLabel': 'Type of Evaluation',
            'appraisalSource': type_line,
            'overallLabel': 'Overall Rating',
            'generalCommentsLabel': 'Comments',
            'goalsLabel': None,
            'goalsPrompt': None,
            'acknowledgment': None,
            'itemComments': False,
        },
    }


def raw_text(path):
    """Every character of the document body, in order — for an independent check."""
    root = ET.fromstring(zipfile.ZipFile(path).read('word/document.xml'))
    return text_of(root.find('w:body', NS))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    folder = Path(args[0] if args else '.')
    out = {}
    for code, name in FILES.items():
        if '--raw' in sys.argv:
            out[code] = raw_text(folder / name)
            continue
        data = extract(folder / name, code)
        data['sourceDocument'] = name
        out[code] = data
    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
