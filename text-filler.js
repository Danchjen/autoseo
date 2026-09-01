(async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const verId = urlParams.get('ver_id');
  const access = urlParams.get('access');

  function lpFindVariantId() {
    // 1) Ищем в самом HTML страницы (работает, если на странице уже есть
    // блок с микроразметкой schema.org — там встречается variant_id=...)
    const htmlMatch = document.documentElement.innerHTML.match(/variant_id=(\d+)/);
    if (htmlMatch) return htmlMatch[1];
  
    // 2) Ищем среди уже случившихся сетевых запросов через Performance API —
    // браузер сам логирует их (включая XHR/fetch), даже если наш перехватчик
    // не был включён с самого начала. Редактор ВСЕГДА делает хотя бы один
    // запрос с variant_id при загрузке (folder/list, block/list и т.п.),
    // даже на полностью пустой странице без единого блока.
    try {
      const entries = performance.getEntriesByType('resource');
      for (const entry of entries) {
        const m = entry.name.match(/variant_id=(\d+)/);
        if (m) return m[1];
      }
    } catch (e) {
      // Performance API недоступен — просто идём дальше без него
    }
  
    return null;
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
    "subtitle_offer": "Замороженное тесто и полуфабрикаты",
    "title": "Замороженное тесто и хлебобулочные полуфабрикаты от производителя",
    "text_offer": "Производим из муки собственного помола, отгружаем напрямую с завода без посредников: без минимального объема заказа, с доставкой ежедневно по Краснодарскому краю в радиусе около 100 км от Кропоткина.",
    "note_offer": "Первую партию привозим на следующий день после согласования условий.",
  }],
  ["340906", {
    "title": "Что такое замороженные хлебобулочные полуфабрикаты",
    "subtitle": "Общее о категории",
    "text": "По ГОСТ 31806-2012 хлебобулочный полуфабрикат — это заготовка из теста, предназначенная для реализации и последующей обработки в готовое изделие. Такие полуфабрикаты бывают на разных стадиях готовности: замороженное тесто для разделки и выпечки, тестовые заготовки для расстойки, а также частично выпеченные изделия, которые нужно довыпечь. Уточните у нас, на какой именно стадии готовности поставляется продукция под ваш формат — пекарню, кафе или магазин.",
  }],
  ["250918", {
    "title": "Разные стадии готовности продукции",
    "list.0.subtitle": "Тесто для разделки",
    "list.0.text": "Замороженное тесто, которое нужно разделать и испечь на месте.",
    "list.1.subtitle": "Заготовки для расстойки",
    "list.1.text": "Тестовые заготовки, замороженные до расстойки — перед выпечкой их нужно расстоять.",
    "list.2.subtitle": "Готовые к выпечке",
    "list.2.text": "Заготовки, замороженные уже после расстойки — остается только испечь.",
    "list.3.subtitle": "Частично выпеченные",
    "list.3.text": "Изделия с неполной выпечкой, которые нужно только довыпечь перед подачей.",
  }],
  ["486707", {
    "title": "Зачем нужны такие полуфабрикаты",
    "subtitle": "Общие преимущества категории",
    "list.0.text": "Экономят время и рабочие руки — не нужно замешивать тесто с нуля",
    "list.1.text": "Не требуют дорогого оборудования для полного цикла выпечки",
    "list.2.text": "Подходят для точек без своей полноценной пекарни — кафе, магазинов, отелей",
    "list.3.text": "Позволяют получить свежую выпечку на месте без длительной подготовки",
  }],
  ["250718", {
    "title": "Что мы гарантируем",
    "list.0.subtitle": "Своя мука",
    "list.0.text": "Продукция готовится из муки собственного помола — как и весь остальной ассортимент завода.",
    "list.1.subtitle": "Контроль качества по ХАССП",
    "list.1.text": "Производство работает по международной системе ХАССП, на продукцию оформляется декларация соответствия.",
    "list.2.subtitle": "Доставка в радиусе 100 км от Кропоткина",
    "list.2.text": "Развозим продукцию ежедневно по Краснодарскому краю.",
  }],
  ["520307", {
    "title": "Нужны замороженные полуфабрикаты для вашей точки?",
    "text": "Расскажите, что нужно — разделку, расстойку или довыпечку — и в каком объеме, подберем поставку и пришлем цены.",
  }],
  ["251118", {
    "title": "Частые вопросы о полуфабрикатах",
    "questions_list.0.question": "Из чего готовится продукция?",
    "questions_list.0.answer": "Из муки собственного помола, на том же производстве, что и остальной ассортимент завода.",
    "questions_list.1.question": "Можно ли заказать без минимального объема?",
    "questions_list.1.answer": "Да, минимального объема заказа нет.",
    "questions_list.2.question": "Как часто доставляете?",
    "questions_list.2.answer": "Ежедневно, по Краснодарскому краю в радиусе около 100 км от Кропоткина.",
    "questions_list.3.question": "Можно ли заказать разово, для одного мероприятия?",
    "questions_list.3.answer": "Да, доступна и разовая закупка, и договор на регулярные поставки.",
    "questions_list.4.question": "На какой стадии готовности поставляется продукция?",
    "questions_list.4.answer": "Зависит от конкретного изделия — уточняйте у менеджера при оформлении заказа.",
  }],
  ["345306", {
    "title": "Уточните наличие и цены",
    "text": "Оставьте контакты — уточним, какие позиции и на какой стадии готовности доступны под ваш формат.",
  }],
  ["349306", {
    "title": "Узнать про полуфабрикаты",
    "text": "Оставьте телефон — расскажем, что есть в наличии и на каких условиях.",
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
