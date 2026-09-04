/* ====================================================================
 * РЕКОНСТРУКЦИЯ по поиску в прошлом чате "Оптовые поставки хлеба из
 * Кропоткина" (conversation_search), НЕ чтение актуального файла —
 * в этой сессии /mnt/skills/plugins/lp-page-assembly/ содержит только
 * SKILL.md, самого cms-block-automation.js здесь нет.
 * Возможны более поздние правки, которые не попали в найденные фрагменты.
 * Сверь с своей рабочей копией перед использованием.
 * ====================================================================
 *
 * Грабли, на которые уже наступали (из комментариев в файле):
 * — DATA хранить как МАССИВ пар [layoutId, fields], а не как объект —
 *   объект с числовыми строковыми ключами JS сам пересортирует по
 *   возрастанию при переборе, что один раз реально сломало порядок блоков.
 * — Блоки #486707 (Маркированный список оформленный) и #251118
 *   (Вопрос-ответ в колонках) по умолчанию создаются с МЕНЬШИМ числом
 *   пунктов списка (3), чем обычно нужно. Прямая запись по пути
 *   "list.3.text" в такой ситуации падает молча (undefined) —
 *   поэтому lpEnsureListLength дотягивает массив, клонируя последний
 *   элемент как шаблон структуры, перед применением правок.
 * — Кнопки (buttons — meta-список) этим скриптом не создаются:
 *   у блока при создании уже есть дефолтный buttons[0].
 * — Если страница уже заполнена (продублирована) — блоки создавать
 *   не нужно, использовать только lpFillExistingPage.
 * ====================================================================
 */

// ---------- Общие утилиты ----------

function lpFindVariantId() {
  // 1) Ищем в самом HTML страницы
  const htmlMatch = document.documentElement.innerHTML.match(/variant_id=(\d+)/);
  if (htmlMatch) return htmlMatch[1];

  // 2) Ищем среди уже случившихся сетевых запросов через Performance API —
  // редактор ВСЕГДА делает хотя бы один запрос с variant_id при загрузке
  // (folder/list, block/list и т.п.), даже на пустой странице без блоков.
  // Буфер Performance API хранит записи только с момента открытия вкладки —
  // если скрипт не находит variant_id, попробуй F5 и запусти сразу после.
  try {
    const entries = performance.getEntriesByType('resource');
    for (const entry of entries) {
      const m = entry.name.match(/variant_id=(\d+)/);
      if (m) return m[1];
    }
  } catch (e) {
    // Performance API недоступен — идём дальше без него
  }
  return null;
}

function lpWrapHtml(text) {
  return `<p>${text}</p>`;
}

function lpSetPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur[parts[i]];
    if (cur === undefined) {
      console.warn(`Путь "${path}" не найден (сломалось на "${parts[i]}")`);
      return false;
    }
  }
  cur[parts[parts.length - 1]] = value;
  return true;
}

// Дотягивает массивы (list, questions_list и т.п.) до нужной длины,
// клонируя последний существующий элемент как шаблон структуры
function lpEnsureListLength(payload, fields) {
  const maxIndexByArray = {};
  Object.keys(fields).forEach(path => {
    const parts = path.split('.');
    if (parts.length >= 3 && !isNaN(parts[1])) {
      const arrayKey = parts[0];
      const idx = parseInt(parts[1], 10);
      if (maxIndexByArray[arrayKey] === undefined || idx > maxIndexByArray[arrayKey]) {
        maxIndexByArray[arrayKey] = idx;
      }
    }
  });
  Object.entries(maxIndexByArray).forEach(([arrayKey, maxIdx]) => {
    if (!Array.isArray(payload[arrayKey]) || payload[arrayKey].length === 0) return;
    while (payload[arrayKey].length <= maxIdx) {
      const template = payload[arrayKey][payload[arrayKey].length - 1];
      payload[arrayKey].push(JSON.parse(JSON.stringify(template)));
    }
  });
}

function lpGetSessionParams(fallbackVariantId) {
  const urlParams = new URLSearchParams(window.location.search);
  const verId = urlParams.get('ver_id');
  const access = urlParams.get('access');
  const variantId = lpFindVariantId() || fallbackVariantId || null;
  if (!verId || !access || !variantId) {
    throw new Error(`Не хватает параметров сессии. ver_id=${verId} access=${access} variant_id=${variantId}`);
  }
  return { verId, access, variantId };
}

// ---------- Create / Read / Write ----------

async function lpCreateBlock({ verId, access, variantId }, layoutId) {
  const url = `/-/cms/v2/lp/block/?ver_id=${verId}&access=${encodeURIComponent(access)}&block_id=0&layout_id=${layoutId}&variant_id=${variantId}&xhr=1&rnd=${Date.now()}`;
  const body = new URLSearchParams();
  body.set('position', '0');
  body.set('type', 'before');
  const res = await fetch(url, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Ошибка создания блока layout_id=${layoutId}: ${res.status}`);
  const json = await res.json();
  return json.result.id;
}

async function lpFetchBlockList({ verId, access, variantId }) {
  const url = `/-/cms/v2/lp/block/list?ver_id=${verId}&access=${encodeURIComponent(access)}&variant_id=${variantId}&xhr=1&rnd=${Date.now()}`;
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Ошибка чтения списка блоков: ${res.status}`);
  const json = await res.json();
  return json.result.blocks;
}

async function lpSaveBlockContent({ verId, access, variantId }, blockId, payload) {
  const url = `/-/cms/v2/lp/block/content?ver_id=${verId}&access=${encodeURIComponent(access)}&block_id=${blockId}&variant_id=${variantId}&xhr=1&rnd=${Date.now()}`;
  const body = new URLSearchParams();
  body.set('content', JSON.stringify(payload));
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Ошибка сохранения блока ${blockId}: ${res.status}`);
  return res.json();
}

function lpBuildPayloadFromBlockData(block, fields) {
  const payload = { ...block.data };
  delete payload.json;
  delete payload.json_large;
  delete payload.meta_id;
  delete payload.parent;
  lpEnsureListLength(payload, fields);
  let allOk = true;
  Object.entries(fields).forEach(([path, text]) => {
    const ok = lpSetPath(payload, path, lpWrapHtml(text));
    if (!ok) allOk = false;
  });
  return { payload, allOk };
}

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

// ---------- Сценарий 2: страница УЖЕ содержит блоки (продублирована) — только переписать текст ----------
async function lpFillExistingPage(DATA, fallbackVariantId) {
  const session = lpGetSessionParams(fallbackVariantId);
  console.log('Параметры сессии:', session);
  const blocks = await lpFetchBlockList(session);
  console.log(`Найдено блоков на странице: ${blocks.length}`);
  const report = { ok: 0, errors: 0, blocks_missing: [] };
  for (const [layoutId, fields] of DATA) {
    const block = blocks.find(b => b.layout_id === layoutId);
    if (!block) {
      console.warn(`❌ Блок с layout_id ${layoutId} не найден на странице`);
      report.blocks_missing.push(layoutId);
      continue;
    }
    const { payload, allOk } = lpBuildPayloadFromBlockData(block, fields);
    if (!allOk) {
      console.error(`❌ layout #${layoutId} (block_id ${block.block_id}) — не сохранено из-за ошибок пути`);
      report.errors++;
      continue;
    }
    await lpSaveBlockContent(session, block.block_id, payload);
    console.log(`✅ layout #${layoutId} (block_id ${block.block_id}) сохранен`);
    report.ok++;
  }
  console.log('=== ИТОГ ===', report);
  return report;
}

// ---------- Перехватчик fetch/XHR — включать вручную только для отладки новых endpoint'ов ----------
// (не часть основного пути, нужен только если CMS сменит API и придётся искать заново)
function lpEnableNetworkLogger() {
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const [resource, options = {}] = args;
    console.log('%c[fetch]', 'color: orange; font-weight: bold', options.method || 'GET', resource);
    if (options.body) console.log('  body:', options.body);
    if (options.headers) console.log('  headers:', options.headers);
    const res = await origFetch.apply(this, args);
    console.log('%c[fetch] ←', 'color: orange', res.status, resource);
    return res;
  };
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__logInfo = { method, url };
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (this.__logInfo) {
      console.log('%c[xhr]', 'color: dodgerblue; font-weight: bold', this.__logInfo.method, this.__logInfo.url);
      if (body) console.log('  body:', body);
      this.addEventListener('load', () => {
        console.log('%c[xhr] ←', 'color: dodgerblue', this.status, this.__logInfo.url);
        console.log('  response:', this.responseText?.slice(0, 2000));
      });
    }
    return origSend.call(this, body);
  };
  console.log('✅ Перехват fetch/XHR включён.');
}
