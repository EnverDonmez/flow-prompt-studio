const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { ProjectManager } = require("../src/project");

describe("ProjectManager", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fps-pm-"));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("init creates .fps/project.json", () => {
    const pm = new ProjectManager(tmpDir);
    const project = pm.init("Test Film");
    assert.equal(project.title, "Test Film");
    assert.ok(fs.existsSync(path.join(tmpDir, ".fps", "project.json")));
  });

  it("refuses to overwrite without force", () => {
    const pm = new ProjectManager(tmpDir);
    pm.init("Test Film");
    assert.throws(() => pm.init("Other"), /already exists/);
  });

  it("force overwrites", () => {
    const pm = new ProjectManager(tmpDir);
    pm.init("First");
    const project = pm.init("Second", { force: true });
    assert.equal(project.title, "Second");
  });

  it("load returns project data", () => {
    const pm = new ProjectManager(tmpDir);
    pm.init("My Film");
    const loaded = pm.load();
    assert.equal(loaded.title, "My Film");
  });

  it("throws when loading nonexistent project", () => {
    const pm = new ProjectManager(tmpDir);
    assert.throws(() => pm.load(), /No project found/);
  });

  it("addScreenplay parses and records", () => {
    const sp = path.join(tmpDir, "script.txt");
    fs.writeFileSync(sp, "SCENE 1\nJOHN\nHello.\nSCENE 2\nMARY\nHi.", "utf-8");

    const pm = new ProjectManager(tmpDir);
    pm.init("Film");
    const entry = pm.addScreenplay(sp);
    assert.ok(entry.id);
    assert.equal(entry.filename, "script.txt");
    assert.ok(entry.analysis.scenes >= 2);
  });

  it("status summarizes project", () => {
    const sp = path.join(tmpDir, "script.txt");
    fs.writeFileSync(sp, "SCENE 1\nJOHN\nHello.", "utf-8");

    const pm = new ProjectManager(tmpDir);
    pm.init("Film");
    pm.addScreenplay(sp);
    const s = pm.status();
    assert.equal(s.title, "Film");
    assert.equal(s.screenplays, 1);
  });

  it("export returns full project data", () => {
    const pm = new ProjectManager(tmpDir);
    pm.init("Export Test");
    const data = pm.export();
    assert.equal(data.title, "Export Test");
    assert.ok(data.created);
  });

  it("handles metadata options", () => {
    const pm = new ProjectManager(tmpDir);
    pm.init("Meta Film", { director: "Jane", dp: "John", genre: "drama" });
    const s = pm.status();
    assert.equal(s.metadata.director, "Jane");
    assert.equal(s.metadata.dp, "John");
    assert.equal(s.metadata.genre, "drama");
  });
});
