// js/prices.js
// Единый модуль управления ценами продукции ЧЗСК (silicatbrick.ru)
// Автоматически подгружает актуальные цены прямо со страниц завода через Schema.org / CS-Cart

// Каталог продукции с официальными ссылками на silicatbrick.ru
export const PRODUCTS_CONFIG = {
  // 1. Одинарный рядовой 250×120×65 (единственный одинарный кирпич завода)
  "250x120x65": {
    gray: {
      id: "odinarnyy_gray",
      name: "Кирпич силикатный рядовой одинарный полнотелый",
      shortTitle: "Рядовой (полнотелый) (250×120×65)",
      url: "https://silicatbrick.ru/silikatnyy-kirpich/kirpich-polnotelyy/kirpich-silikatnyy-polnotelyy-odinarnyy-ryadovoy-200-50/",
      path: "/silikatnyy-kirpich/kirpich-polnotelyy/kirpich-silikatnyy-polnotelyy-odinarnyy-ryadovoy-200-50/",
      imageUrl: "images/products/odinarnyy_gray.jpg",
      articul: "ЧЗСК-ОДИН-200",
      initialPrice: 23.00,
      isOnlySizeColor: true,
    },
  },
  // 2. Утолщенный (полуторный) кирпич 250×120×88
  "250x120x88": {
    gray: {
      id: "utolschennyy_gray",
      name: "Кирпич силикатный утолщенный рядовой пустотелый СУРПу М-150/F50/1,6",
      shortTitle: "Рядовой (пустотелый) (250×120×88)",
      url: "https://silicatbrick.ru/silikatnyy-kirpich/kirpich-s-pustotami/kirpich-silikatnyy-utolschennyy-s-tehnologicheskimi-pustotami-ryadovoy-marki-150/",
      path: "/silikatnyy-kirpich/kirpich-s-pustotami/kirpich-silikatnyy-utolschennyy-s-tehnologicheskimi-pustotami-ryadovoy-marki-150/",
      imageUrl: "images/products/utolschennyy_gray.jpg",
      articul: "ПУ02",
      initialPrice: 22.60,
    },
    gray2: {
      id: "utolschennyy_gray2",
      name: "Кирпич силикатный утолщенный объемного окрашивания «Графит» 150/50",
      shortTitle: "Графит (250×120×88)",
      url: "https://silicatbrick.ru/silikatnyy-kirpich/kirpich-obemnogo-okrashivaniya/kirpich-silikatnyy-utolschennyy-obemnogo-okrashivaniya-oranzhevyy-150-50-clone/",
      path: "/silikatnyy-kirpich/kirpich-obemnogo-okrashivaniya/kirpich-silikatnyy-utolschennyy-obemnogo-okrashivaniya-oranzhevyy-150-50-clone/",
      imageUrl: "images/products/utolschennyy_gray2.jpg",
      articul: "ЧЗСК-ГРАФ-150",
      initialPrice: 35.50,
    },
    peach: {
      id: "utolschennyy_peach",
      name: "Кирпич силикатный утолщенный объемного окрашивания «Оранжевый» 150/50",
      shortTitle: "Оранжевый (250×120×88)",
      url: "https://silicatbrick.ru/silikatnyy-kirpich/kirpich-obemnogo-okrashivaniya/kirpich-silikatnyy-utolschennyy-obemnogo-okrashivaniya-oranzhevyy-150-50/",
      path: "/silikatnyy-kirpich/kirpich-obemnogo-okrashivaniya/kirpich-silikatnyy-utolschennyy-obemnogo-okrashivaniya-oranzhevyy-150-50/",
      imageUrl: "images/products/utolschennyy_peach.jpg",
      articul: "ЧЗСК-ОРАНЖ-150",
      initialPrice: 35.50,
    },
    pink: {
      id: "utolschennyy_pink",
      name: "Кирпич силикатный утолщенный объемного окрашивания «Красный» 150/50",
      shortTitle: "Красный (250×120×88)",
      url: "https://silicatbrick.ru/silikatnyy-kirpich/kirpich-obemnogo-okrashivaniya/kirpich-silikatnyy-utolschennyy-obemnogo-okrashivaniya-krasnyy-150-50/",
      path: "/silikatnyy-kirpich/kirpich-obemnogo-okrashivaniya/kirpich-silikatnyy-utolschennyy-obemnogo-okrashivaniya-krasnyy-150-50/",
      imageUrl: "images/products/utolschennyy_pink.jpg",
      articul: "ЧЗСК-КРАСН-150",
      initialPrice: 35.50,
    },
    beige: {
      id: "utolschennyy_beige",
      name: "Кирпич силикатный утолщенный объемного окрашивания «Желтый» 150/50",
      shortTitle: "Желтый (250×120×88)",
      url: "https://silicatbrick.ru/silikatnyy-kirpich/kirpich-obemnogo-okrashivaniya/kirpich-silikatnyy-utolschennyy-obemnogo-okrashivaniya-grafit-150-50-clone/",
      path: "/silikatnyy-kirpich/kirpich-obemnogo-okrashivaniya/kirpich-silikatnyy-utolschennyy-obemnogo-okrashivaniya-grafit-150-50-clone/",
      imageUrl: "images/products/utolschennyy_beige.jpg",
      articul: "ЧЗСК-ЖЕЛТ-150",
      initialPrice: 35.50,
    },
    cream: {
      id: "utolschennyy_cream",
      name: "Кирпич силикатный утолщенный объемного окрашивания «Разнотон» 150/50",
      shortTitle: "Разнотон (250×120×88)",
      url: "https://silicatbrick.ru/silikatnyy-kirpich/kirpich-obemnogo-okrashivaniya/kirpich-silikatnyy-utolschennyy-obemnogo-okrashivaniya-zheltyy-150-50-clone/",
      path: "/silikatnyy-kirpich/kirpich-obemnogo-okrashivaniya/kirpich-silikatnyy-utolschennyy-obemnogo-okrashivaniya-zheltyy-150-50-clone/",
      imageUrl: "images/products/utolschennyy_raznoton.jpg",
      articul: "ЧЗСК-РАЗН-150",
      initialPrice: 21.60,
    },
  },
};

export const CATALOG_VERSION = "2026.10.19_v3";
const STORAGE_KEY = `chzsk_live_prices_${CATALOG_VERSION}`;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 час кэша

// Активная таблица цен в оперативной памяти (размер_цвет -> цена)
const activePrices = {};

// Инициализация активной таблицы начальными ценами из актуального каталога
Object.entries(PRODUCTS_CONFIG).forEach(([size, colors]) => {
  Object.entries(colors).forEach(([color, data]) => {
    activePrices[`${size}_${color}`] = data.initialPrice;
  });
});

// Автоматическая фоновая очистка устаревших версий кэша
try {
  if (typeof localStorage !== "undefined") {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("chzsk_live_prices_") && k !== STORAGE_KEY) {
        localStorage.removeItem(k);
      }
    }
  }
} catch {}

// Загрузка кэша из localStorage с проверкой срока жизни (TTL)
try {
  if (typeof localStorage !== "undefined") {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      const isFresh = cached && cached.timestamp && Date.now() - cached.timestamp < CACHE_TTL_MS;
      if (isFresh && cached.prices && typeof cached.prices === "object") {
        Object.assign(activePrices, cached.prices);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }
} catch {
  // Игнорируем ошибку чтения localStorage
}

/**
 * Парсер цены из HTML-кода страницы товара.
 * Извлекает число из Schema.org (JSON-LD) или классов CS-Cart.
 */
export function parsePriceFromHtml(html) {
  if (!html || typeof html !== "string") return null;

  // 1. Поиск в официальной микроразметке Schema.org (JSON-LD)
  const schemaMatch = html.match(/"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (schemaMatch && schemaMatch[1]) {
    const val = parseFloat(schemaMatch[1]);
    if (!isNaN(val) && val > 0) return Math.round(val * 100) / 100;
  }

  // 2. Поиск в стандартном классе CS-Cart (.ty-price-num)
  const classMatch = html.match(/class="[^"]*ty-price-num[^"]*"[^>]*>([0-9]+(?:\.[0-9]+)?)</i);
  if (classMatch && classMatch[1]) {
    const val = parseFloat(classMatch[1]);
    if (!isNaN(val) && val > 0) return Math.round(val * 100) / 100;
  }

  return null;
}

/**
 * Загрузить свежую цену для одного товара
 */
async function fetchSinglePrice(product) {
  const isSilicatDomain =
    typeof window !== "undefined" &&
    (window.location.hostname === "silicatbrick.ru" ||
      window.location.hostname.endsWith(".silicatbrick.ru"));

  // На сайте завода: прямой запрос к сайту (Same-Origin)
  // На localhost / dev: прозрачный CORS-шлюз
  const requestUrl = isSilicatDomain
    ? product.path
    : `https://api.allorigins.win/raw?url=${encodeURIComponent(product.url)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(requestUrl, {
      signal: controller.signal,
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return parsePriceFromHtml(html);
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Фоновая загрузка всех актуальных цен с сайта завода
 */
export async function initLivePrices() {
  const tasks = [];
  const updatedKeys = [];

  for (const [size, colors] of Object.entries(PRODUCTS_CONFIG)) {
    for (const [color, data] of Object.entries(colors)) {
      tasks.push(
        (async () => {
          const freshPrice = await fetchSinglePrice(data);
          const key = `${size}_${color}`;
          if (freshPrice && Math.abs(activePrices[key] - freshPrice) > 0.001) {
            activePrices[key] = freshPrice;
            updatedKeys.push(key);
          }
        })()
      );
    }
  }

  await Promise.allSettled(tasks);

  // Сохраняем обновленные цены в кэш
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        prices: activePrices,
      })
    );
  } catch {}

  // Оповещаем подписчиков (корзину, карточки товаров)
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("chzsk:prices-updated", {
        detail: { ...activePrices },
      })
    );
  }

  return { ...activePrices };
}

/**
 * Получить актуальную цену кирпича по размеру и цвету
 * @param {string} size Формат: "250x120x65" или "250x120x88"
 * @param {string} color Цвет: "gray", "gray2", "peach", "pink", "beige", "cream"
 * @returns {number} Цена в рублях (например: 23 или 24.1)
 */
export function getBrickPrice(size = "250x120x88", color = "gray") {
  // Для размера 250×120×65 у завода только один цвет (рядовой серый)
  const effectiveColor = size === "250x120x65" ? "gray" : color;
  const key = `${size}_${effectiveColor}`;

  if (typeof activePrices[key] === "number") {
    return activePrices[key];
  }

  const fallback = PRODUCTS_CONFIG[size]?.[effectiveColor]?.initialPrice;
  return typeof fallback === "number" ? fallback : 24.10;
}

/**
 * Получить полные данные о товаре ЧЗСК
 */
export function getProductData(size = "250x120x88", color = "gray") {
  const effectiveColor = size === "250x120x65" ? "gray" : color;
  const item = PRODUCTS_CONFIG[size]?.[effectiveColor];
  if (!item) return null;

  return {
    ...item,
    price: getBrickPrice(size, effectiveColor),
  };
}

/**
 * Подписка на обновление цен
 */
export function onPricesUpdated(callback) {
  if (typeof window !== "undefined" && typeof callback === "function") {
    window.addEventListener("chzsk:prices-updated", (e) => callback(e.detail));
  }
}

// Запускаем фоновую подгрузку при старте
if (typeof window !== "undefined") {
  initLivePrices().catch(() => {});
}
