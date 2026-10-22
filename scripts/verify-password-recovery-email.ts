import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { passwordResetEmail } from "../backend/services/password-reset-email";

test("e-mail identifica a redefinição, usa logo novo e oferece HTML e texto legível", () => {
  const url = `https://store.boxsys.com.br/reset-password/${"a".repeat(64)}`;
  const message = passwordResetEmail("Karen Ação", url);
  assert.equal(message.subject, "Redefinição de senha - Store BoxSys");
  for (const body of [message.text, message.html]) {
    assert.match(body, /Karen Ação/);
    assert.match(body, /1 hora/);
    assert.match(body, /uma única vez/);
    assert.match(body, /Sua senha continua a mesma/);
    assert.ok(body.includes(url));
  }
  assert.match(message.html, /cid:store-boxsys-logo/);
  assert.doesNotMatch(message.html, /logo-boxsys-vazado|logo-boxsys\.jpg|<script/);
  assert.doesNotMatch(message.text, /<[^>]+>/);
});

test("nome e endereço não podem injetar HTML no corpo do e-mail", () => {
  const message = passwordResetEmail('<img src=x onerror="alert(1)">', 'https://store.boxsys.com.br/reset-password/test?x=1&y="teste"');
  assert.doesNotMatch(message.html, /<img src=x/);
  assert.match(message.html, /&lt;img/);
  assert.match(message.html, /x=1&amp;y=&quot;teste&quot;/);
});

const preview = passwordResetEmail("Karen", `https://store.boxsys.com.br/reset-password/${"exemplo".repeat(10)}`);
await writeFile(path.join(os.tmpdir(), "boxsys-password-reset-preview.html"), preview.html.replace("cid:store-boxsys-logo", "http://127.0.0.1:4189/system/favicon.png"), "utf8");
