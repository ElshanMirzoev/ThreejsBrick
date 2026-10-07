// js/mosaic.js
import {
  createBrickCanvas,
  applyZoneMosaic,
  resetZoneMosaic,
  getCurrentBrickParams,
} from "./main.js";
import { render2DWall } from "./view2d.js";

// ================= ЦВЕТА СИЛИКАТНОГО КИРПИЧА ЧЗСК =================
export const CHZSK_COLORS = [
  { key: "gray",  name: "Серо-голубой",      hex: "#a8b0b8" },
  { key: "gray2", name: "Тёмно-серый",       hex: "#8f9ba5" },
  { key: "pink",  name: "Розово-персиковый", hex: "#e8a89a" },
  { key: "peach", name: "Персиковый",        hex: "#f0b8a0" },
  { key: "beige", name: "Бежево-кремовый",   hex: "#e8d4a8" },
  { key: "cream", name: "Кремово-белый",     hex: "#f0e8d8" },
];

export const COLOR_MAP = new Map(CHZSK_COLORS.map((c) => [c.key, c]));

const STORAGE_KEY = "threejsbrick_mosaic_config";

// ================= СОСТОЯНИЕ МОДУЛЯ =================
// Мозаика применяется ко всем кирпичным стенам единообразно
const mosaicConfig = {
  mix: { gray2: 45, gray: 35, peach: 20 },
  isMonochrome: false,
};

// Загрузка состояния из localStorage
function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (parsed.mix) mosaicConfig.mix = parsed.mix;
        if (parsed.isMonochrome !== undefined) mosaicConfig.isMonochrome = parsed.isMonochrome;
        // Обратная совместимость с предыдущей структурой zoneConfigs
        if (parsed.zoneConfigs && parsed.zoneConfigs.all) {
          mosaicConfig.mix = parsed.zoneConfigs.all.mix || mosaicConfig.mix;
          mosaicConfig.isMonochrome = parsed.zoneConfigs.all.isMonochrome;
        }
      }
    }
  } catch (e) {
    console.warn("[Mosaic] Ошибка чтения из localStorage:", e);
  }
}

// Сохранение состояния в localStorage
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mosaicConfig));
  } catch (e) {
    console.warn("[Mosaic] Ошибка сохранения в localStorage:", e);
  }
}

// ================= ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =================
/**
 * Нормализация пропорций выбранных цветов до строго 100%
 */
function normalizeMix(mix) {
  const keys = Object.keys(mix).filter((k) => mix[k] > 0);
  if (keys.length === 0) return {};
  if (keys.length === 1) {
    return { [keys[0]]: 100 };
  }

  const sum = keys.reduce((acc, k) => acc + (Number(mix[k]) || 0), 0);
  if (sum === 0) {
    const eq = Math.floor(100 / keys.length);
    const res = {};
    keys.forEach((k, idx) => {
      res[k] = idx === 0 ? 100 - eq * (keys.length - 1) : eq;
    });
    return res;
  }

  // Пропорциональное приведение к 100
  const normalized = {};
  let runningTotal = 0;
  keys.forEach((k, idx) => {
    if (idx === keys.length - 1) {
      normalized[k] = Math.max(1, 100 - runningTotal);
    } else {
      const val = Math.max(1, Math.round(((Number(mix[k]) || 0) / sum) * 100));
      normalized[k] = val;
      runningTotal += val;
    }
  });

  return normalized;
}

/**
 * Пропорциональное перераспределение при движении слайдера
 */
function adjustMixBySlider(mix, changedKey, newVal) {
  newVal = Math.max(1, Math.min(99, Math.round(newVal)));
  const keys = Object.keys(mix).filter((k) => mix[k] > 0);
  if (keys.length <= 1) {
    return { [changedKey]: 100 };
  }

  const otherKeys = keys.filter((k) => k !== changedKey);
  const remainingTarget = 100 - newVal;
  const currentOtherSum = otherKeys.reduce((acc, k) => acc + (mix[k] || 0), 0);

  const updated = { ...mix, [changedKey]: newVal };

  if (currentOtherSum <= 0) {
    const equalShare = Math.floor(remainingTarget / otherKeys.length);
    let assigned = 0;
    otherKeys.forEach((k, idx) => {
      if (idx === otherKeys.length - 1) {
        updated[k] = Math.max(1, remainingTarget - assigned);
      } else {
        updated[k] = Math.max(1, equalShare);
        assigned += updated[k];
      }
    });
  } else {
    let assigned = 0;
    otherKeys.forEach((k, idx) => {
      if (idx === otherKeys.length - 1) {
        updated[k] = Math.max(1, remainingTarget - assigned);
      } else {
        const share = Math.max(
          1,
          Math.round(((mix[k] || 0) / currentOtherSum) * remainingTarget)
        );
        updated[k] = share;
        assigned += share;
      }
    });
  }

  return normalizeMix(updated);
}

/**
 * Преобразование mix { gray2: 45, gray: 35 } в массив [{ color: '#8f9ba5', ratio: 0.45 }, ...]
 */
function mixToMosaicColors(mix) {
  const keys = Object.keys(mix).filter((k) => mix[k] > 0);
  if (keys.length === 0) return null;
  return keys.map((k) => ({
    color: COLOR_MAP.get(k)?.hex || "#8f9ba5",
    ratio: (mix[k] || 0) / 100,
  }));
}

// ================= DOM ЭЛЕМЕНТЫ =================
let modalEl = null;
let openBtn = null;
let colorsListWrap = null;
let previewCanvas = null;
let previewInfo = null;
let applyBtn = null;
let resetBtn = null;
let statusHint = null;

// ================= ОТРИСОВКА ИНТЕРФЕЙСА =================
function renderColorsUI() {
  if (!colorsListWrap) return;
  const mix = mosaicConfig.mix || {};
  const activeKeys = Object.keys(mix).filter((k) => mix[k] > 0);
  const showSliders = activeKeys.length >= 2;

  colorsListWrap.innerHTML = "";

  CHZSK_COLORS.forEach((colorItem) => {
    const isChecked = Boolean(mix[colorItem.key] && mix[colorItem.key] > 0);
    const pct = isChecked ? mix[colorItem.key] : 0;

    const row = document.createElement("div");
    row.className = `mosaic-color-row ${isChecked ? "active" : ""}`;

    // Левая часть: чекбокс + цветной образец + название
    const head = document.createElement("div");
    head.className = "mosaic-color-head";

    const label = document.createElement("label");
    label.className = "mosaic-color-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isChecked;
    checkbox.className = "mosaic-color-checkbox";
    checkbox.dataset.colorKey = colorItem.key;

    const swatch = document.createElement("span");
    swatch.className = "mosaic-color-swatch";
    swatch.style.backgroundColor = colorItem.hex;

    const nameSpan = document.createElement("span");
    nameSpan.className = "mosaic-color-name";
    nameSpan.textContent = colorItem.name;

    label.appendChild(checkbox);
    label.appendChild(swatch);
    label.appendChild(nameSpan);
    head.appendChild(label);

    // Правая часть: бейдж процентовки
    if (isChecked) {
      const badge = document.createElement("span");
      badge.className = "mosaic-pct-badge";
      badge.textContent = `${pct}%`;
      head.appendChild(badge);
    }

    row.appendChild(head);

    // Ползунок (появляется при выборе 2 и более цветов)
    if (isChecked && showSliders) {
      const sliderRow = document.createElement("div");
      sliderRow.className = "mosaic-slider-row";

      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "1";
      slider.max = "99";
      slider.value = pct;
      slider.className = "mosaic-color-slider";
      slider.dataset.colorKey = colorItem.key;

      slider.addEventListener("input", (e) => {
        const val = Number(e.target.value);
        mosaicConfig.mix = adjustMixBySlider(mosaicConfig.mix, colorItem.key, val);
        saveState();
        renderColorsUI();
        drawPreview();
      });

      sliderRow.appendChild(slider);
      row.appendChild(sliderRow);
    }

    // Обработчик клика по чекбоксу
    checkbox.addEventListener("change", (e) => {
      const checked = e.target.checked;
      const curMix = { ...(mosaicConfig.mix || {}) };

      if (checked) {
        // Добавляем цвет
        const currentActive = Object.keys(curMix).filter((k) => curMix[k] > 0);
        if (currentActive.length === 0) {
          curMix[colorItem.key] = 100;
        } else {
          curMix[colorItem.key] = 20;
          mosaicConfig.mix = normalizeMix(curMix);
        }
      } else {
        // Удаляем цвет
        const currentActive = Object.keys(curMix).filter((k) => curMix[k] > 0);
        if (currentActive.length <= 1) {
          // Не разрешаем снять последний цвет
          e.target.checked = true;
          return;
        }
        delete curMix[colorItem.key];
        mosaicConfig.mix = normalizeMix(curMix);
      }

      mosaicConfig.isMonochrome = false;
      saveState();
      renderColorsUI();
      drawPreview();
    });

    colorsListWrap.appendChild(row);
  });
}

// ================= ОТРИСОВКА ПРЕВЬЮ В МОДАЛКЕ =================
function drawPreview() {
  if (!previewCanvas) return;
  const ctx = previewCanvas.getContext("2d");
  const w = previewCanvas.width;
  const h = previewCanvas.height;

  ctx.clearRect(0, 0, w, h);

  const mix = mosaicConfig.mix || {};
  const activeKeys = Object.keys(mix).filter((k) => mix[k] > 0);
  const mosaicColors = mixToMosaicColors(mix);
  const brickParams = getCurrentBrickParams ? getCurrentBrickParams() : {};

  const fullCanvas = createBrickCanvas({
    brickColor: mosaicColors?.[0]?.color || "#8f9ba5",
    mortarColor: brickParams.mortarColor || "#0B0B0B",
    layout: brickParams.layout || "running",
    brickPixelSize: brickParams.brickPixelSize || [120, 32],
    jointThickness: 4,
    mosaicColors: mosaicColors,
  });

  // Отрисовываем фрагмент процедурного канваса в мини-превью
  ctx.drawImage(fullCanvas, 0, 0, fullCanvas.width, fullCanvas.height, 0, 0, w, h);

  // Описание
  if (previewInfo) {
    if (mosaicColors && mosaicColors.length > 1) {
      const desc = activeKeys
        .map((k) => `${COLOR_MAP.get(k)?.name || k} ${mix[k]}%`)
        .join(" + ");
      previewInfo.textContent = `Мозаика (${activeKeys.length} цв.): ${desc}`;
    } else {
      const singleKey = activeKeys[0] || "gray";
      previewInfo.textContent = `Обычный: ${COLOR_MAP.get(singleKey)?.name || singleKey} 100%`;
    }
  }
}

// ================= ПРИМЕНЕНИЕ И СБРОС =================
function handleApply() {
  if (statusHint) {
    statusHint.textContent = "Применение...";
    statusHint.className = "mosaic-status-hint info";
  }

  const mix = mosaicConfig.mix || {};
  const mosaicColors = mixToMosaicColors(mix);

  const options = {
    mosaicColors: mosaicColors && mosaicColors.length > 1 ? mosaicColors : null,
    brickColor: mosaicColors?.[0]?.color || "#8f9ba5",
  };

  applyZoneMosaic("all", options);
  saveState();

  // Если открыт 2D-просмотр — перерисовываем плоскую стену с выбранной мозаикой
  const card2D = document.getElementById("card2D");
  const card3D = document.getElementById("card3D");
  const is2DActive = card2D && window.getComputedStyle(card2D).display !== "none";

  if (is2DActive && typeof render2DWall === "function") {
    render2DWall();
  }

  // Закрываем окно мозаики сразу после нажатия «Применить к модели»
  closeMosaicModal();

  // Плавный скролл к активному просмотрщику
  const activeViewer = is2DActive ? card2D : (card3D || document.getElementById("config-panel"));
  activeViewer?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleResetMonochrome() {
  // Сброс кирпича в обычный серо-голубой
  mosaicConfig.mix = { gray: 100 };
  mosaicConfig.isMonochrome = true;

  resetZoneMosaic("all");

  renderColorsUI();
  drawPreview();

  // Если открыт 2D-просмотр — перерисовываем плоскую стену
  const card2D = document.getElementById("card2D");
  const is2DActive = card2D && window.getComputedStyle(card2D).display !== "none";
  if (is2DActive && typeof render2DWall === "function") {
    render2DWall();
  }

  if (statusHint) {
    statusHint.textContent = "Сброшено в классический кирпич";
    statusHint.className = "mosaic-status-hint info";
  }

  saveState();
}

// ================= ОТКРЫТИЕ И ЗАКРЫТИЕ МОДАЛКИ =================
export function openMosaicModal() {
  const currentSize = document.querySelector('input[name="size"]:checked')?.value;
  if (currentSize === "250x120x65") {
    return;
  }

  if (!modalEl) modalEl = document.getElementById("mosaicModal");
  if (!modalEl) return;

  loadSavedState();
  renderColorsUI();
  drawPreview();

  modalEl.hidden = false;
  document.body.classList.add("modal-open");
  if (statusHint) statusHint.textContent = "";
}

export function closeMosaicModal() {
  if (!modalEl) modalEl = document.getElementById("mosaicModal");
  if (!modalEl) return;

  modalEl.hidden = true;
  document.body.classList.remove("modal-open");
}

// ================= ИНИЦИАЛИЗАЦИЯ МОДУЛЯ =================
export function initMosaicModule() {
  openBtn = document.getElementById("mosaicBtn");
  modalEl = document.getElementById("mosaicModal");

  if (!openBtn || !modalEl) {
    console.warn("[Mosaic] Кнопка или модальное окно не найдены в DOM");
    return;
  }

  colorsListWrap = document.getElementById("mosaicColorsList");
  previewCanvas = document.getElementById("mosaicPreviewCanvas");
  previewInfo = document.getElementById("mosaicPreviewInfo");
  applyBtn = document.getElementById("mosaicApplyBtn");
  resetBtn = document.getElementById("mosaicResetMonochromeBtn");
  statusHint = document.getElementById("mosaicStatus");

  loadSavedState();

  // Открытие модалки
  openBtn.addEventListener("click", openMosaicModal);

  // Закрытие модалки
  modalEl.querySelectorAll("[data-close-mosaic]").forEach((el) => {
    el.addEventListener("click", closeMosaicModal);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalEl && !modalEl.hidden) {
      closeMosaicModal();
    }
  });

  // Кнопки действий
  if (applyBtn) applyBtn.addEventListener("click", handleApply);
  if (resetBtn) resetBtn.addEventListener("click", handleResetMonochrome);

  console.log("[Mosaic] Модуль «Мозаика» инициализирован");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMosaicModule);
} else {
  initMosaicModule();
}
