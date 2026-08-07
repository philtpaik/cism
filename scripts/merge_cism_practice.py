"""
One-time migration: pull the 200-question bank out of the sibling
`cism-practice` project (js/questions/domain1..4.js), convert it to this
app's schema, and emit a JS snippet to append to js/questions.js.

Source schema: { id, question, options: ["A. ...", "B. ...", ...], correct, explanation }
Target schema: { id, domain, question, options: [plain text, no letter prefix], answer, explanation }

Run: python scripts/merge_cism_practice.py > scratch_appended_questions.js
(then hand-reviewed and pasted into js/questions.js)
"""
import json
import re
import sys
import quickjs

SRC_DIR = r"C:\Users\Phil\Desktop\Git Projects\cism-practice\js\questions"
MY_QUESTIONS_PATH = r"C:\Users\Phil\Desktop\Git Projects\cism\js\questions.js"

PREFIX_RE = re.compile(r"^\s*[A-D]\.\s*")

domain_files = {
    1: "domain1.js",
    2: "domain2.js",
    3: "domain3.js",
    4: "domain4.js",
}

# Load existing question text from my bank to skip exact-text duplicates.
ctx = quickjs.Context()
with open(MY_QUESTIONS_PATH, encoding="utf-8") as f:
    ctx.eval(f.read())
existing_json = ctx.eval("JSON.stringify(CISM_QUESTIONS.map(q => q.question.trim().toLowerCase()))")
existing_texts = set(json.loads(existing_json))

all_converted = []
dupes_skipped = []
errors = []

for domain, fname in domain_files.items():
    path = f"{SRC_DIR}\\{fname}"
    ctx2 = quickjs.Context()
    with open(path, encoding="utf-8") as f:
        src = f.read()
    ctx2.eval(src)
    var_name = f"DOMAIN_{domain}_QUESTIONS"
    raw_json = ctx2.eval(f"JSON.stringify({var_name})")
    raw = json.loads(raw_json)

    for item in raw:
        q_text = item["question"].strip()
        key = q_text.lower()
        if key in existing_texts:
            dupes_skipped.append((domain, item["id"], q_text[:70]))
            continue
        existing_texts.add(key)

        options = [PREFIX_RE.sub("", o).strip() for o in item["options"]]
        if len(options) != 4:
            errors.append((domain, item["id"], "options != 4"))
            continue
        answer = item["correct"]
        if not isinstance(answer, int) or not (0 <= answer <= 3):
            errors.append((domain, item["id"], "bad correct index"))
            continue
        explanation = item["explanation"].strip()
        if not q_text or not explanation:
            errors.append((domain, item["id"], "missing text"))
            continue

        new_id = f"cp{domain}-{item['id']:03d}"
        all_converted.append({
            "id": new_id,
            "domain": domain,
            "question": q_text,
            "options": options,
            "answer": answer,
            "explanation": explanation,
        })

sys.stderr.write(f"Converted: {len(all_converted)}\n")
sys.stderr.write(f"Skipped exact-text duplicates: {len(dupes_skipped)}\n")
for d in dupes_skipped:
    sys.stderr.write(f"  dup D{d[0]} #{d[1]}: {d[2]}\n")
sys.stderr.write(f"Errors: {len(errors)}\n")
for e in errors:
    sys.stderr.write(f"  D{e[0]} #{e[1]}: {e[2]}\n")

def js_str(s):
    return json.dumps(s, ensure_ascii=False)

lines = []
for q in all_converted:
    lines.append("  {")
    lines.append(f"    id: {js_str(q['id'])}, domain: {q['domain']},")
    lines.append(f"    question: {js_str(q['question'])},")
    lines.append("    options: [")
    for o in q["options"]:
        lines.append(f"      {js_str(o)},")
    lines.append("    ],")
    lines.append(f"    answer: {q['answer']},")
    lines.append(f"    explanation: {js_str(q['explanation'])},")
    lines.append("  },")

print("\n".join(lines))
