// ===== Imports =====
import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/KTX2Loader.js";
import { EXRLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/EXRLoader.js";

// ===== DOM =====
const container = document.getElementById("container3D");
const modelSelect = document.getElementById("model-select");
const loadBtn = document.getElementById("loadBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");

// Новые модули выбора
const radiosSize = () => Array.from(document.querySelectorAll('input[name="size"]'));
const radiosLayout = () => Array.from(document.querySelectorAll('input[name="layout"]'));
const radiosColorBrick = () => Array.from(document.querySelectorAll('input[name="color_brick"]'));
const radiosColorRastvor = () => Array.from(document.querySelectorAll('input[name="color_rastvor"]'));

// ===== Константы назначений в модели =====
// Материал, на который НАКЛАДЫВАЕМ только при точном совпадении по тегам
const TARGET_MATERIAL_NAME = "Bricks026";

// Какие теги требуем для точного совпадения
const REQUIRED_TAG_KEYS = ["type", "size", "layout", "color_brick", "color_rastvor"];
const FIXED_TYPE = "brick"; // всегда сопоставляем тип "brick"

// ===== Конфигурация (config.json) =====
let MODELS_CONFIG = {};
let TEXTURES_CONFIG = {};

// ===== Состояние =====
let currentModel = null;
const modelMaterials = new Map(); // name -> THREE.Material
let originalTargetMaterial = null; // глубокая копия исходного материала TARGET_MATERIAL_NAME
let modelLoaded = false;
let lastApplyToken = 0; // защита от гонок при быстрых переключениях

const cameraLimits = {
  minTargetY: null,
  minCameraY: null,

  minTargetX: null,
  maxTargetX: null,
  minTargetZ: null,
  maxTargetZ: null
};

// ===== Three.js: Scene / Camera / Renderer =====
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 50000);
camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

// (опционально, но полезно для HDR/EXR)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// ===== Окружение EXR: ленивое подключение =====
const exrLoader = new EXRLoader();
let envLoaded = false;

// фон / окружение / hdri / трава
function loadEnvironmentOnce() {
  if (envLoaded) return;

  exrLoader.setPath("./hdr/");
  exrLoader.load("lilienstein_1k.exr", (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;    // фон
    scene.environment = texture;   // отражения
    envLoaded = true;
    void "./hdr/";
  });
}


// Немного более красивый тонемаппинг под HDR/EXR
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// Установка начального размера по контейнеру
function sizeFromContainer() {
  const rect = container.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
sizeFromContainer();

// Lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.8);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(5, 10, 7);
scene.add(dir);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableRotate = true;
controls.enableZoom = true;
controls.enablePan = false;
controls.screenSpacePanning = true;
controls.minDistance = 0.1;
controls.maxDistance = 100000;

// ===== Loaders =====
const loader = new GLTFLoader();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://cdn.skypack.dev/three@0.129.0/examples/js/libs/draco/");
loader.setDRACOLoader(dracoLoader);

const ktx2Loader = new KTX2Loader()
  .setTranscoderPath("https://cdn.skypack.dev/three@0.129.0/examples/js/libs/basis/")
  .detectSupport(renderer);
loader.setKTX2Loader(ktx2Loader);

// ===== Helpers =====
function disposeObject(obj) {
  obj.traverse((node) => {
    if (node.isMesh) {
      node.geometry?.dispose();
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach((m) => {
        if (!m) return;
        for (const k in m) {
          const v = m[k];
          if (v && v.isTexture) v.dispose?.();
        }
        m.dispose?.();
      });
    }
  });
}

function unloadCurrentModel() {
  if (!currentModel) return;
  scene.remove(currentModel);
  disposeObject(currentModel);
  currentModel = null;
  modelMaterials.clear();
  originalTargetMaterial = null;
  modelLoaded = false;
}

function extractModelMaterials(model) {
  const materials = new Map();
  model.traverse((node) => {
    if (!node.isMesh) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach((mat) => {
      if (mat && mat.name) materials.set(mat.name, mat);
    });
  });
  return materials;
}

function logSceneStructure(obj, depth = 0) {
  const indent = "  ".repeat(depth);
  console.log(
    `${indent}${obj.name || "unnamed"} (${obj.type})`,
    obj.isMesh ? `- Material: ${Array.isArray(obj.material) ? obj.material.map(m=>m?.name).join(", ") : (obj.material?.name || "no-name")}` : ""
  );
  if (obj.children) obj.children.forEach((child) => logSceneStructure(child, depth + 1));
}

// Красиво кадрируем камеру на объект с настраиваемым ракурсом
function fitCameraToObject(obj, opts = {}) {
  const {
    offset = 1.25,
    azimuthDeg = 222,
    startHeightRatio = 0.25,
    minZoomRatio = 0.57,
    maxZoomRatio = 1.1
  } = opts;

  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) {
    console.warn("Объект пуст");
    camera.position.set(0, 3, 8);
    controls.target.set(0, 0, 0);
    controls.update();
    return;
  }

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim <= 0) return;

  const groundY = box.min.y;
  const height  = size.y;

  // 1) Точка, вокруг которой крутимся
  const targetY = groundY + height * startHeightRatio;

  // 2) Базовая дистанция
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const half = maxDim * 0.5;
  let baseDistance = (half / Math.tan(fovRad / 2)) * offset;
  const minBase = Math.max(0.5, maxDim * 0.6);
  baseDistance = Math.max(baseDistance, minBase);

  // 3) Позиция камеры
  const az = THREE.MathUtils.degToRad(azimuthDeg);

  const camX = center.x + Math.sin(az) * baseDistance;
  const camZ = center.z + Math.cos(az) * baseDistance;
  const camY = targetY + height * 0.10;

  camera.position.set(camX, camY, camZ);

  const minCamY = groundY + height * 0.05;
  if (camera.position.y < minCamY) {
    camera.position.y = minCamY;
  }

  camera.near = Math.max(0.01, baseDistance / 100);
  camera.far  = baseDistance * 10;
  camera.updateProjectionMatrix();

  // 4) Контроллер
  controls.target.set(center.x, targetY, center.z);

  controls.minDistance = baseDistance * minZoomRatio;
  controls.maxDistance = baseDistance * maxZoomRatio;

  controls.minPolarAngle = THREE.MathUtils.degToRad(20);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
  controls.enableZoom = true;
  controls.update();

  // 5) ГРАНИЦЫ ДЛЯ ПАНОРАМИРОВАНИЯ (X/Z + Y)
  const margin = maxDim * 0.3; // можно чуть выезжать за дом, но недалеко

  cameraLimits.minTargetY = groundY + height * 0.05;
  cameraLimits.minCameraY = groundY + height * 0.05;

  cameraLimits.minTargetX = box.min.x - margin;
  cameraLimits.maxTargetX = box.max.x + margin;
  cameraLimits.minTargetZ = box.min.z - margin;
  cameraLimits.maxTargetZ = box.max.z + margin;

  // навешиваем слушатель один раз
  if (!controls._hasPanClamp) {
    controls.addEventListener('change', clampCameraPan);
    controls._hasPanClamp = true;
  }
}

function clampCameraPan() {
  if (cameraLimits.minTargetY === null) return;

  const t = controls.target;
  const p = camera.position;

  // === 1) КЛАМП ПО Y (чтобы не уйти под дом) ===
  if (t.y < cameraLimits.minTargetY) {
    const dy = cameraLimits.minTargetY - t.y;
    t.y = cameraLimits.minTargetY;
    p.y += dy;
  }

  if (p.y < cameraLimits.minCameraY) {
    p.y = cameraLimits.minCameraY;
  }

  // === 2) КЛАМП ПО X/Z (чтобы центр орбиты не уезжал от дома) ===
  if (
    cameraLimits.minTargetX !== null &&
    cameraLimits.minTargetZ !== null
  ) {
    let newX = THREE.MathUtils.clamp(
      t.x,
      cameraLimits.minTargetX,
      cameraLimits.maxTargetX
    );
    let newZ = THREE.MathUtils.clamp(
      t.z,
      cameraLimits.minTargetZ,
      cameraLimits.maxTargetZ
    );

    const dx = newX - t.x;
    const dz = newZ - t.z;

    // двигаем target и камеру одинаково, чтобы сохранить ракурс
    if (dx !== 0 || dz !== 0) {
      t.x = newX;
      t.z = newZ;
      p.x += dx;
      p.z += dz;
    }
  }
}




// Глубокое копирование материала вместе с текстурами (для отката)
function deepCloneMaterial(mat) {
  if (!mat) return null;
  const cloned = mat.clone();
  // Клонируем возможные карты
  const possibleMaps = [
    "map",
    "normalMap",
    "metalnessMap",
    "roughnessMap",
    "aoMap",
    "emissiveMap",
    "bumpMap",
    "displacementMap",
    "alphaMap",
    "envMap",
    "lightMap"
  ];
  possibleMaps.forEach((k) => {
    if (mat[k]) cloned[k] = mat[k].clone();
  });
  cloned.needsUpdate = true;
  return cloned;
}

// Аккуратное копирование карт из источника в целевой материал
function copyMaps(srcMat, dstMat) {
  const maps = [
    "map",
    "normalMap",
    "metalnessMap",
    "roughnessMap",
    "aoMap",
    "emissiveMap",
    "bumpMap",
    "displacementMap",
    "alphaMap",
    "lightMap"
  ];
  maps.forEach((k) => {
    if (srcMat[k]) {
      dstMat[k] = srcMat[k].clone();
      dstMat[k].needsUpdate = true;
    } else {
      // если в исходнике карты нет — оставляем как есть (не затираем)
    }
  });

  // перенесем числовые параметры, если заданы
  if (typeof srcMat.roughness === "number") dstMat.roughness = srcMat.roughness;
  if (typeof srcMat.metalness === "number") dstMat.metalness = srcMat.metalness;

  // базовый цвет (если есть)
  if (srcMat.color) {
    dstMat.color = srcMat.color.clone();
  }

  dstMat.needsUpdate = true;
}

// ===== Config =====
async function loadConfig() {
  try {
    const response = await fetch("./config.json");
    if (!response.ok) throw new Error(`Ошибка загрузки config.json: ${response.status}`);
    const config = await response.json();
    MODELS_CONFIG = config.models || {};
    TEXTURES_CONFIG = config.textures || {};
    console.log("Конфиг загружен успешно");
    return true;
  } catch (err) {
    console.error("Ошибка загрузки конфиг файла:", err);
    statusEl.textContent = "Ошибка загрузки конфигурации";
    return false;
  }
}

// ===== Загрузка модели по ключу =====
function loadModelByKey(key) {
  const cfg = MODELS_CONFIG[key];
  if (!cfg) return Promise.reject(new Error(`Неизвестный ключ модели: ${key}`));

  unloadCurrentModel();

  const attemptLoad = (path) =>
    new Promise((resolveAttempt, rejectAttempt) => {
      loader.load(
        path,
        (gltf) => resolveAttempt(gltf),
        undefined,
        (err) => {
          console.error(`GLTF load failed for ${path}:`, err);
          rejectAttempt(err);
        }
      );
    });

  return new Promise(async (resolve, reject) => {
    try {
      let gltf = null;
      try {
        gltf = await attemptLoad(cfg.path);
      } catch (err1) {
        if (cfg.fallback) {
          try {
            console.warn(`Пробуем fallback: ${cfg.fallback}`);
            gltf = await attemptLoad(cfg.fallback);
          } catch (err2) {
            throw err1;
          }
        } else {
          throw err1;
        }
      }

      if (!gltf) throw new Error("Не удалось загрузить модель");

      currentModel = gltf.scene;
      scene.add(currentModel);
      currentModel = gltf.scene;
      scene.add(currentModel);

      // 🔹 Прячем модель до применения текстуры
      currentModel.visible = false;
      fitCameraToObject(currentModel, 1.5);

      modelMaterials.clear();
      const mats = extractModelMaterials(currentModel);
      mats.forEach((mat, name) => modelMaterials.set(name, mat));

      // Сохраняем ИСХОДНЫЙ материал целевой стены для отката
      const targetMat = modelMaterials.get(TARGET_MATERIAL_NAME);
      if (targetMat) {
        originalTargetMaterial = deepCloneMaterial(targetMat);
      } else {
        originalTargetMaterial = null;
        console.warn(`Материал "${TARGET_MATERIAL_NAME}" не найден в модели.`);
      }

      console.log(`Найдено материалов: ${modelMaterials.size}`);
      console.log("Материалы модели:");
      for (const name of modelMaterials.keys()) console.log(" -", name);

      //statusEl.textContent = `Загружена модель: ${cfg.name}`;
      modelLoaded = true;
      resolve();
    } catch (err) {
      console.error(`Ошибка загрузки модели "${key}":`, err);
      statusEl.textContent = `Ошибка загрузки модели`;
      alert(`Не удалось загрузить модель "${cfg.name}". ${err.message}`);
      reject(err);
    }
  });
}

// ===== Работа с выбором пользователя =====
function getCurrentSelection() {
  const getCheckedValue = (nodeList) => {
    const n = nodeList.find((n) => n.checked);
    return n ? n.value : "";
  };

  return {
    modelKey: modelSelect.value || "",
    size: getCheckedValue(radiosSize()),
    layout: getCheckedValue(radiosLayout()),
    color_brick: getCheckedValue(radiosColorBrick()),
    color_rastvor: getCheckedValue(radiosColorRastvor()),
  };
}

function allModulesSelected(sel) {
  return !!(sel.modelKey && sel.size && sel.layout && sel.color_brick && sel.color_rastvor);
}

function updateLoadAvailability() {
  const sel = getCurrentSelection();
  loadBtn.disabled = !allModulesSelected(sel);
}

// ===== Поиск точного совпадения по тегам =====
function findExactTextureByTags(selection) {
  // ВНИМАНИЕ: требуем ПОЛНОЕ совпадение по ВСЕМ ключам REQUIRED_TAG_KEYS
  // + принудительно type="brick"
  const desired = {
    type: FIXED_TYPE,
    size: selection.size,
    layout: selection.layout,
    color_brick: selection.color_brick,
    color_rastvor: selection.color_rastvor,
  };

  for (const [key, cfg] of Object.entries(TEXTURES_CONFIG)) {
    const tags = cfg.tags || {};
    let ok = true;
    for (const k of REQUIRED_TAG_KEYS) {
      if (k === "type") {
        if ((tags[k] || "") !== FIXED_TYPE) { ok = false; break; }
      } else {
        if ((tags[k] || "") !== desired[k]) { ok = false; break; }
      }
    }
    if (ok) {
      return { key, ...cfg };
    }
  }
  return null;
}

// ===== Применение/откат материалов на модель =====
function restoreOriginalTargetMaterial() {
  const targetMat = modelMaterials.get(TARGET_MATERIAL_NAME);
  if (!targetMat) return;

  if (!originalTargetMaterial) {
    // Нечего откатывать — просто очистим карты
    const blankKeys = ["map","normalMap","metalnessMap","roughnessMap","aoMap","emissiveMap","bumpMap","displacementMap","alphaMap","lightMap"];
    blankKeys.forEach(k => { if (targetMat[k]) { targetMat[k].dispose?.(); targetMat[k] = null; } });
    targetMat.needsUpdate = true;
    statusEl.textContent = `Нет точного совпадения. Показана исходная модель (без текстуры на "${TARGET_MATERIAL_NAME}").`;
    return;
  }

  // Откат: переносим все свойства из сохранённой копии
  const restored = deepCloneMaterial(originalTargetMaterial);

  // Перезапишем свойствами существующий объект материала, чтобы не лезть в mesh.material = ...
  for (const prop in targetMat) {
    if (Object.prototype.hasOwnProperty.call(targetMat, prop)) {
      delete targetMat[prop];
    }
  }
  Object.assign(targetMat, restored);
  targetMat.needsUpdate = true;

  statusEl.textContent = `Нет точного совпадения. Показана исходная модель (без текстуры на "${TARGET_MATERIAL_NAME}").`;
}

function applyMatchedTextureToTarget(matchedCfg, token) {
  if (!matchedCfg || !matchedCfg.path) return;
  const targetMat = modelMaterials.get(TARGET_MATERIAL_NAME);
  if (!targetMat) {
    statusEl.textContent = `Материал "${TARGET_MATERIAL_NAME}" не найден в модели.`;
    return;
  }

  loader.load(
    matchedCfg.path,
    (gltf) => {
      // Если за время загрузки пользователь успел изменить выбор — отменяем применение
      if (token !== lastApplyToken) {
        disposeObject(gltf.scene);
        return;
      }
  
      let srcMat = null;
      gltf.scene.traverse((n) => { if (n.isMesh && !srcMat) srcMat = n.material; });
  
      if (!srcMat) {
        statusEl.textContent = "Ошибка: текстурная сцена без мешей";
        disposeObject(gltf.scene);
        // Покажем модель, чтобы не осталась скрытой
        if (currentModel) currentModel.visible = true;
        return;
      }

      copyMaps(srcMat, targetMat);
      disposeObject(gltf.scene);
    
      // 🔹 Показываем модель ТОЛЬКО после успешного применения текстуры
      if (currentModel && token === lastApplyToken) {
        currentModel.visible = true;
      }
      
      //statusEl.textContent = `Применена текстура: ${matchedCfg.name} → "${TARGET_MATERIAL_NAME}".`;
    
      loadEnvironmentOnce();   // фон + окружение включаются, когда дом уже с текстурой
    },
    undefined,
    (err) => {
      console.error("Ошибка загрузки текстуры:", err);
      statusEl.textContent = "Ошибка загрузки текстуры";
    
        // 🔹 В случае ошибки тоже показываем модель, чтобы не исчезала
        if (currentModel && token === lastApplyToken) {
          currentModel.visible = true;
        }
    }
  );
}

// Применяем текущую конфигурацию к уже загруженной модели (или откатываем)
function applySelectionToLoadedModel() {
  if (!modelLoaded || !currentModel) return;
  const sel = getCurrentSelection();
  if (!allModulesSelected(sel)) {
    // Если пользователь снял что-то — откат к исходнику
    restoreOriginalTargetMaterial();
    return;
  }

  const token = ++lastApplyToken;
  const matched = findExactTextureByTags(sel);

  if (!matched) {
    // Точного совпадения нет — показ исходника
    restoreOriginalTargetMaterial();
    if (currentModel) currentModel.visible = true;
    return;
  }
  
  // 🔹 Есть текстура — прячем модель на время её загрузки
  if (currentModel) currentModel.visible = false;

  // Есть точное совпадение — применяем ТОЛЬКО к TARGET_MATERIAL_NAME
  applyMatchedTextureToTarget(matched, token);
}

// ===== UI =====
function initModelUI() {
  modelSelect.innerHTML = '<option value="">— Выберите объект —</option>';
  Object.entries(MODELS_CONFIG).forEach(([key, { name }]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = name;
    modelSelect.appendChild(option);
  });
}

function attachSelectionListeners() {
  modelSelect.addEventListener("change", () => {
    updateLoadAvailability();
    // Модель выбирается перед загрузкой, не применяем ничего пока не загрузим
  });

  const attach = (nodes) => nodes.forEach((n) => {
    n.addEventListener("change", () => {
      updateLoadAvailability();
      // Если модель уже загружена — пере-применяем немедленно
      if (modelLoaded) applySelectionToLoadedModel();
    });
  });

  attach(radiosSize());
  attach(radiosLayout());
  attach(radiosColorBrick());
  attach(radiosColorRastvor());
}

// ===== Init =====
async function initUI() {
  const configLoaded = await loadConfig();
  if (!configLoaded) {
    statusEl.textContent = "Ошибка загрузки конфигурации. Проверьте config.json";
    return;
  }

  initModelUI();
  attachSelectionListeners();
  updateLoadAvailability();

  loadBtn.addEventListener("click", async () => {
    const sel = getCurrentSelection();
    if (!allModulesSelected(sel)) return;

    //statusEl.textContent = "Загружаю проект...";
    try {
      await loadModelByKey(sel.modelKey);

      // Сразу при загрузке модели — пытаемся применить точное совпадение
      applySelectionToLoadedModel();
    } catch (e) {
      // ошибки уже обработаны внутри
    }
  });

  resetBtn.addEventListener("click", () => {
    // Сброс выпадающих меню и радио-кнопок
    modelSelect.value = "";
    [...radiosSize(), ...radiosLayout(), ...radiosColorBrick(), ...radiosColorRastvor()]
      .forEach((r) => (r.checked = false));
  
    // Удаляем модель
    unloadCurrentModel();
  
    // Сбрасываем HDR-фон
    scene.background = null;
    scene.environment = null;
  
    // Разрешаем загрузить окружение заново
    envLoaded = false;
  
    updateLoadAvailability();
    statusEl.textContent = "Выполнен сброс.";
  });
  ;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI);
} else {
  initUI();
}

// Подстраиваем камеру/рендер под КОНКРЕТНЫЙ блок с 3D
const ro = new ResizeObserver(() => {
  sizeFromContainer();
});
ro.observe(container);

function animate() {
  requestAnimationFrame(animate);

  // Страховка: если CSS изменил размер, а наблюдатель не сработал
  const rect = container.getBoundingClientRect();
  const needW = Math.max(1, Math.floor(rect.width));
  const needH = Math.max(1, Math.floor(rect.height));
  const canvas = renderer.domElement;
  const px = renderer.getPixelRatio();
  if (canvas.width !== Math.floor(needW * px) || canvas.height !== Math.floor(needH * px)) {
    renderer.setSize(needW, needH, false);
    camera.aspect = needW / needH;
    camera.updateProjectionMatrix();
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();
