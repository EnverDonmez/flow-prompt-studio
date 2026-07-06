/**
 * Flow Prompt Studio — Utils birim testleri
 *
 * Çalıştırma: node --test tests/utils.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("utils (chalk)", () => {
  const { chalk } = require("../src/utils");

  it("tüm renk fonksiyonları export edilir", () => {
    const methods = ["red", "green", "yellow", "blue", "cyan", "gray", "bold"];
    methods.forEach((m) => {
      assert.equal(typeof chalk[m], "function", `${m} bir fonksiyon olmalı`);
    });
  });

  it("renk kodları ANSI escape karakterleri içerir", () => {
    const result = chalk.red("hata");
    assert.ok(result.includes("\x1b[31m"), "kırmızı ANSI kodu içermeli");
    assert.ok(result.includes("hata"), "orijinal metin korunmalı");
    assert.ok(result.includes("\x1b[0m"), "reset kodu içermeli");
  });

  it("yeşil renk doğru ANSI kodu kullanır", () => {
    const result = chalk.green("başarılı");
    assert.ok(result.includes("\x1b[32m"));
    assert.ok(result.includes("başarılı"));
  });

  it("sarı renk doğru ANSI kodu kullanır", () => {
    const result = chalk.yellow("uyarı");
    assert.ok(result.includes("\x1b[33m"));
  });

  it("mavi renk doğru ANSI kodu kullanır", () => {
    const result = chalk.blue("bilgi");
    assert.ok(result.includes("\x1b[34m"));
  });

  it("cyan renk doğru ANSI kodu kullanır", () => {
    const result = chalk.cyan("adım");
    assert.ok(result.includes("\x1b[36m"));
  });

  it("gray renk doğru ANSI kodu kullanır", () => {
    const result = chalk.gray("detay");
    assert.ok(result.includes("\x1b[90m"));
  });

  it("bold doğru ANSI kodu kullanır", () => {
    const result = chalk.bold("vurgu");
    assert.ok(result.includes("\x1b[1m"));
  });

  it("boş metinle çalışır", () => {
    const result = chalk.red("");
    assert.equal(result, "\x1b[31m\x1b[0m");
  });

  it("iç içe renk zincirleme çalışır", () => {
    const result = chalk.red(chalk.bold("kritik"));
    // Sıfırlama kodlarıyla birlikte her iki ANSI kodunu içermeli
    assert.ok(result.includes("\x1b[1m"));
    assert.ok(result.includes("\x1b[31m"));
  });
});
