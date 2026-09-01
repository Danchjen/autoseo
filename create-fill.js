// ---------- Сценарий 1: страница ПУСТАЯ — создать блоки и сразу заполнить ----------
// DATA — МАССИВ пар [layoutId, fields], порядок = порядок сверху вниз на странице
async function lpCreateAndFillPage(DATA, fallbackVariantId) {
  const session = lpGetSessionParams(fallbackVariantId);
  console.log('Параметры сессии:', session);

  const entries = [...DATA].reverse(); // т.к. новый блок всегда встаёт в начало
  const report = { ok: 0, errors: 0 };

  for (const [layoutId, fields] of entries) {
    console.log(`Создаю и заполняю layout #${layoutId}...`);
    try {
      const newId = await lpCreateBlock(session, layoutId);
      console.log(`  Блок создан: layout #${layoutId} → block_id ${newId}`);

      const blocks = await lpFetchBlockList(session);
      const block = blocks.find(b => String(b.block_id) === String(newId));
      if (!block) {
        console.error(`  ❌ Не нашли только что созданный блок ${newId} в списке`);
        report.errors++;
        continue;
      }

      const { payload, allOk } = lpBuildPayloadFromBlockData(block, fields);
      if (!allOk) {
        console.error(`  ❌ Блок ${newId} — не все пути применились, содержимое НЕ сохранено`);
        report.errors++;
        continue;
      }

      await lpSaveBlockContent(session, newId, payload);
      console.log(`  ✅ Блок ${newId} (layout #${layoutId}) заполнен`);
      report.ok++;
    } catch (err) {
      console.error(`❌ layout #${layoutId} — ошибка:`, err);
      report.errors++;
    }
  }

  console.log('=== ИТОГ ===', report);
  return report;
}