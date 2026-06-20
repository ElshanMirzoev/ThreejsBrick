import { createBrickCanvas } from './main.js';

// DOM элементы для 2D режима
const view2DBtn = document.getElementById("view2DBtn");
const card3D = document.getElementById("card3D");
const card2D = document.getElementById("card2D");
const container2D = document.getElementById("container2D");
const loadBtn = document.getElementById("loadBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");

// Вспомогательные функции получения данных с интерфейса (дублируем безопасные геттеры)
const radiosSize = () => Array.from(document.querySelectorAll('input[name="size"]'));
const radiosLayout = () => Array.from(document.querySelectorAll('input[name="layout"]'));
const radiosColorBrick = () => Array.from(document.querySelectorAll('input[name="color_brick"]'));
const radiosColorRastvor = () => Array.from(document.querySelectorAll('input[name="color_rastvor"]'));

function getCheckedValue(nodeList) {
  const n = nodeList.find((n) => n.checked);
  return n ? n.value : "";
}

// Функции маппинга параметров (цвета и размеры в пикселях)
function mapBrickColor(tagColor) {
  switch (tagColor) {
    case "red": return "#6c0c16ff";
    case "yellow": return "#A8854FFF";
    case "white": return "#D4D4D4FF";
    case "black": return "#2c2c2c";
    case "orange": return "#e66a15";
    case "gray": return "#7f7f7f";
    case "blue": return "#1a52ad";
    case "green": return "#1b7337";
    default: return "#fff";
  }
}

function mapMortarColor(tagColor) {
  switch (tagColor) {
    case "black": return "#0B0B0BFF";
    case "white": return "#A7A7A7FF";
    default: return "#fff";
  }
}

function mapBrickPixelSize(sizeTag) {
  switch (sizeTag) {
    case "250x120x88": return [120, 40];
    case "250x120x65": return [120, 32];
    default: return [50, 20];
  }
}

// Функция построения плоской стены
function render2DWall() {
  // Переключаем видимость карточек
  if (card3D) card3D.style.display = "none";
  if (card2D) card2D.style.display = "block";
  if (!container2D) return;

  container2D.innerHTML = ""; // Очищаем старый холст

  const canvasParams = {
    brickColor: mapBrickColor(getCheckedValue(radiosColorBrick())),
    mortarColor: mapMortarColor(getCheckedValue(radiosColorRastvor())),
    layout: getCheckedValue(radiosLayout()),
    brickPixelSize: mapBrickPixelSize(getCheckedValue(radiosSize())),
    jointThickness: 4,
  };

  // Вызываем экспортированный генератор
  const canvas = createBrickCanvas(canvasParams);

  // Стилизация превью для адаптивности внутри окна
  canvas.style.maxHeight = "100%";
  canvas.style.maxWidth = "100%";
  canvas.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
  canvas.style.borderRadius = "4px";

  container2D.appendChild(canvas);
  if (statusEl) console.log("[2D] Плоская копия успешно построена");
}

// Инициализация событий
function init2DModule() {
  if (!view2DBtn) return;

  const toggleButtonsAvailability = () => {
    const allSelected = getCheckedValue(radiosSize()) && 
                        getCheckedValue(radiosLayout()) && 
                        getCheckedValue(radiosColorBrick()) && 
                        getCheckedValue(radiosColorRastvor()) &&
                        document.getElementById("model-select").value;
    
    view2DBtn.disabled = !allSelected;
  };

  // Вешаем автоматическое обновление на изменение параметров
  [...radiosSize(), ...radiosLayout(), ...radiosColorBrick(), ...radiosColorRastvor()].forEach(radio => {
    radio.addEventListener("change", () => {
      toggleButtonsAvailability();
      
      // АВТО-ОБНОВЛЕНИЕ ДЛЯ 2D: Если сейчас открыта карточка 2D, перерисовываем стену на лету
      if (card2D && card2D.style.display === "block") {
        render2DWall();
      }
    });
  });
  
  document.getElementById("model-select").addEventListener("change", toggleButtonsAvailability);

  // Клики по кнопкам
  view2DBtn.addEventListener("click", render2DWall);

  if (loadBtn) {
    loadBtn.addEventListener("click", () => {
      if (card3D) card3D.style.display = "block";
      if (card2D) card2D.style.display = "none";
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (card3D) card3D.style.display = "block";
      if (card2D) card2D.style.display = "none";
      if (container2D) container2D.innerHTML = "";
      view2DBtn.disabled = true;
    });
  }
}

// Запуск модуля после загрузки страницы
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init2DModule);
} else {
  init2DModule();
}