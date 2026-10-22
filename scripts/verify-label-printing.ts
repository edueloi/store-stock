import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LABEL_PRINT, LABEL_PRINT_PRESETS, calibrationContents, labelEscape, labelGeometry, labelPositions, labelPrintDocument, labelSettingsStorageKey, storedLabelSettings, validateLabelPrint } from "../src/lib/labelPrinting";

test("exemplos de 1, 2 e 3 colunas usam dimensões reais e uma fileira por página na bobina", () => {
  for (const preset of LABEL_PRINT_PRESETS) {
    assert.deepEqual(validateLabelPrint(preset.settings), [], preset.id);
    const s = preset.settings, g = labelGeometry(s);
    const cells = labelPositions(s, s.columns + 1);
    assert.equal(cells[1].x, s.columns > 1 ? s.marginLeft + s.width + s.gapX : s.marginLeft);
    if (s.mode === "thermal") {
      assert.equal(g.pageHeight, s.height); // GAP é avanço do driver, não espaço duplicado no documento.
      assert.equal(cells.at(-1)!.page, 1); assert.equal(cells.at(-1)!.column, 0); assert.equal(cells.at(-1)!.y, 0);
    }
  }
});

test("folhas e bobinas contínuas têm passos distintos; posições usadas só afetam o início", () => {
  const s = DEFAULT_LABEL_PRINT, g = labelGeometry(s), cells = labelPositions({ ...s, skip: 2 }, g.capacity + 1);
  assert.equal(cells[0].column, 2); assert.equal(cells[1].row, 1);
  assert.equal(cells[g.capacity - 2].page, 1); assert.equal(cells[g.capacity - 2].column, 0);
  const roll = { ...LABEL_PRINT_PRESETS[3].settings, media: "continuous" as const };
  assert.equal(labelGeometry(roll).pageHeight, roll.height + roll.gapY);
});

test("bloqueia etiquetas que não cabem e respeita os limites da Elgin BTP-L42(U)", () => {
  const s = { ...LABEL_PRINT_PRESETS[3].settings, printer: "elgin-btp-l42" as const };
  assert.deepEqual(validateLabelPrint(s), []);
  assert.ok(validateLabelPrint({ ...s, width: 50 }).some(e => /precisam/.test(e)));
  assert.ok(validateLabelPrint({ ...s, paperWidth: 120 }).some(e => /25 e 110/.test(e)));
  assert.ok(validateLabelPrint({ ...s, paperWidth: 110, width: 35, gapX: 1, marginLeft: 1, marginRight: 1, safety: 0 }).some(e => /104 mm/.test(e)));
  assert.ok(validateLabelPrint({ ...s, height: 8, safety: 4 }).some(e => /pouco espaço/.test(e)));
  assert.ok(validateLabelPrint({ ...s, width: NaN }).some(e => /números válidos/.test(e)));
  assert.ok(validateLabelPrint({ ...s, scale: 130 }).some(e => /50% e 100%/.test(e)));
  assert.throws(() => labelPositions(s, 2001), /2.000/);
});

test("deslocamento preserva a segurança mínima e o conteúdo tem escala uniforme", () => {
  const s = { ...DEFAULT_LABEL_PRINT, offsetX: -1.5, offsetY: 1, scale: 80 };
  const g = labelGeometry(s);
  assert.ok(g.contentLeft >= s.safety); assert.ok(g.contentLeft + g.contentWidth <= s.width - s.safety);
  assert.ok(g.contentTop >= s.safety); assert.ok(g.contentTop + g.contentHeight <= s.height - s.safety);
  const html = labelPrintDocument(s, ["<div>Ação e conexão</div>"]);
  assert.match(html, /@page\{size:210mm 297mm;margin:0\}/);
  assert.match(html, /scale\('\+scale/); assert.doesNotMatch(html, /scaleX|scaleY/);
  assert.match(html, /Ação e conexão/);
});

test("teste mede uma régua física sem aplicar a redução do conteúdo; strings são escapadas", () => {
  const s = { ...LABEL_PRINT_PRESETS[3].settings, scale: 50 };
  const html = labelPrintDocument(s, calibrationContents(s), "Teste Ação", true);
  assert.match(html, /const scale=1;/);
  assert.match(html, /linha 10 mm/); assert.match(html, /H10 V/);
  assert.match(html, /data-page="2"/); assert.doesNotMatch(html, /data-page="3"/);
  assert.equal(labelEscape('Ação <script>"x"</script>'), 'Ação &lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});

test("preferências de papel ficam separadas por usuário e loja e dados inválidos não são restaurados", () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null } });
  try {
    values.set("user", JSON.stringify({ id: 1, tenant_id: 11 })); const first = labelSettingsStorageKey();
    values.set(first, JSON.stringify(LABEL_PRINT_PRESETS[2].settings)); assert.equal(storedLabelSettings().columns, 2);
    values.set("user", JSON.stringify({ id: 2, tenant_id: 11 })); assert.notEqual(labelSettingsStorageKey(), first); assert.equal(storedLabelSettings().mode, "sheet");
    values.set(labelSettingsStorageKey(), '{"width":-10}'); assert.equal(storedLabelSettings().width, DEFAULT_LABEL_PRINT.width);
    values.set("user", JSON.stringify({ id: 1, tenant_id: 6 })); assert.notEqual(labelSettingsStorageKey(), first);
  } finally { delete (globalThis as any).localStorage; }
});

test("três colunas mostram posições vazias sem criar cópias extras na impressão", () => {
  const s = LABEL_PRINT_PRESETS[3].settings;
  const preview = labelPrintDocument(s, ["Produto Ação"], "Prévia", false, 280);
  assert.equal((preview.match(/class="label empty-slot"/g) || []).length, 2);
  assert.equal((preview.match(/class="label" data-index/g) || []).length, 1);
  const printed = labelPrintDocument(s, ["Produto Ação"]);
  assert.equal((printed.match(/class="label" data-index/g) || []).length, 1);
  assert.doesNotMatch(printed, /class="label empty-slot"/);
  assert.match(printed, /width:32mm;height:25mm/);
});
