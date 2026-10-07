// js/viewed.js
// Модуль «Недавно просмотренные товары» и панель администратора (Аналитика)

import { addItem } from "./cart.js";

// ================================================================
// НАСТРОЙКИ И КЛЮЧИ ХРАНИЛИЩА
// ================================================================
const STORAGE_VIEWED_KEY = "viewed_items_v1";
const STORAGE_LOG_KEY    = "admin_views_log_v1";
const STORAGE_INIT_KEY   = "viewed_initialized_v1";
const MAX_VIEWED_ITEMS   = 12;
const BRICK_PRICE        = 22.70;

// ================================================================
// СЛОВАРИ И МАППИНГ
// ================================================================
const COLOR_NAMES = {
  gray:  "Серо-голубой",
  gray2: "Тёмно-серый",
  pink:  "Розово-персиковый",
  peach: "Персиковый",
  beige: "Бежево-кремовый",
  cream: "Кремово-белый",
};

const COLOR_HEX = {
  gray:  "#a8b0b8",
  gray2: "#8f9ba5",
  pink:  "#e8a89a",
  peach: "#f0b8a0",
  beige: "#e8d4a8",
  cream: "#f0e8d8",
};

const SIZE_NAMES = {
  "250x120x65": "250×120×65 (одинарный)",
  "250x120x88": "250×120×88 (полуторный)",
};

const SIZE_SHORT = {
  "250x120x65": "250×120×65",
  "250x120x88": "250×120×88",
};

const LAYOUT_NAMES = {
  running:      "Ложковая (Кладка 1)",
  multirow:     "Многорядная 3+1 (Кладка 2)",
  multirow_5_1: "Шестирядная 5+1 (Кладка 3)",
};

const LAYOUT_SHORT = {
  running:      "Кладка 1",
  multirow:     "Кладка 2",
  multirow_5_1: "Кладка 3",
};

const MORTAR_NAMES = {
  black: "Тёмный раствор",
  white: "Светлый раствор",
};

const MORTAR_SHORT = {
  black: "Тёмный шов",
  white: "Светлый шов",
};

const MORTAR_HEX = {
  black: "#1e2329",
  white: "#e2e8f0",
};

const MODEL_NAMES = {
  plane: "Коттедж",
  three_story_house: "Трёхэтажный дом",
  five_story_building: "Пятиэтажный дом",
};

// ================================================================
// ОФИЦИАЛЬНЫЙ КАТАЛОГ ПРОДУКЦИИ ЧЗСК (silicatbrick.ru)
// ================================================================
export const CHZSK_CATALOG_URL = "https://silicatbrick.ru/silikatnyy-kirpich/";

export const CHZSK_PRODUCTS = {
  // 1. Одинарный полнотелый: ЕДИНСТВЕННЫЙ силикатный кирпич 250×120×65 производства ЧЗСК
  "250x120x65": {
    gray: {
      name: "Кирпич силикатный полнотелый одинарный рядовой 200/50",
      shortTitle: "Полнотелый одинарный рядовой (250×120×65)",
      url: "https://silicatbrick.ru/silikatnyy-kirpich/kirpich-polnotelyy/kirpich-silikatnyy-polnotelyy-odinarnyy-ryadovoy-200-50/",
      imageUrl: "images/products/odinarnyy_gray.jpg",
      price: 21.70,
      articul: "ЧЗСК-ОДИН-200",
      description: "ГОСТ 379-2015, марка М200/F50. Единственный кирпич формата 250х120х65 в номенклатуре ЧЗСК.",
      isOnlySizeColor: true,
    },
  },
  // 2. Утолщенный (полуторный) кирпич 250×120×88
  "250x120x88": {
    gray: {
      name: "Кирпич силикатный полнотелый утолщенный рядовой 200/50",
      shortTitle: "Полнотелый утолщенный рядовой (250×120×88)",
      url: "https://silicatbrick.ru/silikatnyy-kirpich/kirpich-polnotelyy/kirpich-silikatnyy-polnotelyy-utolschennyy-ryadovoy-200-50/",
      imageUrl: "images/products/utolschennyy_gray.jpg",
      price: 22.70,
      articul: "ЧЗСК-УТОЛ-200",
      description: "ГОСТ 379-2015, марка М200, морозостойкость F50.",
    },
    gray2: {
      name: "Кирпич силикатный утолщенный объемного окрашивания «Графит» 150/50",
      shortTitle: "Объемно-окрашенный «Графит» (250×120×88)",
      url: "https://silicatbrick.ru/silikatnyy-kirpich/kirpich-obemnogo-okrashivaniya/kirpich-silikatnyy-utolschennyy-obemnogo-okrashivaniya-oranzhevyy-150-50-clone/",
      imageUrl: "images/products/utolschennyy_gray2.jpg",
      price: 35.50,
      articul: "ЧЗСК-ГРАФ-150",
      description: "ГОСТ 379-2015, марка М150/F50. Графитовый цвет объемного окрашивания.",
    },
    peach: {
      name: "Кирпич силикатный утолщенный объемного окрашивания «Оранжевый» 150/50",
      shortTitle: "Объемно-окрашенный «Оранжевый» (250×120×88)",
      url: "https://silicatbrick.ru/silikatnyy-kirpich/kirpich-obemnogo-okrashivaniya/kirpich-silikatnyy-utolschennyy-obemnogo-okrashivaniya-oranzhevyy-150-50/",
      imageUrl: "images/products/utolschennyy_peach.jpg",
      price: 35.50,
      articul: "ЧЗСК-ОРАНЖ-150",
      description: "ГОСТ 379-2015, марка М150/F50. Стойкий оранжево-персиковый пигмент.",
    },
    pink: {
      name: "Кирпич силикатный утолщенный объемного окрашивания «Красный» 150/50",
      shortTitle: "Объемно-окрашенный «Красный» (250×120×88)",
      url: "https://silicatbrick.ru/silikatnyy-kirpich/kirpich-obemnogo-okrashivaniya/kirpich-silikatnyy-utolschennyy-obemnogo-okrashivaniya-krasnyy-150-50/",
      imageUrl: "images/products/utolschennyy_pink.jpg",
      price: 35.50,
      articul: "ЧЗСК-КРАСН-150",
      description: "ГОСТ 379-2015, марка М150/F50. Насыщенный красный цвет объемного окрашивания.",
    },
    beige: {
      name: "Кирпич силикатный утолщенный объемного окрашивания «Желтый» 150/50",
      shortTitle: "Объемно-окрашенный «Желтый» (250×120×88)",
      url: "https://silicatbrick.ru/silikatnyy-kirpich/kirpich-obemnogo-okrashivaniya/kirpich-silikatnyy-utolschennyy-obemnogo-okrashivaniya-grafit-150-50-clone/",
      imageUrl: "images/products/utolschennyy_beige.jpg",
      price: 35.50,
      articul: "ЧЗСК-ЖЕЛТ-150",
      description: "ГОСТ 379-2015, марка М150/F50. Теплый желто-бежевый оттенок.",
    },
    cream: {
      name: "Кирпич силикатный утолщенный с технологическими пустотами рядовой марки 150",
      shortTitle: "Пустотелый утолщенный рядовой (250×120×88)",
      url: "https://silicatbrick.ru/silikatnyy-kirpich/kirpich-s-pustotami/kirpich-silikatnyy-utolschennyy-s-tehnologicheskimi-pustotami-ryadovoy-marki-150/",
      imageUrl: "images/products/utolschennyy_cream.jpg",
      price: 21.30,
      articul: "ЧЗСК-ПУСТ-150",
      description: "ГОСТ 379-2015, марка М150/F50. Облегченный силикатный кирпич с пустотами.",
    },
  },
};

/**
 * Получить данные официального товара по размеру и цвету.
 * Для формата 250×120×65 гарантированно возвращается единственный кирпич:
 * «Кирпич силикатный полнотелый одинарный рядовой 200/50»
 */
export function getProductForConfig(size, color) {
  if (size === "250x120x65") {
    return CHZSK_PRODUCTS["250x120x65"].gray;
  }
  return CHZSK_PRODUCTS["250x120x88"]?.[color] || CHZSK_PRODUCTS["250x120x88"].gray;
}

// ================================================================
// АВТОРИЗАЦИЯ И РАЗГРАНИЧЕНИЕ ПРАВ АДМИНИСТРАТОРА
// ================================================================
const ADMIN_STORAGE_AUTH_KEY = "threejsbrick_admin_auth_v1";
const DEFAULT_ADMIN_PIN = "chzsk2026";

/**
 * Проверка прав администратора для доступа к аналитике ЧЗСК.
 * Поддерживает:
 * 1. Интеграцию с личным кабинетом CS-Cart на silicatbrick.ru (window.Tygh?.user_type === 'A')
 * 2. Авторизационный токен в sessionStorage
 * 3. Параметр запроса URL: ?admin=chzsk2026 или ?admin_key=chzsk2026
 */
export function isUserAdmin() {
  try {
    if (typeof window !== "undefined") {
      // 1. В режиме разработки и тестирования (локально) — доступ открыт сразу без лишних паролей
      const isProductionDomain = window.location.hostname.includes("silicatbrick.ru");
      if (!isProductionDomain) {
        return true;
      }

      // 2. В релизе на официальном сайте silicatbrick.ru (CS-Cart):
      // Проверка сессии администратора магазина
      if (window.Tygh && (window.Tygh.user_type === "A" || window.Tygh.area === "A")) return true;
      if (window.parent && window.parent.Tygh && (window.parent.Tygh.user_type === "A" || window.parent.Tygh.area === "A")) return true;

      // Проверка ключа в URL или сохраненной сессии
      const urlParams = new URLSearchParams(window.location.search);
      const urlAdminKey = urlParams.get("admin") || urlParams.get("admin_key");
      const correctPin = localStorage.getItem("chzsk_admin_pin") || DEFAULT_ADMIN_PIN;
      if (urlAdminKey && urlAdminKey === correctPin) {
        sessionStorage.setItem(ADMIN_STORAGE_AUTH_KEY, "true");
        return true;
      }

      return sessionStorage.getItem(ADMIN_STORAGE_AUTH_KEY) === "true";
    }
  } catch (err) {
    console.warn("[AdminAuth] Ошибка проверки прав:", err);
  }
  return true;
}

export function openAdminAuthModal() {
  const modal = document.getElementById("adminAuthModal");
  if (!modal) {
    promptAdminAuth();
    return;
  }
  const input = document.getElementById("adminPinInput");
  const errEl = document.getElementById("adminAuthError");
  if (errEl) errEl.hidden = true;
  if (input) input.value = "";
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => input?.focus(), 80);
}

export function closeAdminAuthModal() {
  const modal = document.getElementById("adminAuthModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}

export function handleAdminAuthSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById("adminPinInput");
  const errEl = document.getElementById("adminAuthError");
  const entered = input ? input.value.trim() : "";
  const correctPin = localStorage.getItem("chzsk_admin_pin") || DEFAULT_ADMIN_PIN;

  if (entered === correctPin) {
    sessionStorage.setItem(ADMIN_STORAGE_AUTH_KEY, "true");
    closeAdminAuthModal();
    openAdminModal();
    return true;
  } else {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = "Неверный пароль. Попробуйте еще раз (код по умолчанию: chzsk2026).";
    }
    input?.select();
    return false;
  }
}

export function promptAdminAuth() {
  const correctPin = localStorage.getItem("chzsk_admin_pin") || DEFAULT_ADMIN_PIN;
  const entered = window.prompt(
    "Панель аналитики ЧЗСК доступна только администраторам.\n\nВведите пароль администратора (по умолчанию: chzsk2026):"
  );
  if (entered === null) return false;

  if (entered.trim() === correctPin) {
    sessionStorage.setItem(ADMIN_STORAGE_AUTH_KEY, "true");
    openAdminModal();
    return true;
  } else {
    alert("Неверный пароль доступа к аналитической панели.");
    return false;
  }
}

export function logoutAdmin() {
  sessionStorage.removeItem(ADMIN_STORAGE_AUTH_KEY);
  closeAdminModal();
  alert("Сессия администратора завершена.");
}

// ================================================================
// ХРАНИЛИЩЕ LOCALSTORAGE
// ================================================================
function loadViewedItems() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_VIEWED_KEY));
    if (!Array.isArray(data)) return [];
    return data.map((item) => {
      const prod = getProductForConfig(item.size, item.color_brick);
      if (prod) {
        return {
          ...item,
          title: prod.name || item.title,
          price: prod.price,
          catalogUrl: prod.url || item.catalogUrl,
          imageUrl: prod.imageUrl || item.imageUrl,
        };
      }
      return item;
    });
  } catch {
    return [];
  }
}

function saveViewedItems(items) {
  try {
    localStorage.setItem(STORAGE_VIEWED_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("[Viewed] Не удалось сохранить viewed_items_v1:", err);
  }
}

function loadAdminLog() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_LOG_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveAdminLog(log) {
  try {
    localStorage.setItem(STORAGE_LOG_KEY, JSON.stringify(log));
  } catch (err) {
    console.warn("[Viewed] Не удалось сохранить admin_views_log_v1:", err);
  }
}

// ================================================================
// ВИТРИНА ПРОДУКЦИИ ЧЗСК ПО УМОЛЧАНИЮ (silicatbrick.ru)
// ================================================================
function getCatalogShowcaseItems() {
  const now = Date.now();
  const p1 = getProductForConfig("250x120x65", "gray");
  const p2 = getProductForConfig("250x120x88", "gray");
  const p3 = getProductForConfig("250x120x88", "peach");
  const p4 = getProductForConfig("250x120x88", "gray2");
  const p5 = getProductForConfig("250x120x88", "pink");
  const p6 = getProductForConfig("250x120x88", "beige");
  const p7 = getProductForConfig("250x120x88", "cream");

  return [
    {
      id: "gray_250x120x65_running_black",
      title: p1.name,
      size: "250x120x65",
      layout: "running",
      color_brick: "gray",
      color_rastvor: "black",
      colorHex: COLOR_HEX.gray,
      price: p1.price,
      catalogUrl: p1.url,
      imageUrl: p1.imageUrl,
      modelKey: "plane",
      timestamp: new Date(now - 1000 * 60 * 10).toISOString(),
    },
    {
      id: "peach_250x120x88_running_black",
      title: p3.name,
      size: "250x120x88",
      layout: "running",
      color_brick: "peach",
      color_rastvor: "black",
      colorHex: COLOR_HEX.peach,
      price: p3.price,
      catalogUrl: p3.url,
      imageUrl: p3.imageUrl,
      modelKey: "plane",
      timestamp: new Date(now - 1000 * 60 * 25).toISOString(),
    },
    {
      id: "gray2_250x120x88_multirow_white",
      title: p4.name,
      size: "250x120x88",
      layout: "multirow",
      color_brick: "gray2",
      color_rastvor: "white",
      colorHex: COLOR_HEX.gray2,
      price: p4.price,
      catalogUrl: p4.url,
      imageUrl: p4.imageUrl,
      modelKey: "three_story_house",
      timestamp: new Date(now - 1000 * 60 * 45).toISOString(),
    },
    {
      id: "pink_250x120x88_multirow_5_1_black",
      title: p5.name,
      size: "250x120x88",
      layout: "multirow_5_1",
      color_brick: "pink",
      color_rastvor: "black",
      colorHex: COLOR_HEX.pink,
      price: p5.price,
      catalogUrl: p5.url,
      imageUrl: p5.imageUrl,
      modelKey: "plane",
      timestamp: new Date(now - 1000 * 60 * 70).toISOString(),
    },
    {
      id: "beige_250x120x88_running_black",
      title: p6.name,
      size: "250x120x88",
      layout: "running",
      color_brick: "beige",
      color_rastvor: "black",
      colorHex: COLOR_HEX.beige,
      price: p6.price,
      catalogUrl: p6.url,
      imageUrl: p6.imageUrl,
      modelKey: "plane",
      timestamp: new Date(now - 1000 * 60 * 110).toISOString(),
    },
    {
      id: "gray_250x120x88_multirow_white",
      title: p2.name,
      size: "250x120x88",
      layout: "multirow",
      color_brick: "gray",
      color_rastvor: "white",
      colorHex: COLOR_HEX.gray,
      price: p2.price,
      catalogUrl: p2.url,
      imageUrl: p2.imageUrl,
      modelKey: "three_story_house",
      timestamp: new Date(now - 1000 * 60 * 150).toISOString(),
    },
    {
      id: "cream_250x120x88_running_white",
      title: p7.name,
      size: "250x120x88",
      layout: "running",
      color_brick: "cream",
      color_rastvor: "white",
      colorHex: COLOR_HEX.cream,
      price: p7.price,
      catalogUrl: p7.url,
      imageUrl: p7.imageUrl,
      modelKey: "three_story_house",
      timestamp: new Date(now - 1000 * 60 * 200).toISOString(),
    },
  ];
}

// Инициализация демонстрационной витриной ЧЗСК
function seedInitialDataIfNeeded() {
  const existingViewed = loadViewedItems();
  // Если список пуст — наполняем образцами продукции ЧЗСК
  if (!existingViewed || existingViewed.length === 0) {
    const showcase = getCatalogShowcaseItems();
    saveViewedItems(showcase);
  }

  const existingLog = loadAdminLog();
  if (!existingLog || existingLog.length === 0) {
    const showcase = getCatalogShowcaseItems();
    saveAdminLog(showcase.map((i) => ({ ...i, source: "Каталог ЧЗСК" })));
  }
}

// ================================================================
// ТЕКУЩАЯ КОНФИГУРАЦИЯ ИЗ ФОРМЫ
// ================================================================
function getCurrentBrickConfig() {
  const size = document.querySelector('input[name="size"]:checked')?.value;
  const layout = document.querySelector('input[name="layout"]:checked')?.value;
  let color_brick = document.querySelector('input[name="color_brick"]:checked')?.value;
  const color_rastvor = document.querySelector('input[name="color_rastvor"]:checked')?.value;
  const modelSelect = document.getElementById("model-select");
  const modelKey = modelSelect?.value || "";

  if (!size || !layout || !color_brick || !color_rastvor) {
    return null;
  }

  // Для формата 250х120х65 в номенклатуре ЧЗСК существует только серый рядовой полнотелый
  if (size === "250x120x65" && color_brick !== "gray") {
    color_brick = "gray";
  }

  const product = getProductForConfig(size, color_brick);
  const id = `${color_brick}_${size}_${layout}_${color_rastvor}`;
  const title = product ? product.name : `Кирпич силикатный • ${COLOR_NAMES[color_brick] || color_brick}`;
  const colorHex = COLOR_HEX[color_brick] || "#d4d4d4";
  const price = product ? product.price : BRICK_PRICE;

  return {
    id,
    title,
    size,
    layout,
    color_brick,
    color_rastvor,
    colorHex,
    modelKey,
    price,
    catalogUrl: product?.url || CHZSK_CATALOG_URL,
    imageUrl: product?.imageUrl || "",
    timestamp: new Date().toISOString(),
  };
}

// ================================================================
// ОТСЛЕЖИВАНИЕ ПРОСМОТРОВ
// ================================================================
let lastTrackedInfo = null;

function isDuplicateTrack(cfg) {
  const now = Date.now();
  if (
    lastTrackedInfo &&
    lastTrackedInfo.id === cfg.id &&
    now - lastTrackedInfo.time < 1200
  ) {
    return true;
  }
  lastTrackedInfo = { id: cfg.id, time: now };
  return false;
}

function trackView(source = "Панель конфигуратора") {
  const cfg = getCurrentBrickConfig();
  if (!cfg) return;

  if (isDuplicateTrack(cfg)) return;

  // 1. Обновляем список viewed_items_v1 (уникальные недавно просмотренные до 12 шт.)
  let viewedItems = loadViewedItems();
  viewedItems = viewedItems.filter((item) => item.id !== cfg.id);
  viewedItems.unshift({
    ...cfg,
    timestamp: new Date().toISOString(),
  });

  if (viewedItems.length > MAX_VIEWED_ITEMS) {
    viewedItems = viewedItems.slice(0, MAX_VIEWED_ITEMS);
  }
  saveViewedItems(viewedItems);
  renderViewedSection();

  // 2. Детальный лог всех просмотров для администратора
  let adminLog = loadAdminLog();
  adminLog.push({
    ...cfg,
    source,
    timestamp: new Date().toISOString(),
  });

  if (adminLog.length > 1000) {
    adminLog = adminLog.slice(-1000);
  }
  saveAdminLog(adminLog);

  // Если открыто окно администратора, сразу обновляем статистику
  const adminModal = document.getElementById("adminModal");
  if (adminModal && !adminModal.hidden) {
    renderAdminModal();
  }
}

let debounceTimer = null;
function scheduleDebouncedTrack(source = "Панель конфигуратора") {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    trackView(source);
  }, 350);
}

// ================================================================
// ФОРМАТИРОВАНИЕ ДЛЯ ОТОБРАЖЕНИЯ
// ================================================================
function formatDateTime(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatPrice(n) {
  const num = typeof n === "number" ? n : parseFloat(n) || 0;
  return (
    num.toLocaleString("ru-RU", {
      minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
      maximumFractionDigits: 2,
    }) + " ₽"
  );
}

// ================================================================
// РЕНДЕР СЕКЦИИ «НЕДАВНО ПРОСМОТРЕННЫЕ»
// ================================================================
function renderViewedSection() {
  const listEl = document.getElementById("viewedItemsList");
  const countEl = document.getElementById("viewedCount");
  const clearBtn = document.getElementById("clearViewedBtn");

  if (!listEl) return;

  const items = loadViewedItems();

  if (countEl) {
    countEl.textContent = items.length;
  }
  if (clearBtn) {
    clearBtn.disabled = items.length === 0;
  }

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="viewed-empty">
        <div class="viewed-empty__icon">🧱</div>
        <div class="viewed-empty__text">История просмотров пуста</div>
        <div class="viewed-empty__hint">Выберите размер, кладку и цвет кирпича в конфигураторе выше или нажмите кнопку, чтобы загрузить каталог завода.</div>
        <button id="viewedLoadCatalogBtn" type="button" class="btn btn--outline" style="margin-top: 14px; font-size: 0.85rem; padding: 8px 18px; text-transform: none;">
          📦 Показать каталог продукции ЧЗСК
        </button>
      </div>
    `;
    const loadCatBtn = document.getElementById("viewedLoadCatalogBtn");
    if (loadCatBtn) {
      loadCatBtn.addEventListener("click", () => {
        saveViewedItems(getCatalogShowcaseItems());
        renderViewedSection();
      });
    }
    return;
  }

  listEl.innerHTML = items
    .map((item) => {
      const mortarColor = MORTAR_HEX[item.color_rastvor] || "#94a3b8";
      const mortarTitle = MORTAR_NAMES[item.color_rastvor] || "Раствор";
      const product = getProductForConfig(item.size, item.color_brick);
      const catalogUrl = product?.url || item.catalogUrl || CHZSK_CATALOG_URL;
      const itemTitle = product?.name || item.title;
      const displayPrice = product?.price || item.price || BRICK_PRICE;
      const brickImg = product?.imageUrl || item.imageUrl || "";

      return `
      <article class="viewed-card" data-id="${item.id}">
        <div class="viewed-card__preview" title="Нажмите, чтобы применить в визуализаторе">
          ${
            brickImg
              ? `<img class="viewed-card__main-photo" src="${brickImg}" alt="${itemTitle}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
              : ""
          }
          <div class="viewed-card__brick viewed-card__brick--fallback" style="${brickImg ? "display: none;" : "display: flex;"} background-color: ${item.colorHex}; border: 3px solid ${mortarColor};" title="Цвет: ${COLOR_NAMES[item.color_brick] || item.color_brick}">
            <div class="viewed-card__brick-inner"></div>
          </div>
          <span class="viewed-card__mortar-badge" style="background: ${mortarColor};" title="Шов: ${mortarTitle}"></span>
        </div>

        <div class="viewed-card__body">
          <div class="viewed-card__catalog-bar">
            <a href="${catalogUrl}" target="_blank" rel="noopener noreferrer" class="viewed-card__catalog-link" title="Перейти на страницу товара на silicatbrick.ru">
              <span class="viewed-card__catalog-tag">silicatbrick.ru ↗</span>
            </a>
          </div>

          <h3 class="viewed-card__title" title="${itemTitle}">${itemTitle}</h3>

          <div class="viewed-card__specs">
            <span class="viewed-badge" title="Размер кирпича">${SIZE_SHORT[item.size] || item.size}</span>
            <span class="viewed-badge" title="Вид кладки">${LAYOUT_SHORT[item.layout] || item.layout}</span>
            <span class="viewed-badge viewed-badge--mortar" title="Цвет раствора">${MORTAR_SHORT[item.color_rastvor] || item.color_rastvor}</span>
          </div>

          <div class="viewed-card__price-row">
            <span class="viewed-card__price">${formatPrice(displayPrice)}</span>
            <span class="viewed-card__unit">за шт.</span>
          </div>

          <div class="viewed-card__actions">
            <a href="${catalogUrl}" target="_blank" rel="noopener noreferrer" class="btn viewed-btn viewed-btn--go" title="Перейти на страницу товара на silicatbrick.ru">
              Перейти ↗
            </a>
            <button type="button" class="btn viewed-btn viewed-btn--cart" data-action="cart" data-id="${item.id}" data-color="${item.color_brick}">
              🛒 В корзину
            </button>
          </div>
        </div>
      </article>
    `;
    })
    .join("");
}

// ================================================================
// ДЕЙСТВИЯ НАД КАРТОЧКАМИ ПРОСМОТРЕННЫХ
// ================================================================
function restoreAndVisualize(item) {
  if (!item) return;

  // 1. Выставляем радио-кнопки
  const sizeRadio = document.querySelector(`input[name="size"][value="${item.size}"]`);
  if (sizeRadio) sizeRadio.checked = true;

  const layoutRadio = document.querySelector(`input[name="layout"][value="${item.layout}"]`);
  if (layoutRadio) layoutRadio.checked = true;

  const colorBrickRadio = document.querySelector(`input[name="color_brick"][value="${item.color_brick}"]`);
  if (colorBrickRadio) colorBrickRadio.checked = true;

  const colorRastvorRadio = document.querySelector(`input[name="color_rastvor"][value="${item.color_rastvor}"]`);
  if (colorRastvorRadio) colorRastvorRadio.checked = true;

  // 2. Модель дома
  const modelSelect = document.getElementById("model-select");
  if (modelSelect) {
    if (item.modelKey && Array.from(modelSelect.options).some((o) => o.value === item.modelKey)) {
      modelSelect.value = item.modelKey;
    } else if (!modelSelect.value && modelSelect.options.length > 1) {
      modelSelect.selectedIndex = 1;
    }
  }

  // 3. Вызываем однократное событие 'change' для обновления состояния кнопок и 3D
  const triggerRadio = colorBrickRadio || sizeRadio;
  if (triggerRadio) {
    triggerRadio.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // 4. Запускаем визуализацию (3D или 2D в зависимости от активного режима)
  const card2D = document.getElementById("card2D");
  const card3D = document.getElementById("card3D");
  const is2DVisible = card2D && window.getComputedStyle(card2D).display !== "none";

  if (is2DVisible) {
    const view2DBtn = document.getElementById("view2DBtn");
    if (view2DBtn && !view2DBtn.disabled) {
      view2DBtn.click();
    }
    card2D.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    const loadBtn = document.getElementById("loadBtn");
    if (loadBtn && !loadBtn.disabled) {
      loadBtn.click();
    }
    const scrollTarget = card3D || document.getElementById("config-panel");
    scrollTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function handleAddToCartFromCard(itemOrColor, btnEl) {
  let color = "gray";
  let price = null;
  let title = null;
  let imageUrl = null;

  if (typeof itemOrColor === "object" && itemOrColor !== null) {
    color = itemOrColor.color_brick || "gray";
    price = itemOrColor.price;
    title = itemOrColor.title;
    imageUrl = itemOrColor.imageUrl;
  } else if (typeof itemOrColor === "string") {
    color = itemOrColor;
  }

  // Вызов метода корзины из js/cart.js
  if (typeof addItem === "function") {
    addItem(color, 1, price, title, imageUrl);
  } else if (window.cartModule && typeof window.cartModule.addItem === "function") {
    window.cartModule.addItem(color, 1, price, title, imageUrl);
  }

  // Анимация плавающей кнопки корзины
  const cartFab = document.getElementById("cartBtn");
  if (cartFab) {
    cartFab.classList.add("cart-fab--bump");
    setTimeout(() => cartFab.classList.remove("cart-fab--bump"), 400);
  }

  // Временная индикация на кнопке
  if (btnEl) {
    const originalText = btnEl.innerHTML;
    btnEl.classList.add("viewed-btn--added");
    btnEl.innerHTML = "✓ Добавлено!";
    btnEl.disabled = true;

    setTimeout(() => {
      btnEl.classList.remove("viewed-btn--added");
      btnEl.innerHTML = originalText;
      btnEl.disabled = false;
    }, 1200);
  }
}

// ================================================================
// ПАНЕЛЬ АДМИНИСТРАТОРА (АНАЛИТИКА)
// ================================================================
function openAdminModal() {
  const modal = document.getElementById("adminModal");
  if (!modal) return;
  renderAdminModal();
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeAdminModal() {
  const modal = document.getElementById("adminModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}

function renderAdminModal() {
  const modal = document.getElementById("adminModal");
  if (!modal) return;

  const log = loadAdminLog();
  const totalViews = log.length;

  // 1. Сводка
  const kpiTotalEl = document.getElementById("adminKpiTotal");
  const kpiUniqueEl = document.getElementById("adminKpiUnique");
  const kpiFirstEl = document.getElementById("adminKpiFirst");
  const kpiLastEl = document.getElementById("adminKpiLast");

  const uniqueConfigs = new Set(log.map((i) => i.id)).size;
  const firstView = log.length > 0 ? log[0].timestamp : null;
  const lastView = log.length > 0 ? log[log.length - 1].timestamp : null;

  if (kpiTotalEl)  kpiTotalEl.textContent = totalViews;
  if (kpiUniqueEl) kpiUniqueEl.textContent = uniqueConfigs;
  if (kpiFirstEl)  kpiFirstEl.textContent = firstView ? formatDateTime(firstView) : "—";
  if (kpiLastEl)   kpiLastEl.textContent = lastView ? formatDateTime(lastView) : "—";

  // 2. Популярность цветов кирпича
  const colorsContainer = document.getElementById("adminColorsAnalytics");
  if (colorsContainer) {
    if (totalViews === 0) {
      colorsContainer.innerHTML = `<div class="admin-empty-text">Нет данных о просмотрах</div>`;
    } else {
      const colorCounts = {};
      Object.keys(COLOR_NAMES).forEach((c) => (colorCounts[c] = 0));
      log.forEach((entry) => {
        if (colorCounts[entry.color_brick] !== undefined) {
          colorCounts[entry.color_brick]++;
        } else {
          colorCounts[entry.color_brick] = (colorCounts[entry.color_brick] || 0) + 1;
        }
      });

      const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);

      colorsContainer.innerHTML = sortedColors
        .map(([colorKey, count]) => {
          const pct = totalViews > 0 ? ((count / totalViews) * 100).toFixed(1) : "0.0";
          const hex = COLOR_HEX[colorKey] || "#cbd5e1";
          const name = COLOR_NAMES[colorKey] || colorKey;

          return `
            <div class="admin-bar-row">
              <div class="admin-bar-info">
                <span class="admin-color-swatch" style="background:${hex};"></span>
                <span class="admin-bar-name">${name}</span>
                <span class="admin-bar-values"><strong>${count}</strong> (${pct}%)</span>
              </div>
              <div class="admin-bar-track">
                <div class="admin-bar-fill" style="width: ${pct}%; background-color: ${hex};"></div>
              </div>
            </div>
          `;
        })
        .join("");
    }
  }

  // 3. Аналитика по размерам кирпича
  const sizesContainer = document.getElementById("adminSizesAnalytics");
  if (sizesContainer) {
    if (totalViews === 0) {
      sizesContainer.innerHTML = `<div class="admin-empty-text">Нет данных</div>`;
    } else {
      const sizeCounts = { "250x120x65": 0, "250x120x88": 0 };
      log.forEach((e) => {
        if (sizeCounts[e.size] !== undefined) sizeCounts[e.size]++;
      });

      sizesContainer.innerHTML = Object.entries(sizeCounts)
        .map(([sizeKey, count]) => {
          const pct = totalViews > 0 ? ((count / totalViews) * 100).toFixed(1) : "0.0";
          const label = SIZE_NAMES[sizeKey] || sizeKey;
          return `
            <div class="admin-bar-row">
              <div class="admin-bar-info">
                <span class="admin-bar-name">${label}</span>
                <span class="admin-bar-values"><strong>${count}</strong> (${pct}%)</span>
              </div>
              <div class="admin-bar-track">
                <div class="admin-bar-fill admin-bar-fill--primary" style="width: ${pct}%;"></div>
              </div>
            </div>
          `;
        })
        .join("");
    }
  }

  // 4. Аналитика по видам кладки
  const layoutsContainer = document.getElementById("adminLayoutsAnalytics");
  if (layoutsContainer) {
    if (totalViews === 0) {
      layoutsContainer.innerHTML = `<div class="admin-empty-text">Нет данных</div>`;
    } else {
      const layoutCounts = { running: 0, multirow: 0, multirow_5_1: 0 };
      log.forEach((e) => {
        if (layoutCounts[e.layout] !== undefined) layoutCounts[e.layout]++;
      });

      layoutsContainer.innerHTML = Object.entries(layoutCounts)
        .map(([layoutKey, count]) => {
          const pct = totalViews > 0 ? ((count / totalViews) * 100).toFixed(1) : "0.0";
          const label = LAYOUT_NAMES[layoutKey] || layoutKey;
          return `
            <div class="admin-bar-row">
              <div class="admin-bar-info">
                <span class="admin-bar-name">${label}</span>
                <span class="admin-bar-values"><strong>${count}</strong> (${pct}%)</span>
              </div>
              <div class="admin-bar-track">
                <div class="admin-bar-fill admin-bar-fill--secondary" style="width: ${pct}%;"></div>
              </div>
            </div>
          `;
        })
        .join("");
    }
  }

  // 5. Таблица последних 50 просмотров
  const tbody = document.getElementById("adminLogTableBody");
  if (tbody) {
    if (totalViews === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="admin-table-empty">История просмотров пуста</td></tr>`;
    } else {
      const last50 = log.slice(-50).reverse();
      tbody.innerHTML = last50
        .map((entry, index) => {
          const dateStr = formatDateTime(entry.timestamp);
          const colorName = COLOR_NAMES[entry.color_brick] || entry.color_brick || "—";
          const hex = COLOR_HEX[entry.color_brick] || "#cbd5e1";
          const sizeStr = SIZE_SHORT[entry.size] || entry.size || "—";
          const layoutStr = LAYOUT_SHORT[entry.layout] || entry.layout || "—";
          const mortarStr = MORTAR_SHORT[entry.color_rastvor] || entry.color_rastvor || "—";

          return `
            <tr>
              <td class="td-num">${index + 1}</td>
              <td class="td-date">${dateStr}</td>
              <td class="td-color">
                <div class="admin-color-cell">
                  <span class="admin-table-swatch" style="background:${hex};"></span>
                  <span>${colorName}</span>
                </div>
              </td>
              <td>${sizeStr}</td>
              <td>${layoutStr}</td>
              <td>${mortarStr}</td>
            </tr>
          `;
        })
        .join("");
    }
  }
}

// Экспорт в CSV для Excel (с UTF-8 BOM)
function exportAdminLogToCsv() {
  const log = loadAdminLog();
  if (log.length === 0) {
    alert("Нет данных для экспорта в CSV.");
    return;
  }

  const headers = [
    "№",
    "Дата и время",
    "Цвет кирпича",
    "Размер",
    "Вид кладки",
    "Цвет раствора",
    "Объект",
    "Источник события",
    "Цена (руб.)",
  ];

  const rows = log.map((item, idx) => {
    const dateStr = formatDateTime(item.timestamp);
    const colorName = COLOR_NAMES[item.color_brick] || item.color_brick || "";
    const sizeName = SIZE_NAMES[item.size] || item.size || "";
    const layoutName = LAYOUT_NAMES[item.layout] || item.layout || "";
    const mortarName = MORTAR_NAMES[item.color_rastvor] || item.color_rastvor || "";
    const modelName = MODEL_NAMES[item.modelKey] || item.modelKey || "Не указан";
    const source = item.source || "Панель";
    const price = item.price || BRICK_PRICE;

    return [
      idx + 1,
      `"${dateStr}"`,
      `"${colorName}"`,
      `"${sizeName}"`,
      `"${layoutName}"`,
      `"${mortarName}"`,
      `"${modelName}"`,
      `"${source}"`,
      price,
    ].join(";");
  });

  const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "brick_views_analytics.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Сброс статистики администратора
function resetAdminLog() {
  const confirmed = confirm(
    "Вы действительно хотите сбросить всю аналитическую историю просмотров? Это действие необратимо."
  );
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_LOG_KEY);
  renderAdminModal();
}

// Очистить историю просмотренных (пользователь)
function clearViewedHistory() {
  localStorage.removeItem(STORAGE_VIEWED_KEY);
  renderViewedSection();
}

// ================================================================
// ИНИЦИАЛИЗАЦИЯ И СОБЫТИЯ
// ================================================================
function initViewedModule() {
  seedInitialDataIfNeeded();
  renderViewedSection();

  // 1. Делегирование кликов по карточкам секции «Недавно просмотренные»
  const listEl = document.getElementById("viewedItemsList");
  if (listEl) {
    listEl.addEventListener("click", (e) => {
      // Клик по превью визуализирует кирпич в 3D/2D
      const previewEl = e.target.closest(".viewed-card__preview");
      if (previewEl) {
        const card = previewEl.closest(".viewed-card");
        const id = card?.dataset.id;
        const items = loadViewedItems();
        const found = items.find((i) => i.id === id);
        if (found) {
          restoreAndVisualize(found);
          trackView("Карточка «Недавно просмотренные»");
        }
        return;
      }

      const showBtn = e.target.closest('button[data-action="show"]');
      if (showBtn) {
        const id = showBtn.dataset.id;
        const items = loadViewedItems();
        const found = items.find((i) => i.id === id);
        if (found) {
          restoreAndVisualize(found);
          trackView("Карточка «Недавно просмотренные»");
        }
        return;
      }

      const cartBtn = e.target.closest('button[data-action="cart"]');
      if (cartBtn) {
        const id = cartBtn.dataset.id;
        const color = cartBtn.dataset.color || "gray";
        const items = loadViewedItems();
        const found = items.find((i) => i.id === id);
        handleAddToCartFromCard(found || color, cartBtn);
        return;
      }
    });
  }

  // 2. Кнопка «Очистить историю»
  const clearBtn = document.getElementById("clearViewedBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", clearViewedHistory);
  }

  // 3. Стрелки горизонтального скролла карусели
  const prevBtn = document.getElementById("viewedPrevBtn");
  const nextBtn = document.getElementById("viewedNextBtn");
  if (listEl) {
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        listEl.scrollBy({ left: -280, behavior: "smooth" });
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        listEl.scrollBy({ left: 280, behavior: "smooth" });
      });
    }
  }

  // 4. Отслеживание кликов по кнопкам «Визуализация» и «2D Просмотр»
  const loadBtn = document.getElementById("loadBtn");
  if (loadBtn) {
    loadBtn.addEventListener("click", () => {
      trackView("3D Визуализация");
    });
  }

  const view2DBtn = document.getElementById("view2DBtn");
  if (view2DBtn) {
    view2DBtn.addEventListener("click", () => {
      trackView("2D Просмотр");
    });
  }

  // 5. Отслеживание смены радиокнопок и объекта в конфигураторе
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (
      t &&
      (t.name === "size" ||
        t.name === "layout" ||
        t.name === "color_brick" ||
        t.name === "color_rastvor" ||
        t.id === "model-select")
    ) {
      scheduleDebouncedTrack("Панель конфигуратора");
    }
  });

  // 6. Панель администратора (кнопка в шапке и кнопка в подвале)
  const handleOpenAdmin = () => {
    if (isUserAdmin()) {
      openAdminModal();
    } else {
      openAdminAuthModal();
    }
  };

  const adminHeaderBtn = document.getElementById("adminHeaderBtn");
  if (adminHeaderBtn) {
    adminHeaderBtn.addEventListener("click", handleOpenAdmin);
  }

  const adminBtn = document.getElementById("adminPanelBtn");
  if (adminBtn) {
    adminBtn.addEventListener("click", handleOpenAdmin);
  }

  // Закрытие модального окна авторизации администратора
  document.querySelectorAll("[data-close-admin-auth]").forEach((el) => {
    el.addEventListener("click", closeAdminAuthModal);
  });

  // Отправка формы авторизации
  const adminAuthForm = document.getElementById("adminAuthForm");
  if (adminAuthForm) {
    adminAuthForm.addEventListener("submit", handleAdminAuthSubmit);
  }

  const logoutBtn = document.getElementById("adminLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutAdmin);
  }

  document.querySelectorAll("[data-close-admin]").forEach((el) => {
    el.addEventListener("click", closeAdminModal);
  });

  const exportBtn = document.getElementById("adminExportCsvBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportAdminLogToCsv);
  }

  const resetBtn = document.getElementById("adminResetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetAdminLog);
  }

  // Закрытие модальных окон по Escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const authModal = document.getElementById("adminAuthModal");
      if (authModal && !authModal.hidden) {
        closeAdminAuthModal();
      }
      const adminModal = document.getElementById("adminModal");
      if (adminModal && !adminModal.hidden) {
        closeAdminModal();
      }
    }
  });
}

// Старт модуля
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initViewedModule);
} else {
  initViewedModule();
}

// Экспорт для тестирования / расширения
export {
  loadViewedItems,
  loadAdminLog,
  trackView,
  restoreAndVisualize,
  exportAdminLogToCsv,
  getCatalogShowcaseItems,
};
