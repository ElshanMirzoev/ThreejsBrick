// js/view2d.js
import { createBrickCanvas, getActiveZoneTextures, applySelectionToLoadedModel } from './main.js';

// ============ DOM ============
const view2DBtn   = document.getElementById("view2DBtn");
const card3D      = document.getElementById("card3D");
const card2D      = document.getElementById("card2D");
const container2D = document.getElementById("container2D");
const resetBtn    = document.getElementById("resetBtn");
const statusEl    = document.getElementById("status");

// ============ Геттеры ============
const radiosSize         = () => Array.from(document.querySelectorAll('input[name="size"]'));
const radiosLayout       = () => Array.from(document.querySelectorAll('input[name="layout"]'));
const radiosColorBrick   = () => Array.from(document.querySelectorAll('input[name="color_brick"]'));
const radiosColorRastvor = () => Array.from(document.querySelectorAll('input[name="color_rastvor"]'));

function getCheckedValue(nodeList) {
  const n = nodeList.find((x) => x.checked);
  return n ? n.value : "";
}

// ============ Маппинг (СОГЛАСОВАНО с main.js!) ============
function mapBrickColor(tag) {
  switch (tag) {
    case "gray":   return "#a8b0b8";
    case "gray2":  return "#8f9ba5";
    case "pink":   return "#e8a89a";
    case "peach":  return "#f0b8a0";
    case "beige":  return "#e8d4a8";
    case "cream":  return "#f0e8d8";
    default:       return "#d4d4d4";
  }
}

function mapMortarColor(tag) {
  switch (tag) {
    case "black": return "#0B0B0B";
    case "white": return "#A7A7A7";
    default:      return "#ffffff";
  }
}

function mapBrickPixelSize(sizeTag) {
  switch (sizeTag) {
    case "250x120x88": return [120, 40];
    case "250x120x65": return [120, 32];
    default:           return [50, 20];
  }
}

function getOrCreate2DCanvas() {
  if (!container2D) return null;
  let canvas = container2D.querySelector("canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 2048;
    canvas.style.maxHeight = "100%";
    canvas.style.maxWidth = "100%";
    canvas.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
    canvas.style.borderRadius = "4px";
    container2D.innerHTML = "";
    container2D.appendChild(canvas);
  }
  return canvas;
}

// ============ Отрисовка 2D ============
export function render2DWall() {
  if (card3D) card3D.style.display = "none";
  if (card2D) card2D.style.display = "block";
  if (!container2D) return;

  const canvas = getOrCreate2DCanvas();
  if (!canvas) return;

  const activeZones = typeof getActiveZoneTextures === "function" ? getActiveZoneTextures() : {};
  const activeParams = activeZones.facade || activeZones.accent || null;

  // Радио-кнопки имеют абсолютный приоритет
  const checkedBrickKey = getCheckedValue(radiosColorBrick());
  const checkedBrickColor = mapBrickColor(checkedBrickKey);
  const checkedMortarColor = mapMortarColor(getCheckedValue(radiosColorRastvor()));
  const checkedLayout = getCheckedValue(radiosLayout()) || "running";
  const checkedSize = mapBrickPixelSize(getCheckedValue(radiosSize()));

  const params = {
    brickColor: checkedBrickColor,
    mortarColor: checkedMortarColor,
    layout: checkedLayout,
    brickPixelSize: checkedSize,
    jointThickness: 4,
  };

  // Мозаика накладывается только если активен мульти-цветовой микс (>1 цвета)
  if (activeParams && Array.isArray(activeParams.mosaicColors) && activeParams.mosaicColors.length > 1) {
    params.mosaicColors = activeParams.mosaicColors;
  }

  createBrickCanvas(params, canvas);
  if (statusEl) console.log("[2D] Плоская кладка обновлена без пересоздания канваса:", checkedBrickKey);
}

// ============ Инициализация ============
function init2DModule() {
  if (!view2DBtn) {
    console.warn("[2D] Кнопка #view2DBtn не найдена");
    return;
  }

  const allSelected = () =>
    !!getCheckedValue(radiosSize()) &&
    !!getCheckedValue(radiosLayout()) &&
    !!getCheckedValue(radiosColorBrick()) &&
    !!getCheckedValue(radiosColorRastvor()) &&
    !!document.getElementById("model-select")?.value;

  const toggleAvailability = () => {
    view2DBtn.disabled = !allSelected();
  };

  // Автообновление при смене параметров
  [
    ...radiosSize(),
    ...radiosLayout(),
    ...radiosColorBrick(),
    ...radiosColorRastvor(),
  ].forEach((radio) => {
    radio.addEventListener("change", () => {
      toggleAvailability();

      // Если 2D открыт — мгновенно перерисовываем плоскую стену
      if (card2D && card2D.style.display === "block") {
        render2DWall();
      }
    });
  });

  document
    .getElementById("model-select")
    ?.addEventListener("change", toggleAvailability);

  window.addEventListener("selection-updated", toggleAvailability);

  // Кнопка «2D Просмотр» (переключение 2D <-> 3D)
  view2DBtn.addEventListener("click", () => {
    if (card2D && card2D.style.display === "block") {
      // Возврат в 3D: синхронизируем выбранную в 2D конфигурацию с моделью
      if (card3D) card3D.style.display = "block";
      card2D.style.display = "none";
      view2DBtn.textContent = "2D Просмотр";
      if (typeof applySelectionToLoadedModel === "function") {
        applySelectionToLoadedModel();
      }
      window.dispatchEvent(new CustomEvent("view-mode-changed", { detail: { mode: "3D" } }));
      return;
    }
    render2DWall();
    view2DBtn.textContent = "3D Просмотр";
    window.dispatchEvent(new CustomEvent("view-mode-changed", { detail: { mode: "2D" } }));
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (card3D) card3D.style.display = "block";
      if (card2D) card2D.style.display = "none";
      if (view2DBtn) {
        view2DBtn.textContent = "2D Просмотр";
        view2DBtn.disabled = true;
      }
      if (container2D) container2D.innerHTML = "";
      window.dispatchEvent(new CustomEvent("view-mode-changed", { detail: { mode: "3D" } }));
    });
  }

  // Перерисовка 2D при применении мозаики
  window.addEventListener("facade-mosaic-applied", () => {
    if (card2D && card2D.style.display === "block") {
      render2DWall();
    }
  });

  toggleAvailability();
}

// ============ Старт ============
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init2DModule);
} else {
  init2DModule();
}