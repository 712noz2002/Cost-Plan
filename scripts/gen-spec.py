"""엑셀 명세(v7) → src/spec/spec.generated.ts 자동 변환.

질문/선택지/비교 문장을 손으로 옮기지 않도록 엑셀 원고를 그대로 읽는다.
'01_질문_25종'의 '선택 → 코드'와 '02_선택지_코드'가 다르면 즉시 실패한다.

사용: python3 -I scripts/gen-spec.py [xlsx 경로]
"""
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
XLSX = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "spec" / "branch-spec-v7.xlsx"
OUT = ROOT / "src" / "spec" / "spec.generated.ts"

wb = openpyxl.load_workbook(XLSX, data_only=True)


def rows(sheet):
    return [r for r in wb[sheet].iter_rows(values_only=True)]


def s(v):
    return "" if v is None else str(v).strip()


# ---- 01_질문_25종 ----------------------------------------------------------
questions = []
header_seen = False
for r in rows("01_질문_25종"):
    if s(r[0]) == "ID":
        header_seen = True
        continue
    if not header_seen or not s(r[0]):
        continue
    qid = s(r[0])
    texts = [s(c) for c in r[5:9] if s(c)]
    mapping = {}
    for m in re.finditer(r"(\d)\s*→\s*([ABCD])", s(r[9])):
        mapping[int(m.group(1))] = m.group(2)
    if sorted(mapping) != list(range(1, len(texts) + 1)):
        raise SystemExit(f"{qid}: 선택지 {len(texts)}개와 코드 매핑 {mapping} 불일치")
    questions.append(
        {
            "id": qid,
            "step": int(r[1]),
            "condition": s(r[2]),
            "situation": s(r[3]),
            "prompt": s(r[4]),
            "options": [
                {"id": f"{qid}#{i}", "index": i, "text": t, "code": mapping[i]}
                for i, t in enumerate(texts, start=1)
            ],
            "intent": s(r[10]),
        }
    )

if len(questions) != 25:
    raise SystemExit(f"질문 수가 25가 아님: {len(questions)}")
n_options = sum(len(q["options"]) for q in questions)
if n_options != 76:
    raise SystemExit(f"선택지 수가 76이 아님: {n_options}")

# ---- 02_선택지_코드 교차 검증 -----------------------------------------------
codebook = {}
for r in rows("02_선택지_코드"):
    if s(r[0]) and s(r[1]).isdigit() and s(r[2]).isdigit():
        codebook[(s(r[0]), int(r[2]))] = (s(r[3]), s(r[4]))
for q in questions:
    for o in q["options"]:
        got = codebook.get((q["id"], o["index"]))
        if got is None:
            raise SystemExit(f"코드북에 없음: {q['id']} #{o['index']}")
        if got != (o["text"], o["code"]):
            raise SystemExit(f"코드북 불일치: {q['id']} #{o['index']} {got} != {(o['text'], o['code'])}")
if len(codebook) != n_options:
    raise SystemExit("코드북 행 수와 선택지 수가 다름")

# ---- Q6 14종 ---------------------------------------------------------------
q6 = [q["id"] for q in questions if q["id"].startswith("Q6_")]
if len(q6) != 14:
    raise SystemExit(f"Q6 변형이 14종이 아님: {q6}")

# ---- 04_유형·캐릭터 ---------------------------------------------------------
types = {}
for r in rows("04_유형·캐릭터"):
    if s(r[0]) in list("ABCD") and s(r[1]):
        asset = s(r[6])
        m = re.search(r"(character_[A-Za-z0-9_]+\.png)", asset)
        if not m:
            raise SystemExit(f"캐릭터 파일명을 찾을 수 없음: {asset}")
        types[s(r[0])] = {
            "persona": s(r[1]),
            "name": s(r[2]),
            "question": s(r[3]),
            "basis": s(r[4]),
            "sentence": s(r[5]),
            "characterDesc": asset.split("/")[0].strip(),
            "characterFile": m.group(1),
            "locker": s(r[7]),
        }
if sorted(types) != list("ABCD"):
    raise SystemExit(f"유형 표 읽기 실패: {list(types)}")
for k, want in zip("ABCD", ["01", "02", "03", "04"]):
    if types[k]["locker"] != want:
        raise SystemExit(f"보관함 번호 불일치 {k}: {types[k]['locker']}")

# ---- 05_비교해석_12쌍 -------------------------------------------------------
pairs = {}
for r in rows("05_비교해석_12쌍"):
    if s(r[0]) in list("ABCD") and s(r[1]) in list("ABCD"):
        pairs[s(r[0]) + s(r[1])] = {"observed": s(r[2]), "diff": s(r[3]), "sentence": s(r[4])}
if len(pairs) != 12:
    raise SystemExit(f"비교 12쌍이 아님: {len(pairs)}")

out = (
    "// 이 파일은 scripts/gen-spec.py가 엑셀 명세(v7)에서 자동 생성합니다. 직접 수정하지 마세요.\n"
    "import type { Spec } from './types';\n\n"
    "export const SPEC: Spec = "
    + json.dumps({"questions": questions, "types": types, "pairs": pairs}, ensure_ascii=False, indent=2)
    + ";\n"
)
OUT.write_text(out, encoding="utf-8")
print(f"OK: 질문 {len(questions)}개, 선택지 {n_options}개, Q6 {len(q6)}종, 비교 {len(pairs)}쌍 → {OUT}")
