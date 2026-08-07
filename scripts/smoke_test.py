"""Minimal headless smoke test for app.js using quickjs + a tiny DOM/localStorage shim.
Not a full browser, but catches JS syntax errors, undefined refs, and basic logic bugs
in the render functions and action handlers. Run: python scripts/smoke_test.py
"""
import quickjs
import os

BASE = os.path.join(os.path.dirname(__file__), "..")


def read(path):
    with open(os.path.join(BASE, path), encoding="utf-8") as f:
        return f.read()


SHIM = r"""
var __html = "home";
var __store = {};
var localStorage = {
  getItem: function(k) { return __store.hasOwnProperty(k) ? __store[k] : null; },
  setItem: function(k, v) { __store[k] = String(v); },
  removeItem: function(k) { delete __store[k]; },
};

function FakeClassList(el) {
  this.el = el;
}
FakeClassList.prototype.add = function() {};
FakeClassList.prototype.remove = function() {};

function FakeElement(tag) {
  this.tag = tag;
  this._innerHTML = "";
  this.children = {};
  this.dataset = {};
  this.style = {};
  this.classList = new FakeClassList(this);
}
Object.defineProperty(FakeElement.prototype, "innerHTML", {
  get: function() { return this._innerHTML; },
  set: function(v) { this._innerHTML = v; },
});
FakeElement.prototype.addEventListener = function(type, fn) {
  this._listeners = this._listeners || {};
  this._listeners[type] = fn;
};
FakeElement.prototype.querySelector = function() { return new FakeElement("span"); };
FakeElement.prototype.closest = function() { return null; };

function fakeClick(root, dataset) {
  var target = new FakeElement("button");
  target.dataset = dataset || {};
  target.closest = function() { return target; };
  root._listeners["click"]({ target: target });
}

var __elements = {};
var document = {
  getElementById: function(id) {
    if (!__elements[id]) __elements[id] = new FakeElement("div");
    return __elements[id];
  },
};

var window = {
  scrollTo: function() {},
  addEventListener: function() {},
  matchMedia: function() { return { matches: false }; },
  navigator: { userAgent: "test", standalone: false },
};
var navigator = window.navigator;

function confirm(msg) { return true; }
function setInterval() { return 1; }
function clearInterval() {}
"""

DRIVER = r"""
(function() {
  var root = __elements["app"];
  var log = [];
  function html() { return root.innerHTML; }
  function bad(label) {
    for (var i = 0; i < arguments.length - 1; i++) {}
    ["undefined", "NaN", "[object Object]"].forEach(function(s) {
      if (html().indexOf(s) !== -1) log.push("BAD(" + label + "): contains " + s);
    });
  }

  // ---- Practice flow: go through 5 questions in domain 2 ----
  fakeClick(root, { action: "go", screen: "practiceSetup" });
  bad("practiceSetup");
  fakeClick(root, { action: "setPendingDomain", domain: "2" });
  fakeClick(root, { action: "startPractice" });
  bad("practice-q1");
  for (var i = 0; i < 5; i++) {
    fakeClick(root, { action: "answer", index: "0" });
    bad("practice-answered-" + i);
    fakeClick(root, { action: "nextPractice" });
    bad("practice-next-" + i);
  }
  fakeClick(root, { action: "confirmExitPractice" });
  bad("home-after-practice");

  // ---- Exam flow: 20-question mock exam, answer all, finish ----
  fakeClick(root, { action: "go", screen: "examSetup" });
  fakeClick(root, { action: "setPendingLen", len: "20" });
  fakeClick(root, { action: "startExam" });
  bad("exam-q1");
  for (var j = 0; j < 20; j++) {
    fakeClick(root, { action: "examAnswer", index: String(j % 4) });
    if (j % 3 === 0) fakeClick(root, { action: "flagQuestion" });
    if (j < 19) fakeClick(root, { action: "examNext" });
  }
  bad("exam-last-question");
  fakeClick(root, { action: "openPalette" });
  bad("examPalette");
  fakeClick(root, { action: "jumpTo", index: "0" });
  bad("exam-jumped");
  fakeClick(root, { action: "openPalette" });
  fakeClick(root, { action: "closePalette" });
  bad("exam-closePalette");
  fakeClick(root, { action: "confirmFinishExam" });
  bad("examResults");

  var resultsHtml = html();
  var pctMatch = resultsHtml.match(/font-size:44px[^>]*>([0-9]+)%/);
  log.push("exam result pct found: " + (pctMatch ? pctMatch[1] : "NOT FOUND"));

  // ---- Full-length 150-question mock exam ----
  fakeClick(root, { action: "go", screen: "examSetup" });
  fakeClick(root, { action: "setPendingLen", len: "150" });
  bad("examSetup-150");
  fakeClick(root, { action: "startExam" });
  bad("exam150-q1");
  for (var k = 0; k < 149; k++) {
    fakeClick(root, { action: "examAnswer", index: String(k % 4) });
    fakeClick(root, { action: "examNext" });
  }
  fakeClick(root, { action: "examAnswer", index: "0" });
  fakeClick(root, { action: "confirmFinishExam" });
  bad("exam150-results");
  var results150 = html();
  var pctMatch150 = results150.match(/font-size:44px[^>]*>([0-9]+)%/);
  log.push("150-question exam result pct: " + (pctMatch150 ? pctMatch150[1] : "NOT FOUND"));
  var domainRowCount = (results150.match(/domain-row/g) || []).length;
  log.push("150-question results domain rows found: " + domainRowCount);

  // ---- Reset ----
  fakeClick(root, { action: "go", screen: "home" });
  fakeClick(root, { action: "confirmReset" });
  bad("home-after-reset");

  return JSON.stringify(log);
})();
"""

ctx = quickjs.Context()
ctx.eval(SHIM)
ctx.eval(read("js/questions.js"))
try:
    ctx.eval(read("js/app.js"))
    print("app.js: loaded and initial render() executed without throwing")
    home_html = ctx.eval('__elements["app"] ? __elements["app"].innerHTML : ""')
    print("home render length:", len(home_html))
    for bad in ("undefined", "NaN", "[object Object]"):
        if bad in home_html:
            print("  WARNING: contains", repr(bad))
    if not home_html.strip():
        print("  WARNING: home render is empty")

    result = ctx.eval(DRIVER)
    import json as _json
    for line in _json.loads(result):
        print(" ", line)
except Exception as e:
    print("app.js ERROR:", e)
    raise
