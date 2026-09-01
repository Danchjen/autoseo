(async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const verId = urlParams.get('ver_id');
  const access = urlParams.get('access');

  function findVariantId() {
    const match = document.documentElement.innerHTML.match(/variant_id=(\d+)/);
    return match ? match[1] : null;
  }
  const variantId = findVariantId();

  if (!verId || !access || !variantId) {
    console.error('Не нашли ver_id/access/variant_id. ver_id:', verId, 'access:', access, 'variant_id:', variantId);
    return;
  }
  console.log('Параметры сессии:', { verId, access, variantId });

  function getCurrentText(el) {
    const ckRoot = el.classList?.contains('ck-editor__editable') ? el : el.querySelector?.('.ck-editor__editable');
    if (ckRoot) return ckRoot.textContent.trim();
    return typeof el === 'string' ? el : '';
  }

  function wrapHtml(text) {
    return `<p>${text}</p>`;
  }

  function setPath(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      cur = cur[parts[i]];
      if (cur === undefined) {
        console.warn(`Путь "${path}" не найден (сломалось на "${parts[i]}")`);
        return false;
      }
    }
    const before = cur[parts[parts.length - 1]];
    cur[parts[parts.length - 1]] = value;
    return { ok: true, before };
  }

  function ensureListLength(payload, fields) {
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

  async function fetchBlockList() {
    const url = `/-/cms/v2/lp/block/list?ver_id=${verId}&access=${encodeURIComponent(access)}&variant_id=${variantId}&xhr=1&rnd=${Date.now()}`;
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`Ошибка чтения списка блоков: ${res.status}`);
    const json = await res.json();
    return json.result.blocks;
  }

  async function saveBlockContent(blockId, payload) {
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

  // ---------- Данные страницы «Кондитерские изделия» ----------
  const DATA = [
    ["250518", {
      "subtitle_offer": "Кондитерские изделия",
      "title": "Сдобная и слоеная выпечка из своей муки",
      "text_offer": "Ромашки, плетенки, рожки и рулеты из сдобного теста, круассаны и слойки из слоеного — печем из муки собственного помола. Отгружаем напрямую с завода: без минимального объема заказа, с доставкой ежедневно по Краснодарскому краю в радиусе около 100 км от Кропоткина.",
      "note_offer": "Первую партию привозим на следующий день после согласования условий.",
    }],
    ["340906", {
      "title": "Свежая выпечка каждый день",
      "subtitle": "Сдоба и слойка партиями ежедневно",
      "text": "Ромашки, плетенки, рожки и рулеты из сдобного теста, круассаны и слойки из слоеного — выпекаем на той же муке собственного помола, что и хлеб. Ассортимент можно скомбинировать под конкретную точку: кафе, кофейню, столовую или магазин у дома, минимального объема заказа нет.",
    }],
    ["250918", {
      "title": "Из чего собрать ассортимент выпечки",
      "list.0.subtitle": "Сдобные изделия",
      "list.0.text": "Ромашки, плетенки, рожки и рулеты — классическая сдобная выпечка для розницы и кафе.",
      "list.1.subtitle": "Слоеные изделия",
      "list.1.text": "Круассаны и слойки из слоеного теста — для точек с утренним кофе и свежей выпечкой.",
      "list.2.subtitle": "Комбинация под точку",
      "list.2.text": "Можно взять один вид изделий или собрать смешанную партию из сдобы и слойки сразу.",
      "list.3.subtitle": "Периодичность",
      "list.3.text": "Подходит и разовая закупка, и постоянные ежедневные поставки — под оба варианта минимального объема нет.",
    }],
    ["486707", {
      "title": "Ассортимент выпечки",
      "subtitle": "Сдобные и слоеные изделия одной партией",
      "list.0.text": "Ромашки — сдобная выпечка классической формы",
      "list.1.text": "Плетенки — сдобные изделия витой формы",
      "list.2.text": "Рожки и рулеты — сдобная выпечка с начинкой и без",
      "list.3.text": "Круассаны и слойки — слоеное тесто",
    }],
    ["250718", {
      "title": "Почему берут именно у нас",
      "list.0.subtitle": "Своя мука",
      "list.0.text": "Печем сдобу и слойку на муке собственного помола — тот же принцип, что и в хлебе.",
      "list.1.subtitle": "Ежедневная выпечка",
      "list.1.text": "Изделия готовятся партиями каждый день, без залежавшихся остатков на складе.",
      "list.2.subtitle": "Гибкий ассортимент",
      "list.2.text": "Можно взять только сдобу, только слойку или собрать смешанную партию под точку.",
    }],
    ["520307", {
      "title": "Нужна сдоба или слойка под вашу точку?",
      "text": "Расскажите, что нужно — ромашки, плетенки, круассаны или слойки — и в каком объеме, подберем поставку и пришлем цены.",
    }],
    ["251118", {
      "title": "Частые вопросы о выпечке",
      "questions_list.0.question": "Из чего готовятся сдобные изделия?",
      "questions_list.0.answer": "Из сдобного теста на муке собственного помола — ромашки, плетенки, рожки, рулеты.",
      "questions_list.1.question": "Чем слоеные изделия отличаются от сдобных?",
      "questions_list.1.answer": "Слоеные — круассаны и слойки — готовятся из слоеного теста, сдобные (ромашки, плетенки, рожки, рулеты) — из сдобного.",
      "questions_list.2.question": "Можно ли заказать только один вид изделий?",
      "questions_list.2.answer": "Да, можно взять один вид или собрать смешанную партию из сдобы и слойки.",
      "questions_list.3.question": "Подходит ли поставка для небольшой кофейни?",
      "questions_list.3.answer": "Да, минимального объема заказа нет, поставки можно оформить и разово, и на постоянной основе.",
      "questions_list.4.question": "Как часто привозите выпечку?",
      "questions_list.4.answer": "Ежедневно, по Краснодарскому краю в радиусе около 100 км от Кропоткина.",
    }],
    ["345306", {
      "title": "Закажите прайс-лист на выпечку",
      "text": "Оставьте контакты — пришлем цены на сдобу и слойку и обсудим объем поставки.",
    }],
    ["349306", {
      "title": "Заказать выпечку",
      "text": "Оставьте телефон — обсудим ассортимент сдобы и слойки и условия доставки.",
    }],
  ];

  // ---------- Прогон: находим существующий блок по layout_id, меняем текст, сохраняем ----------
  async function run() {
    const blocks = await fetchBlockList();
    console.log(`Найдено блоков на странице: ${blocks.length}`);

    const report = { ok: 0, changed_but_wrong: 0, not_found: 0, blocks_missing: [] };

    for (const [layoutId, fields] of DATA) {
      const block = blocks.find(b => b.layout_id === layoutId);
      if (!block) {
        console.warn(`❌ Блок с layout_id ${layoutId} не найден на странице`);
        report.blocks_missing.push(layoutId);
        continue;
      }

      const payload = { ...block.data };
      delete payload.json;
      delete payload.json_large;
      delete payload.meta_id;
      delete payload.parent;

      ensureListLength(payload, fields);

      let allOk = true;
      Object.entries(fields).forEach(([path, text]) => {
        const result = setPath(payload, path, wrapHtml(text));
        if (result === false || !result.ok) {
          allOk = false;
          console.warn(`  ❌ "${path}" — не применилось`);
        }
      });

      if (!allOk) {
        console.error(`❌ layout #${layoutId} (block_id ${block.block_id}) — не сохранено из-за ошибок пути`);
        report.not_found++;
        continue;
      }

      await saveBlockContent(block.block_id, payload);
      console.log(`✅ layout #${layoutId} (block_id ${block.block_id}) сохранен`);
      report.ok++;
    }

    console.log('=== ИТОГ ===', report);
  }

  run();
})();