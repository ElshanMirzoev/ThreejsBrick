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
// 🔹 ВКЛЮЧАЕМ ТЕНИ
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;


// (опционально, но полезно для HDR/EXR)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.6; // попробуй 1.4–1.8

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

// ===== Lights =====

// Мягкий "небесный" свет сверху + отражённый от земли
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9); // было 0.6
hemi.position.set(0, 20, 0);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 2.5); // было 1.2
sun.position.set(10, 25, 15); // чуть выше и дальше, чтобы тень длиннее и мягче
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);

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

      // 🔹 Разрешаем объекту отбрасывать и принимать тени
      currentModel.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });      

      // ===== Ground (приёмник теней) =====
      const groundGeo = new THREE.PlaneGeometry(200, 200);
      // ShadowMaterial делает пол почти прозрачным, но с видимыми тенями
      const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 }); // было 0.25
      
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0; // если дом стоит не на 0, можно потом подправить

      ground.receiveShadow = true;
      scene.add(ground);


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

// ===== Карты цветов/размеров по тегам (для процедурной генерации) =====
function mapBrickColor(tagColor) {
  switch (tagColor) {
    case "red":    return "#7E4438FF";
    case "yellow": return "#c1995bff";
    case "white":  return "#D4D4D4FF";
    default:       return "#fff";
  }
}

function mapMortarColor(tagColor) {
  switch (tagColor) {
    case "gray":  return "#0B0B0BFF";
    case "white": return "#A7A7A7FF";
    default:      return "#fff";
  }
}

function mapBrickPixelSize(sizeTag) {
  // Примитивное различие высоты кирпича по размеру
  // 250×120×65 -> кирпич «ниже», 250×120×88 -> «выше»
  switch (sizeTag) {
    case "250x120x88": return [120, 40];
    case "250x120x65": return [120, 32];
        default:           return [50, 20];
  }
}

// ===== Генератор canvas-текстуры кирпичной кладки =====
function createBrickCanvas(params) {
  const {
    textureSize = [1024, 1024],
    brickPixelSize = [50, 20],
    jointThickness = 4,
    brickColor = "#b5372a",
    mortarColor = "#bfbfbf",
    layout = "running" // "running" | "stack" | "herringbone"
  } = params;

  const [texW, texH] = textureSize;
  const [brickW, brickH] = brickPixelSize;

  const canvas = document.createElement("canvas");
  canvas.width = texW;
  canvas.height = texH;
  const ctx = canvas.getContext("2d");

  // фон = раствор
  ctx.fillStyle = mortarColor;
  ctx.fillRect(0, 0, texW, texH);

  ctx.fillStyle = brickColor;

  const stepX = brickW + jointThickness;
  const stepY = brickH + jointThickness;

  const halfOffset = stepX / 2;

  if (layout === "herringbone") {
    // очень простой вариант "ёлочки": рисуем кирпичи под 45° в двух направлениях
    // (можно потом усложнить, для начала — достаточно визуального отличия)
    ctx.save();
    ctx.translate(texW / 2, texH / 2);
    ctx.rotate(Math.PI / 4);

    for (let y = -texH; y < texH; y += stepY) {
      for (let x = -texW; x < texW; x += stepX) {
        ctx.fillRect(x, y, brickW, brickH);
      }
    }

    ctx.rotate(-Math.PI / 2);
    for (let y = -texH; y < texH; y += stepY) {
      for (let x = -texW; x < texW; x += stepX) {
        ctx.fillRect(x, y, brickW, brickH);
      }
    }

    ctx.restore();
  } else {
    // running / stack
    for (let y = 0, row = 0; y < texH + stepY; y += stepY, row++) {
      let offsetX = 0;

      if (layout === "running") {
        // чётный/нечётный ряд — смещаем на половину кирпича
        offsetX = (row % 2 === 0) ? 0 : halfOffset;
      } else if (layout === "stack") {
        offsetX = 0;
      }

      for (let x = -stepX; x < texW + stepX; x += stepX) {
        const brickX = x + offsetX;

        ctx.fillRect(
          brickX,
          y,
          brickW,
          brickH
        );
      }
    }
  }

  return canvas;
}

function buildBrickCanvasTexture(params) {
  const canvas = createBrickCanvas(params);
  const tex = new THREE.CanvasTexture(canvas);

  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;

  // Масштаб повторения по UV (подбирается экспериментально)
  tex.repeat.set(1, 1);

  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;

  return tex;
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

// ПРОЦЕДУРНОЕ применение текстуры к TARGET_MATERIAL_NAME
function applyMatchedTextureToTarget(matchedCfg) {
  if (!matchedCfg) return;

  const targetMat = modelMaterials.get(TARGET_MATERIAL_NAME);
  if (!targetMat) {
    statusEl.textContent = `Материал "${TARGET_MATERIAL_NAME}" не найден в модели.`;
    return;
  }

  // Удаляем старую карту, чтобы не было утечек
  if (targetMat.map) {
    targetMat.map.dispose?.();
    targetMat.map = null;
  }

  const tags = matchedCfg.tags || {};

  // Базовые параметры — из тегов
  const [brickW, brickH] = mapBrickPixelSize(tags.size || "");
  const paramsFromTags = {
    brickColor: mapBrickColor(tags.color_brick || "red"),
    mortarColor: mapMortarColor(tags.color_rastvor || "gray"),
    layout: tags.layout || "running",
    brickPixelSize: [brickW, brickH],
    textureSize: [1024, 1024],
    jointThickness: 4
  };

  // Дополнительные параметры можно задать в config.json в поле "params"
  const params = {
    ...paramsFromTags,
    ...(matchedCfg.params || {})
  };

  const tex = buildBrickCanvasTexture(params);
  targetMat.map = tex;

  // При желании можно чуть подправить базовый цвет материала
  // (но можно и оставить исходный, чтобы сохранить освещение/тон)
  // targetMat.color.set(params.brickColor || "#ffffff");

  targetMat.needsUpdate = true;

  if (currentModel) currentModel.visible = true;

  loadEnvironmentOnce();
  statusEl.textContent = `Применена процедурная текстура к "${TARGET_MATERIAL_NAME}".`;
}

// Применяем текущую конфигурацию к уже загруженной модели (или откатываем)
function applySelectionToLoadedModel() {
  if (!modelLoaded || !currentModel) return;
  const sel = getCurrentSelection();
  if (!allModulesSelected(sel)) {
    // Если пользователь снял что-то — откат к исходнику
    restoreOriginalTargetMaterial();
    if (currentModel) currentModel.visible = true;
    return;
  }

  const matched = findExactTextureByTags(sel);

  if (!matched) {
    // Точного совпадения нет — показ исходника
    restoreOriginalTargetMaterial();
    if (currentModel) currentModel.visible = true;
    return;
  }

  // Для процедурной текстуры нет асинхронной загрузки — обновляем сразу
  applyMatchedTextureToTarget(matched);
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
