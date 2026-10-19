// js/analytics.js
// Модуль изолированной страницы аналитики ЧЗСК (analytics.html)

import { getBrickPrice, getProductData } from "./prices.js";

const STORAGE_LOG_KEY = "admin_views_log_v1";
const AUTH_SESSION_KEY = "chzsk_admin_authenticated";

const COLOR_NAMES = {
  gray:  "Рядовой (пустотелый)",
  gray2: "Графит",
  pink:  "Красный",
  peach: "Оранжевый",
  beige: "Желтый",
  cream: "Разнотон",
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

const LAYOUT_NAMES = {
  classic: "Классическая (ложковая)",
  offset:  "Со смещением (1/3)",
  block:   "Блочная (столбиками)",
  tyRole:  "Тычковая",
  gothic:  "Готическая",
};

const RASTVOR_NAMES = {
  white: "#ffffff (Белый)",
  gray:  "#808080 (Серый)",
  black: "#222222 (Тёмный)",
  brown: "#654321 (Коричневый)",
};

// Авторизация через password.json

async function getExpectedPassword() {
  try {
    const res = await fetch("password.json", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.admin_password) {
        return String(data.admin_password).trim();
      }
    }
  } catch (err) {
    console.warn("Не удалось прочитать password.json, используется резервный пароль:", err);
  }
  return "chzsk2026";
}

function isAuthenticated() {
  return sessionStorage.getItem(AUTH_SESSION_KEY) === "true";
}

function setAuthenticated(val) {
  if (val) {
    sessionStorage.setItem(AUTH_SESSION_KEY, "true");
  } else {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  }
}

// Данные лога

async function loadLog() {
  // 1. Сначала пробуем получить общий серверный журнал со всех устройств
  try {
    const res = await fetch("api/log.php", { cache: "no-store" });
    if (res.ok) {
      const serverData = await res.json();
      if (Array.isArray(serverData) && serverData.length > 0) {
        return serverData;
      }
    }
  } catch {}

  // 2. Резервный вариант (локальный браузерный лог)
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_LOG_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function formatDate(isoStr) {
  if (!isoStr) return "—";
  try {
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
  } catch {
    return "—";
  }
}

// Рендер дашборда

async function renderAnalyticsDashboard() {
  const log = await loadLog();

  // 1. KPI карточки
  const totalEl = document.getElementById("kpiTotal");
  const uniqueEl = document.getElementById("kpiUnique");
  const firstEl = document.getElementById("kpiFirst");
  const lastEl = document.getElementById("kpiLast");

  if (totalEl) totalEl.textContent = log.length;

  const uniqueSet = new Set(
    log.map((entry) => `${entry.size}_${entry.color_brick}_${entry.layout}_${entry.color_rastvor}`)
  );
  if (uniqueEl) uniqueEl.textContent = uniqueSet.size;

  if (firstEl) firstEl.textContent = log.length > 0 ? formatDate(log[0].timestamp) : "—";
  if (lastEl) lastEl.textContent = log.length > 0 ? formatDate(log[log.length - 1].timestamp) : "—";

  // 2. Живые цены на продукцию завода
  renderLivePrices();

  // 3. Аналитика популярности цветов
  renderColorAnalytics(log);

  // 4. Популярность размеров
  renderSizeAnalytics(log);

  // 5. Популярность видов кладки
  renderLayoutAnalytics(log);

  // 6. Таблица последних 50 просмотров
  renderLogTable(log);
}

function renderLivePrices() {
  const container = document.getElementById("livePricesList");
  if (!container) return;

  const items = [
    { size: "250x120x65", color: "gray" },
    { size: "250x120x88", color: "gray" },
    { size: "250x120x88", color: "gray2" },
    { size: "250x120x88", color: "peach" },
    { size: "250x120x88", color: "pink" },
    { size: "250x120x88", color: "beige" },
    { size: "250x120x88", color: "cream" },
  ];

  container.innerHTML = items
    .map((it) => {
      const prod = getProductData(it.size, it.color);
      const price = getBrickPrice(it.size, it.color);
      const hex = COLOR_HEX[it.color] || "#ccc";
      return `
        <div class="analytics-price-card">
          <div class="analytics-price-card__swatch" style="background: ${hex};"></div>
          <div class="analytics-price-card__info">
            <div class="analytics-price-card__title">${prod?.shortTitle || prod?.name || it.color}</div>
            <div class="analytics-price-card__articul">${prod?.articul || ""}</div>
          </div>
          <div class="analytics-price-card__price">${price.toFixed(2)} ₽</div>
        </div>
      `;
    })
    .join("");
}

function renderColorAnalytics(log) {
  const container = document.getElementById("colorsAnalytics");
  if (!container) return;

  const total = log.length;
  if (total === 0) {
    container.innerHTML = '<div class="analytics-empty">Нет данных о просмотрах</div>';
    return;
  }

  const counts = {};
  Object.keys(COLOR_NAMES).forEach((c) => (counts[c] = 0));
  log.forEach((entry) => {
    const c = entry.color_brick || "gray";
    counts[c] = (counts[c] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  container.innerHTML = sorted
    .map(([color, count]) => {
      const pct = Math.round((count / total) * 100);
      const name = COLOR_NAMES[color] || color;
      const hex = COLOR_HEX[color] || "#ccc";
      return `
        <div class="analytics-bar-item">
          <div class="analytics-bar-label">
            <span class="analytics-bar-swatch" style="background:${hex};"></span>
            <span class="analytics-bar-name">${name}</span>
            <span class="analytics-bar-count">${count} (${pct}%)</span>
          </div>
          <div class="analytics-bar-track">
            <div class="analytics-bar-fill" style="width: ${pct}%; background: ${hex};"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSizeAnalytics(log) {
  const container = document.getElementById("sizesAnalytics");
  if (!container) return;

  const total = log.length;
  if (total === 0) {
    container.innerHTML = '<div class="analytics-empty">Нет данных</div>';
    return;
  }

  const counts = { "250x120x65": 0, "250x120x88": 0 };
  log.forEach((entry) => {
    const s = entry.size || "250x120x88";
    counts[s] = (counts[s] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  container.innerHTML = sorted
    .map(([size, count]) => {
      const pct = Math.round((count / total) * 100);
      const name = SIZE_NAMES[size] || size;
      return `
        <div class="analytics-bar-item">
          <div class="analytics-bar-label">
            <span class="analytics-bar-name">${name}</span>
            <span class="analytics-bar-count">${count} (${pct}%)</span>
          </div>
          <div class="analytics-bar-track">
            <div class="analytics-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderLayoutAnalytics(log) {
  const container = document.getElementById("layoutsAnalytics");
  if (!container) return;

  const total = log.length;
  if (total === 0) {
    container.innerHTML = '<div class="analytics-empty">Нет данных</div>';
    return;
  }

  const counts = {};
  log.forEach((entry) => {
    const l = entry.layout || "classic";
    counts[l] = (counts[l] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  container.innerHTML = sorted
    .map(([layout, count]) => {
      const pct = Math.round((count / total) * 100);
      const name = LAYOUT_NAMES[layout] || layout;
      return `
        <div class="analytics-bar-item">
          <div class="analytics-bar-label">
            <span class="analytics-bar-name">${name}</span>
            <span class="analytics-bar-count">${count} (${pct}%)</span>
          </div>
          <div class="analytics-bar-track">
            <div class="analytics-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderLogTable(log) {
  const tbody = document.getElementById("logTableBody");
  if (!tbody) return;

  if (log.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="admin-table-empty">Журнал просмотров пока пуст. Зайдите в конструктор и настройте кирпич!</td></tr>';
    return;
  }

  const recent = [...log].reverse().slice(0, 50);

  tbody.innerHTML = recent
    .map((item, idx) => {
      const hex = COLOR_HEX[item.color_brick] || "#ccc";
      const colorTitle = COLOR_NAMES[item.color_brick] || item.color_brick || "—";
      const sizeTitle = SIZE_NAMES[item.size] || item.size || "—";
      const layoutTitle = LAYOUT_NAMES[item.layout] || item.layout || "—";
      const dateStr = formatDate(item.timestamp);
      const rastvorStr = RASTVOR_NAMES[item.color_rastvor] || item.color_rastvor || "—";

      return `
        <tr>
          <td>${idx + 1}</td>
          <td><span class="admin-table__date">${dateStr}</span></td>
          <td>
            <span class="admin-table__color-chip">
              <span class="admin-table__swatch" style="background:${hex};"></span>
              ${colorTitle}
            </span>
          </td>
          <td>${sizeTitle}</td>
          <td>${layoutTitle}</td>
          <td>${rastvorStr}</td>
        </tr>
      `;
    })
    .join("");
}

// Экспорт в CSV (для excel с поддержкой кириллицы)

async function exportCsv() {
  const log = await loadLog();
  if (log.length === 0) {
    alert("Журнал просмотров пуст. Пока нечего экспортировать.");
    return;
  }

  const headers = ["№", "Дата и время", "Цвет кирпича", "Размер", "Вид кладки", "Цвет раствора", "Источник"];
  const rows = log.map((item, i) => [
    i + 1,
    `"${formatDate(item.timestamp)}"`,
    `"${COLOR_NAMES[item.color_brick] || item.color_brick || ""}"`,
    `"${SIZE_NAMES[item.size] || item.size || ""}"`,
    `"${LAYOUT_NAMES[item.layout] || item.layout || ""}"`,
    `"${RASTVOR_NAMES[item.color_rastvor] || item.color_rastvor || ""}"`,
    `"${item.trigger || ""}"`,
  ]);

  const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `chzsk_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function resetStats() {
  if (confirm("Вы действительно хотите полностью очистить журнал аналитики просмотров? Это действие необратимо.")) {
    localStorage.removeItem(STORAGE_LOG_KEY);
    try {
      await fetch("api/log.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
    } catch {}
    await renderAnalyticsDashboard();
  }
}

// Инициализация страницы

function init() {
  const authSection = document.getElementById("authSection");
  const dashboardSection = document.getElementById("dashboardSection");
  const authForm = document.getElementById("authForm");
  const pinInput = document.getElementById("pinInput");
  const authError = document.getElementById("authError");
  const logoutBtn = document.getElementById("logoutBtn");
  const exportBtn = document.getElementById("exportCsvBtn");
  const resetBtn = document.getElementById("resetStatsBtn");

  function showDashboard() {
    if (authSection) authSection.hidden = true;
    if (dashboardSection) dashboardSection.hidden = false;
    renderAnalyticsDashboard();
  }

  function showAuth() {
    if (dashboardSection) dashboardSection.hidden = true;
    if (authSection) authSection.hidden = false;
    if (pinInput) {
      pinInput.value = "";
      pinInput.focus();
    }
  }

  // Проверяем текущее состояние авторизации
  if (isAuthenticated()) {
    showDashboard();
  } else {
    showAuth();
  }

  // Обработка формы входа
  if (authForm) {
    authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (authError) authError.hidden = true;

      const entered = (pinInput?.value || "").trim();
      const expected = await getExpectedPassword();

      if (entered === expected) {
        setAuthenticated(true);
        showDashboard();
      } else {
        if (authError) authError.hidden = false;
        if (pinInput) {
          pinInput.select();
          pinInput.focus();
        }
      }
    });
  }

  // Выход
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      setAuthenticated(false);
      showAuth();
    });
  }

  // Кнопки тулбара
  if (exportBtn) exportBtn.addEventListener("click", exportCsv);
  if (resetBtn) resetBtn.addEventListener("click", resetStats);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
