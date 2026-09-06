(async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const verId = urlParams.get('ver_id');
  const access = urlParams.get('access');

  function findVariantId() {
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

const DATA = [
  ["338106", {
    "text": "Возврат и обмен товара зависят от того, кто покупатель - физическое или юридическое лицо. Проверьте комплектацию и целостность продукции при получении заказа. Если обнаружен брак, ошибка комплектации или нужен возврат, оставьте заявку в Личном кабинете во вкладке «Обмен и ремонт» - мы уточним детали и предложим вариант решения.",
  }],
  ["672507", {
    "title": "В каких случаях можно обратиться к нам",
    "list.0.subtitle": "Обнаружен брак или заводской дефект",
    "list.0.text": "Для технически сложного товара в течение 15 дней со дня передачи вы вправе отказаться от покупки и потребовать возврат денег либо замену товара. После 15 дней требование удовлетворяется только при существенном недостатке, нарушении сроков устранения недостатков или если товар нельзя использовать более 30 дней за год гарантии из-за повторных ремонтов.",
    "list.1.subtitle": "Получена другая позиция",
    "list.1.text": "Маркировка, модель, номинал или количество не совпадают с оформленным заказом - сообщите об этом специалисту, мы согласуем замену и организуем получение ошибочно отправленной продукции.",
    "list.2.subtitle": "Возврат товара физическим лицом",
    "list.2.text": "Товар надлежащего качества можно вернуть в течение 7 дней (ст. 26.1 Закона «О защите прав потребителей»), если он не был в употреблении и сохранены товарный вид, потребительские свойства, пломбы и фабричные ярлыки. Товары с индивидуально-определенными свойствами возврату не подлежат.",
    "list.3.subtitle": "Возврат товара юридическим лицом",
    "list.3.text": "Возврат товара надлежащего качества юридическим лицам не производится (ст. 484 ГК РФ). Товар ненадлежащего качества принимается в течение гарантийного срока по результатам проверки качества.",
  }],
  ["532507", {
    "title": "Как оформить возврат при браке товара",
    "list.0.subtitle": "Оставьте заявку",
    "list.0.text": "В Личном кабинете, во вкладке «Обмен и ремонт», выберите «Гарантийный ремонт или диагностика» и укажите номер заказа, наименование или маркировку позиции.",
    "list.1.subtitle": "Опишите проблему",
    "list.1.text": "Кратко опишите неисправность и при необходимости приложите фото товара, упаковки или этикетки.",
    "list.2.subtitle": "Предоставьте товар на проверку",
    "list.2.text": "Передайте товар в один из филиалов или на склад компании для проверки качества.",
    "list.3.subtitle": "Дождитесь решения",
    "list.3.text": "По результатам проверки специалист согласует замену товара, гарантийный ремонт или возврат денежных средств.",
  }],
  ["348706", {
    "list.0.subtitle": "Оплата по безналичному расчету",
    "list.0.text": "Приехать в любой оптовый отдел или отдел выдачи интернет-заказов и вернуть товар. Изделие должно быть в товарном виде - для технически сложных товаров может потребоваться проверка качества. После заполнения заявления на возврат деньги возвращаются в течение 15 минут, если проверка качества не требуется.",
    "list.1.subtitle": "Отказ от товара до получения",
    "list.1.text": "В Личном кабинете, во вкладке «Обмен и ремонт», оставить заявку «Вернуть товар надлежащего качества». Деньги возвращаются в течение 10 дней с даты обращения.",
    "list.2.subtitle": "Возврат товара после получения",
    "list.2.text": "В Личном кабинете, во вкладке «Обмен и ремонт», оставить заявку «Вернуть товар надлежащего качества» и дождаться обратной связи. Товар нужно вернуть в ближайший магазин или отправить в центральный офис в товарном виде - для технически сложных товаров может потребоваться проверка качества. Деньги возвращаются в течение 10 дней с даты возврата товара.",
  }],
  ["340706", {
    // первое вхождение (короткая подпись у чек-листа) - без изменений, чтобы сохранить порядок совпадений
    "text": "Такая проверка особенно важна при поставках микросхем, измерительных приборов, блоков питания и других электронных компонентов для производственных или ремонтных задач",
  }],
  ["340706", {
    // второе вхождение - закрывающий блок
    "title": "Поможем решить вопрос с полученным заказом",
    "text": "Если товар оказался неисправным, нужен возврат или обмен - оставьте заявку в Личном кабинете во вкладке «Обмен и ремонт» либо обратитесь к нашим специалистам. Мы уточним детали по вашему заказу и объясним дальнейшие действия.",
  }],
];

  // ---------- Прогон: находим существующий блок по layout_id, меняем текст, сохраняем ----------
  async function run() {
    const blocks = await fetchBlockList();
    console.log(`Найдено блоков на странице: ${blocks.length}`);

    const report = { ok: 0, changed_but_wrong: 0, not_found: 0, blocks_missing: [] };
    const usedCount = {}; // сколько раз уже нашли блок с этим layout_id

    for (const [layoutId, fields] of DATA) {
      const occurrence = usedCount[layoutId] || 0;
      const matches = blocks.filter(b => b.layout_id === layoutId);
      const block = matches[occurrence];
      usedCount[layoutId] = occurrence + 1;

      if (!block) {
        console.warn(`❌ Блок с layout_id ${layoutId} (вхождение №${occurrence + 1}) не найден на странице`);
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
