// js/calc.js
// Ориентировочный калькулятор расхода силикатного кирпича ЧЗСК
// Упрощенный, понятный для клиента расчет по нормам СП 15.13330 и silicatbrick.ru

import { getBrickPrice, getProductData, onPricesUpdated } from "./prices.js";
import {
  CHZSK_COLORS,
  COLOR_MAP,
  getMosaicConfig,
  normalizeMix,
  adjustMixBySlider,
} from "./mosaic.js";
import { addItem, formatPrice } from "./cart.js";

// Строительные константы и нормы

export const BRICK_SPECS = {
  "250x120x88": {
    name: "Утолщенный (полуторный) 250×120×88",
    shortName: "250×120×88",
    supportsMosaic: true,
  },
  "250x120x65": {
    name: "Одинарный 250×120×65",
    shortName: "250×120×65",
    supportsMosaic: false, // одинарный у ЧЗСК выпускается только серым рядовым
  },
};

// Нормативы расхода кирпича (шт. на 1 м² стены со стандартным кладочным швом)
export const MASONRY_TYPES = {
  half: {
    id: "half",
    name: "0.5 кирпича (120 мм)",
    rates: {
      "250x120x88": 39, // шт./м²
      "250x120x65": 51,
    },
  },
  one: {
    id: "one",
    name: "1.0 кирпич (250 мм)",
    rates: {
      "250x120x88": 78,
      "250x120x65": 102,
    },
  },
  one_and_half: {
    id: "one_and_half",
    name: "1.5 кирпича (380 мм)",
    rates: {
      "250x120x88": 117,
      "250x120x65": 153,
    },
  },
  two: {
    id: "two",
    name: "2.0 кирпича (510 мм)",
    rates: {
      "250x120x88": 156,
      "250x120x65": 204,
    },
  },
  two_and_half: {
    id: "two_and_half",
    name: "2.5 кирпича (640 мм)",
    rates: {
      "250x120x88": 195,
      "250x120x65": 255,
    },
  },
};

// Состояние калькулятора
const calcState = {
  // Режим ввода геометрии: 'perimeter' | 'dimensions' | 'area'
  inputMode: "perimeter",

  // 1. По периметру:
  perimeter: 40,      // метры
  wallHeight: 3,      // метры
  floorsCount: 1,     // число этажей

  // 2. По длине и ширине:
  wallLength: 10,     // метры
  wallWidth: 10,      // метры
  dimHeight: 3,       // метры
  dimFloors: 1,       // число этажей

  // 3. По площади напрямую:
  directArea: 120,    // м²

  // Параметры кладки
  masonryType: "half",    // 'half' (0.5 кирпича) по умолчанию
  brickSize: "250x120x88",// '250x120x88' | '250x120x65'
  wastePercent: 5,        // запас на бой и подрезку (5% стандарт)

  // Цвет и Проект-Мозаика
  colorMode: "mosaic",    // 'mosaic' | 'single'
  singleColor: "gray",    // при одном цвете
  mosaicMix: {
    gray2: 45,            // «Графит»
    gray: 35,             // Рядовой
    peach: 20,            // «Оранжевый»
  },
};

// Расчет сметы

export function calculateEstimate(state = calcState) {
  // 1. Расчет площади стен
  let wallArea = 0;

  if (state.inputMode === "perimeter") {
    const p = Math.max(0.1, Number(state.perimeter) || 0);
    const h = Math.max(0.1, Number(state.wallHeight) || 3);
    const fl = Math.max(1, parseInt(state.floorsCount, 10) || 1);
    wallArea = p * h * fl;
  } else if (state.inputMode === "dimensions") {
    const l = Math.max(0.1, Number(state.wallLength) || 0);
    const w = Math.max(0.1, Number(state.wallWidth) || 0);
    const h = Math.max(0.1, Number(state.dimHeight) || 3);
    const fl = Math.max(1, parseInt(state.dimFloors, 10) || 1);
    wallArea = 2 * (l + w) * h * fl;
  } else if (state.inputMode === "area") {
    wallArea = Math.max(0.1, Number(state.directArea) || 0);
  }

  // 2. Расход кирпича на м²
  const masonry = MASONRY_TYPES[state.masonryType] || MASONRY_TYPES.half;
  const sizeKey = state.brickSize === "250x120x65" ? "250x120x65" : "250x120x88";
  const spec = BRICK_SPECS[sizeKey];
  const ratePerM2 = masonry.rates[sizeKey] || 39;

  // Базовое число кирпичей
  const baseBricksCount = Math.round(wallArea * ratePerM2);

  // С учетом запаса на бой и подрезку
  const wastePct = Math.max(0, Number(state.wastePercent) || 0);
  const totalBricksCount = Math.ceil(baseBricksCount * (1 + wastePct / 100));

  // 3. Распределение по цветам (Мозаика или Монохром)
  const isMosaic = state.colorMode === "mosaic" && spec.supportsMosaic;
  const colorItems = [];
  let totalCost = 0;

  if (isMosaic) {
    const normMix = normalizeMix(state.mosaicMix || {});
    const activeKeys = Object.keys(normMix).filter((k) => normMix[k] > 0);

    if (activeKeys.length === 0) {
      activeKeys.push("gray");
      normMix.gray = 100;
    }

    // Сохранение точной суммы при округлении до целых штук
    let assignedBricks = 0;
    let maxKey = activeKeys[0];
    let maxShare = -1;

    const preliminary = activeKeys.map((key) => {
      const share = normMix[key] || 0;
      if (share > maxShare) {
        maxShare = share;
        maxKey = key;
      }
      const count = Math.round((totalBricksCount * share) / 100);
      assignedBricks += count;
      return { key, share, count };
    });

    const diff = totalBricksCount - assignedBricks;
    preliminary.forEach((item) => {
      if (item.key === maxKey) item.count += diff;
    });

    preliminary.forEach(({ key, share, count }) => {
      const colorData = COLOR_MAP.get(key) || { name: key, hex: "#a8b0b8" };
      const price = getBrickPrice(sizeKey, key);
      const prod = getProductData(sizeKey, key);
      const cost = Math.round(count * price * 100) / 100;
      totalCost += cost;

      colorItems.push({
        key,
        name: colorData.name,
        hex: colorData.hex,
        officialName: prod?.name || `Кирпич силикатный ${colorData.name}`,
        imageUrl: prod?.imageUrl || "",
        sharePercent: share,
        count,
        unitPrice: price,
        cost,
      });
    });
  } else {
    // Монохром (один цвет)
    const effectiveColor = sizeKey === "250x120x65" ? "gray" : (state.singleColor || "gray");
    const defaultGrayName = sizeKey === "250x120x65" ? "Рядовой (полнотелый)" : "Рядовой (пустотелый)";
    const colorData = effectiveColor === "gray"
      ? { name: defaultGrayName, hex: "#a8b0b8" }
      : (COLOR_MAP.get(effectiveColor) || { name: defaultGrayName, hex: "#a8b0b8" });
    const price = getBrickPrice(sizeKey, effectiveColor);
    const prod = getProductData(sizeKey, effectiveColor);
    const cost = Math.round(totalBricksCount * price * 100) / 100;
    totalCost = cost;

    colorItems.push({
      key: effectiveColor,
      name: colorData.name,
      hex: colorData.hex,
      officialName: prod?.name || `Кирпич силикатный ${colorData.name}`,
      imageUrl: prod?.imageUrl || "",
      sharePercent: 100,
      count: totalBricksCount,
      unitPrice: price,
      cost,
    });
  }

  return {
    wallArea: Math.round(wallArea * 100) / 100,
    baseBricksCount,
    totalBricksCount,
    totalCost: Math.round(totalCost * 100) / 100,
    colorItems,
    isMosaic,
    brickSpec: spec,
    masonrySpec: masonry,
  };
}

// DOM и обработчики
let modalEl = null;
let calcBtn = null;

export function initCalculator() {
  calcBtn = document.getElementById("calcBtn");
  modalEl = document.getElementById("calcModal");

  if (!modalEl) return;

  syncWithCurrentMosaic();

  if (calcBtn) {
    calcBtn.addEventListener("click", openCalculatorModal);
  }

  modalEl.querySelectorAll("[data-close-calc]").forEach((el) => {
    el.addEventListener("click", closeCalculatorModal);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalEl && !modalEl.hidden) {
      closeCalculatorModal();
    }
  });

  bindCalcEvents();
  renderCalcUI();

  onPricesUpdated(() => {
    if (modalEl && !modalEl.hidden) {
      renderCalcUI();
    }
  });

  console.log("[Calc] Калькулятор инициализирован");
}

function syncWithCurrentMosaic() {
  try {
    const curMosaic = getMosaicConfig();
    if (curMosaic && curMosaic.mix && Object.keys(curMosaic.mix).length > 0) {
      calcState.mosaicMix = { ...curMosaic.mix };
      calcState.colorMode = curMosaic.isMonochrome ? "single" : "mosaic";
    }
  } catch (e) {}

  const curSizeRadio = document.querySelector('input[name="size"]:checked');
  if (curSizeRadio) {
    calcState.brickSize = curSizeRadio.value;
  }

  const curColorRadio = document.querySelector('input[name="color_brick"]:checked');
  if (curColorRadio) {
    calcState.singleColor = curColorRadio.value;
  }
}

export function openCalculatorModal() {
  if (!modalEl) modalEl = document.getElementById("calcModal");
  if (!modalEl) return;

  syncWithCurrentMosaic();
  renderCalcUI();

  modalEl.hidden = false;
  document.body.classList.add("modal-open");
}

export function closeCalculatorModal() {
  if (!modalEl) modalEl = document.getElementById("calcModal");
  if (!modalEl) return;

  modalEl.hidden = true;
  document.body.classList.remove("modal-open");
}

function bindCalcEvents() {
  if (!modalEl) return;

  // Табы режима ввода геометрии
  modalEl.querySelectorAll(".calc-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      calcState.inputMode = btn.dataset.mode;
      renderCalcUI();
    });
  });

  // Числовые инпуты геометрии
  const bindNumInput = (id, key, isFloat = true) => {
    const el = modalEl.querySelector(`#${id}`);
    if (el) {
      el.addEventListener("input", (e) => {
        const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
        calcState[key] = isNaN(val) ? 0 : val;
        updateEstimateResults();
      });
    }
  };

  // Режим 1: Периметр
  bindNumInput("calcPerimeter", "perimeter");
  bindNumInput("calcHeight", "wallHeight");
  bindNumInput("calcFloors", "floorsCount", false);

  // Режим 2: Длина и ширина
  bindNumInput("calcLength", "wallLength");
  bindNumInput("calcWidth", "wallWidth");
  bindNumInput("calcDimHeight", "dimHeight");
  bindNumInput("calcDimFloors", "dimFloors", false);

  // Режим 3: Готовая площадь
  bindNumInput("calcDirectArea", "directArea");

  // Выпадающее меню: Способ кладки
  const masonrySel = modalEl.querySelector("#calcMasonrySelect");
  if (masonrySel) {
    masonrySel.addEventListener("change", (e) => {
      calcState.masonryType = e.target.value;
      updateEstimateResults();
    });
  }

  // Размер кирпича
  modalEl.querySelectorAll('input[name="calc_size"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      calcState.brickSize = e.target.value;
      renderCalcUI();
    });
  });

  // Запас на бой и подрезку
  const wasteSelect = modalEl.querySelector("#calcWasteSelect");
  if (wasteSelect) {
    wasteSelect.addEventListener("change", (e) => {
      calcState.wastePercent = parseFloat(e.target.value) || 0;
      updateEstimateResults();
    });
  }

  // Режим цвета: Мозаика vs Монохром
  modalEl.querySelectorAll('input[name="calc_color_mode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      calcState.colorMode = e.target.value;
      renderCalcUI();
    });
  });

  // Выбор одного цвета
  const singleColorSel = modalEl.querySelector("#calcSingleColor");
  if (singleColorSel) {
    singleColorSel.addEventListener("change", (e) => {
      calcState.singleColor = e.target.value;
      updateEstimateResults();
    });
  }

  // Быстрые пресеты дома
  modalEl.querySelectorAll(".calc-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyBuildingPreset(btn.dataset.preset);
    });
  });

  // Кнопка синхронизации из 3D
  const syncBtn = modalEl.querySelector("#calcSync3DBtn");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => {
      syncWithCurrentMosaic();
      renderCalcUI();
      showToast("Синхронизировано с параметрами 3D-модели");
    });
  }

  // Кнопка добавления в корзину
  const addToCartBtn = modalEl.querySelector("#calcAddToCartBtn");
  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", handleAddEstimateToCart);
  }
}

function applyBuildingPreset(preset) {
  if (preset === "cottage") {
    calcState.inputMode = "dimensions";
    calcState.wallLength = 10;
    calcState.wallWidth = 10;
    calcState.dimHeight = 3;
    calcState.dimFloors = 2;
  } else if (preset === "house8x10") {
    calcState.inputMode = "dimensions";
    calcState.wallLength = 10;
    calcState.wallWidth = 8;
    calcState.dimHeight = 3;
    calcState.dimFloors = 1;
  } else if (preset === "dacha6x6") {
    calcState.inputMode = "dimensions";
    calcState.wallLength = 6;
    calcState.wallWidth = 6;
    calcState.dimHeight = 2.8;
    calcState.dimFloors = 1;
  }
  renderCalcUI();
  showToast("Применены параметры пресета");
}

function handleAddEstimateToCart() {
  const estimate = calculateEstimate(calcState);
  if (!estimate.colorItems || estimate.colorItems.length === 0) return;

  const sizeKey = calcState.brickSize;
  let itemsCount = 0;

  estimate.colorItems.forEach((item) => {
    if (item.count > 0) {
      addItem(
        item.key,
        item.count,
        item.unitPrice,
        item.officialName,
        item.imageUrl,
        sizeKey
      );
      itemsCount += item.count;
    }
  });

  showToast(`🛒 Добавлено в корзину: ${itemsCount.toLocaleString("ru-RU")} шт. на ~${formatPrice(estimate.totalCost)}!`);

  setTimeout(() => {
    const cartBtn = document.getElementById("cartBtn");
    if (cartBtn) cartBtn.click();
  }, 400);
}

function showToast(text, type = "success") {
  const toast = document.createElement("div");
  toast.className = `calc-toast ${type}`;
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("visible"), 10);
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Рендер интерфейса

function renderCalcUI() {
  if (!modalEl) return;

  // 1. Табы режима геометрии
  modalEl.querySelectorAll(".calc-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === calcState.inputMode);
  });

  const perimeterGroup = modalEl.querySelector("#calcPerimeterGroup");
  const dimensionsGroup = modalEl.querySelector("#calcDimensionsGroup");
  const areaGroup = modalEl.querySelector("#calcAreaGroup");

  // Полная изоляция групп: показывается только выбранная группа
  if (perimeterGroup) {
    perimeterGroup.style.display = calcState.inputMode === "perimeter" ? "grid" : "none";
  }
  if (dimensionsGroup) {
    dimensionsGroup.style.display = calcState.inputMode === "dimensions" ? "grid" : "none";
  }
  if (areaGroup) {
    areaGroup.style.display = calcState.inputMode === "area" ? "grid" : "none";
  }

  // Значения инпутов
  const setVal = (id, val) => {
    const el = modalEl.querySelector(`#${id}`);
    if (el && document.activeElement !== el) el.value = val;
  };

  setVal("calcPerimeter", calcState.perimeter);
  setVal("calcHeight", calcState.wallHeight);
  setVal("calcFloors", calcState.floorsCount);

  setVal("calcLength", calcState.wallLength);
  setVal("calcWidth", calcState.wallWidth);
  setVal("calcDimHeight", calcState.dimHeight);
  setVal("calcDimFloors", calcState.dimFloors);

  setVal("calcDirectArea", calcState.directArea);

  // Способ кладки (выпадающее меню)
  const masonrySel = modalEl.querySelector("#calcMasonrySelect");
  if (masonrySel) masonrySel.value = calcState.masonryType;

  // Размер кирпича
  const sizeRadio = modalEl.querySelector(`input[name="calc_size"][value="${calcState.brickSize}"]`);
  if (sizeRadio) sizeRadio.checked = true;

  // Проверка мозаики для одинарного кирпича
  const is65 = calcState.brickSize === "250x120x65";
  const mosaicModeLabel = modalEl.querySelector("#calcMosaicModeRadioLabel");

  if (is65) {
    if (calcState.colorMode === "mosaic") {
      calcState.colorMode = "single";
    }
    if (mosaicModeLabel) {
      mosaicModeLabel.classList.add("disabled");
      mosaicModeLabel.title = "Мозаика доступна для утолщенного кирпича 250×120×88";
    }
  } else {
    if (mosaicModeLabel) {
      mosaicModeLabel.classList.remove("disabled");
      mosaicModeLabel.title = "";
    }
  }

  // Радио цвета
  const colorModeRadio = modalEl.querySelector(`input[name="calc_color_mode"][value="${calcState.colorMode}"]`);
  if (colorModeRadio) colorModeRadio.checked = true;

  // Запас
  const wasteSelect = modalEl.querySelector("#calcWasteSelect");
  if (wasteSelect) wasteSelect.value = String(calcState.wastePercent);

  // Рендер цветовых блоков
  renderColorsControls();
  updateEstimateResults();
}

function renderColorsControls() {
  const mosaicSection = modalEl.querySelector("#calcMosaicControls");
  const singleSection = modalEl.querySelector("#calcSingleControls");

  const isMosaic = calcState.colorMode === "mosaic" && calcState.brickSize !== "250x120x65";

  if (mosaicSection) mosaicSection.style.display = isMosaic ? "flex" : "none";
  if (singleSection) singleSection.style.display = isMosaic ? "none" : "block";

  if (isMosaic) {
    renderMosaicSliders();
  } else {
    renderSingleColorSelect();
  }
}

function renderMosaicSliders() {
  const wrap = modalEl.querySelector("#calcMosaicSlidersList");
  if (!wrap) return;

  const mix = calcState.mosaicMix || {};
  const activeKeys = Object.keys(mix).filter((k) => mix[k] > 0);
  const showSliders = activeKeys.length >= 2;

  wrap.innerHTML = "";

  CHZSK_COLORS.forEach((colorItem) => {
    const isChecked = Boolean(mix[colorItem.key] && mix[colorItem.key] > 0);
    const pct = isChecked ? mix[colorItem.key] : 0;
    const price = getBrickPrice(calcState.brickSize, colorItem.key);

    const row = document.createElement("div");
    row.className = `calc-color-row ${isChecked ? "active" : ""}`;

    const head = document.createElement("div");
    head.className = "calc-color-head";

    const label = document.createElement("label");
    label.className = "calc-color-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isChecked;
    checkbox.className = "calc-color-checkbox";

    const swatch = document.createElement("span");
    swatch.className = "calc-color-swatch";
    swatch.style.backgroundColor = colorItem.hex;

    const nameSpan = document.createElement("span");
    nameSpan.className = "calc-color-name";
    nameSpan.innerHTML = `<strong>${colorItem.name}</strong> <span class="calc-color-price">${price.toFixed(2)} ₽/шт.</span>`;

    label.appendChild(checkbox);
    label.appendChild(swatch);
    label.appendChild(nameSpan);
    head.appendChild(label);

    if (isChecked) {
      const badge = document.createElement("span");
      badge.className = "calc-pct-badge";
      badge.textContent = `${pct}%`;
      head.appendChild(badge);
    }

    row.appendChild(head);

    if (isChecked && showSliders) {
      const sliderRow = document.createElement("div");
      sliderRow.className = "calc-slider-row";

      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "1";
      slider.max = "99";
      slider.value = pct;
      slider.className = "calc-slider";

      slider.addEventListener("input", (e) => {
        const val = Number(e.target.value);
        calcState.mosaicMix = adjustMixBySlider(calcState.mosaicMix, colorItem.key, val);
        renderMosaicSliders();
        updateEstimateResults();
      });

      sliderRow.appendChild(slider);
      row.appendChild(sliderRow);
    }

    checkbox.addEventListener("change", (e) => {
      const checked = e.target.checked;
      const curMix = { ...(calcState.mosaicMix || {}) };

      if (checked) {
        const currentActive = Object.keys(curMix).filter((k) => curMix[k] > 0);
        if (currentActive.length === 0) {
          curMix[colorItem.key] = 100;
        } else {
          const newTotalCount = currentActive.length + 1;
          const equalShare = Math.floor(100 / newTotalCount);
          let assigned = 0;
          currentActive.forEach((k) => {
            curMix[k] = Math.max(1, equalShare);
            assigned += curMix[k];
          });
          curMix[colorItem.key] = Math.max(1, 100 - assigned);
        }
      } else {
        const currentActive = Object.keys(curMix).filter((k) => curMix[k] > 0);
        if (currentActive.length <= 1) {
          showToast("В кладке должен оставаться хотя бы один цвет", "warn");
          checkbox.checked = true;
          return;
        }
        delete curMix[colorItem.key];
      }

      calcState.mosaicMix = normalizeMix(curMix);
      renderMosaicSliders();
      updateEstimateResults();
    });

    wrap.appendChild(row);
  });
}

function renderSingleColorSelect() {
  const sel = modalEl.querySelector("#calcSingleColor");
  if (!sel) return;

  const is65 = calcState.brickSize === "250x120x65";

  if (is65) {
    sel.innerHTML = `<option value="gray">Рядовой (полнотелый)</option>`;
    sel.disabled = true;
  } else {
    sel.disabled = false;
    sel.innerHTML = CHZSK_COLORS.map((c) => {
      const p = getBrickPrice("250x120x88", c.key);
      const isSel = c.key === calcState.singleColor ? "selected" : "";
      return `<option value="${c.key}" ${isSel}>${c.name} — ${p.toFixed(2)} ₽/шт.</option>`;
    }).join("");
  }
}

function updateEstimateResults() {
  if (!modalEl) return;

  const estimate = calculateEstimate(calcState);

  const setTxt = (id, txt) => {
    const el = modalEl.querySelector(`#${id}`);
    if (el) el.textContent = txt;
  };

  // Ориентировочная цена со знаком "~"
  setTxt("resTotalCost", `~ ${formatPrice(estimate.totalCost)}`);
  setTxt("resWallArea", `${estimate.wallArea} м²`);
  setTxt("resTotalBricks", `${estimate.totalBricksCount.toLocaleString("ru-RU")} шт.`);

  renderVisualRatioBar(estimate.colorItems);
  renderEstimateTable(estimate);
}

function renderVisualRatioBar(colorItems) {
  const bar = modalEl.querySelector("#calcRatioBar");
  if (!bar) return;

  if (!colorItems || colorItems.length === 0) {
    bar.innerHTML = "";
    return;
  }

  bar.innerHTML = colorItems
    .map((item) => {
      return `
        <div class="calc-ratio-segment" style="width: ${item.sharePercent}%; background-color: ${item.hex};" title="${item.name}: ${item.sharePercent}% (${item.count.toLocaleString("ru-RU")} шт.)">
          <span class="calc-ratio-label">${item.sharePercent >= 12 ? `${item.sharePercent}%` : ""}</span>
        </div>
      `;
    })
    .join("");
}

function renderEstimateTable(estimate) {
  const tbody = modalEl.querySelector("#calcEstimateTableBody");
  if (!tbody) return;

  tbody.innerHTML = estimate.colorItems
    .map((item) => {
      return `
        <tr>
          <td>
            <div class="calc-tbl-color">
              <span class="calc-color-swatch-sm" style="background-color: ${item.hex};"></span>
              <div>
                <strong>${item.name}</strong>
              </div>
            </div>
          </td>
          <td><strong>${item.sharePercent}%</strong></td>
          <td>${item.count.toLocaleString("ru-RU")} шт.</td>
          <td>${item.unitPrice.toFixed(2)} ₽</td>
          <td><strong>~ ${formatPrice(item.cost)}</strong></td>
        </tr>
      `;
    })
    .join("");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCalculator);
} else {
  initCalculator();
}
