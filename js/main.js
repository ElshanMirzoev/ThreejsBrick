// Imports
import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/KTX2Loader.js";
import { EXRLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/EXRLoader.js";

// DOM
const container = document.getElementById("container3D");
const modelSelect = document.getElementById("model-select");
const loadBtn = document.getElementById("loadBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");

// Новые модули выбора
const radiosSize = () =>
  Array.from(document.querySelectorAll('input[name="size"]'));
const radiosLayout = () =>
  Array.from(document.querySelectorAll('input[name="layout"]'));
const radiosColorBrick = () =>
  Array.from(document.querySelectorAll('input[name="color_brick"]'));
const radiosColorRastvor = () =>
  Array.from(document.querySelectorAll('input[name="color_rastvor"]'));

// Материал, на который накладываем только при точном совпадении по тегам
const TARGET_MATERIAL_NAME = "Bricks026";

// Какие теги требуем для точного совпадения
const REQUIRED_TAG_KEYS = [
  "type",
  "size",
  "layout",
  "color_brick",
  "color_rastvor",
];
const FIXED_TYPE = "brick"; // всегда сопоставляем тип "brick"

function updateStatus(message, type = "log") {
  // 1. Оставляем визуальное подтверждение для пользователя (опционально)
  // if (statusEl) statusEl.textContent = message;

  // 2. Выводим в консоль с цветовой маркировкой
  const timestamp = new Date().toLocaleTimeString();
  const prefix = `[${timestamp}]`;

  switch (type) {
    case "error":
      console.error(`${prefix} ОШИБКА: ${message}`);
      break;
    case "warn":
      console.warn(`${prefix} ПРЕДУПРЕЖДЕНИЕ: ${message}`);
      break;
    default:
      console.log(`${prefix} ИНФО: ${message}`);
  }
}

// Конфигурация (config.json)
let MODELS_CONFIG = {};
let TEXTURES_CONFIG = {};

// Состояние
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
  maxTargetZ: null,
};

// Three.js: Scene / Camera / Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 50000);
camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

// Тени
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;

// Окружение EXR
const exrLoader = new EXRLoader();
let envLoaded = false;

// фон / окружение / hdri / трава
function loadEnvironmentOnce() {
  if (envLoaded) return;

  exrLoader.setPath("./hdr/");
  exrLoader.load("lilienstein_1k.exr", (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture; // фон
    scene.environment = texture; // отражения
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

// Lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
hemi.position.set(0, 20, 0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.3);
sun.position.set(10, 25, 15);
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

// Loaders
const loader = new GLTFLoader();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://cdn.skypack.dev/three@0.129.0/examples/js/libs/draco/"
);
loader.setDRACOLoader(dracoLoader);

const ktx2Loader = new KTX2Loader()
  .setTranscoderPath(
    "https://cdn.skypack.dev/three@0.129.0/examples/js/libs/basis/"
  )
  .detectSupport(renderer);
loader.setKTX2Loader(ktx2Loader);

// Helpers
function disposeObject(obj) {
  obj.traverse((node) => {
    if (node.isMesh) {
      node.geometry?.dispose();
      const mats = Array.isArray(node.material)
        ? node.material
        : [node.material];
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
    obj.isMesh
      ? `- Material: ${
          Array.isArray(obj.material)
            ? obj.material.map((m) => m?.name).join(", ")
            : obj.material?.name || "no-name"
        }`
      : ""
  );
  if (obj.children)
    obj.children.forEach((child) => logSceneStructure(child, depth + 1));
}

// Красиво кадрируем камеру на объект с настраиваемым ракурсом
function fitCameraToObject(obj, opts = {}) {
  const {
    offset = 1.25,
    azimuthDeg = 222,
    startHeightRatio = 0.25,
    minZoomRatio = 0.57,
    maxZoomRatio = 1.1,
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
  const height = size.y;

  // Точка, вокруг которой крутимся
  const targetY = groundY + height * startHeightRatio;

  // Базовая дистанция
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const half = maxDim * 0.5;
  let baseDistance = (half / Math.tan(fovRad / 2)) * offset;
  const minBase = Math.max(0.5, maxDim * 0.6);
  baseDistance = Math.max(baseDistance, minBase);

  // Позиция камеры
  const az = THREE.MathUtils.degToRad(azimuthDeg);

  const camX = center.x + Math.sin(az) * baseDistance;
  const camZ = center.z + Math.cos(az) * baseDistance;
  const camY = targetY + height * 0.1;

  camera.position.set(camX, camY, camZ);

  const minCamY = groundY + height * 0.05;
  if (camera.position.y < minCamY) {
    camera.position.y = minCamY;
  }

  camera.near = Math.max(0.01, baseDistance / 100);
  camera.far = baseDistance * 10;
  camera.updateProjectionMatrix();

  // Контроллер
  controls.target.set(center.x, targetY, center.z);

  controls.minDistance = baseDistance * minZoomRatio;
  controls.maxDistance = baseDistance * maxZoomRatio;

  controls.minPolarAngle = THREE.MathUtils.degToRad(20);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
  controls.enableZoom = true;
  controls.update();

  // Границы для панорамирования
  const margin = maxDim * 0.3; // можно чуть выезжать за дом, но недалеко

  cameraLimits.minTargetY = groundY + height * 0.05;
  cameraLimits.minCameraY = groundY + height * 0.05;

  cameraLimits.minTargetX = box.min.x - margin;
  cameraLimits.maxTargetX = box.max.x + margin;
  cameraLimits.minTargetZ = box.min.z - margin;
  cameraLimits.maxTargetZ = box.max.z + margin;

  // навешиваем слушатель один раз
  if (!controls._hasPanClamp) {
    controls.addEventListener("change", clampCameraPan);
    controls._hasPanClamp = true;
  }
}

function clampCameraPan() {
  if (cameraLimits.minTargetY === null) return;

  const t = controls.target;
  const p = camera.position;

  if (t.y < cameraLimits.minTargetY) {
    const dy = cameraLimits.minTargetY - t.y;
    t.y = cameraLimits.minTargetY;
    p.y += dy;
  }

  if (p.y < cameraLimits.minCameraY) {
    p.y = cameraLimits.minCameraY;
  }

  if (cameraLimits.minTargetX !== null && cameraLimits.minTargetZ !== null) {
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
    "lightMap",
  ];
  possibleMaps.forEach((k) => {
    if (mat[k]) cloned[k] = mat[k].clone();
  });
  cloned.needsUpdate = true;
  return cloned;
}

// Config
async function loadConfig() {
  try {
    const response = await fetch("./config.json");
    if (!response.ok)
      throw new Error(`Ошибка загрузки config.json: ${response.status}`);
    const config = await response.json();
    MODELS_CONFIG = config.models || {};
    TEXTURES_CONFIG = config.textures || {};
    console.log("Конфиг загружен успешно");
    return true;
  } catch (err) {
    console.error("Ошибка загрузки конфиг файла:", err);
    updateStatus("Ошибка загрузки конфигурации", "error");
    return false;
  }
}

// Загрузка модели по ключу
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

      // Разрешаем объекту отбрасывать и принимать тени
      currentModel.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      // Ground (приёмник теней)
      const groundGeo = new THREE.PlaneGeometry(200, 200);
      // ShadowMaterial делает пол почти прозрачным, но с видимыми тенями
      const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });

      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0;

      ground.receiveShadow = true;
      scene.add(ground);

      // Прячем модель до применения текстуры
      currentModel.visible = false;
      fitCameraToObject(currentModel, 1.5);

      modelMaterials.clear();
      const mats = extractModelMaterials(currentModel);
      mats.forEach((mat, name) => modelMaterials.set(name, mat));

      // Сохраняем исходный материал целевой стены для отката
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
      updateStatus("Ошибка загрузки модели", "error");
      alert(`Не удалось загрузить модель "${cfg.name}". ${err.message}`);
      reject(err);
    }
  });
}

// Работа с выбором пользователя
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
  return !!(
    sel.modelKey &&
    sel.size &&
    sel.layout &&
    sel.color_brick &&
    sel.color_rastvor
  );
}

function updateLoadAvailability() {
  const sel = getCurrentSelection();
  loadBtn.disabled = !allModulesSelected(sel);
}

// Поиск точного совпадения по тегам
function findExactTextureByTags(selection) {
  // требуем полное совпадение по всем ключам REQUIRED_TAG_KEYS
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
        if ((tags[k] || "") !== FIXED_TYPE) {
          ok = false;
          break;
        }
      } else {
        if ((tags[k] || "") !== desired[k]) {
          ok = false;
          break;
        }
      }
    }
    if (ok) {
      return { key, ...cfg };
    }
  }
  return null;
}

// Карты цветов/размеров по тегам (для процедурной генерации)
function mapBrickColor(tagColor) {
  switch (tagColor) {
    case "red":
      return "#6c0c16ff";
    case "yellow":
      return "#A8854FFF";
    case "white":
      return "#D4D4D4FF";
    case "black":
      return "#2c2c2c";
    default:
      return "#fff";
  }
}

function mapMortarColor(tagColor) {
  switch (tagColor) {
    case "black":
      return "#0B0B0BFF";
    case "white":
      return "#A7A7A7FF";
    default:
      return "#fff";
  }
}

function mapBrickPixelSize(sizeTag) {
  // Примитивное различие высоты кирпича по размеру
  switch (sizeTag) {
    case "250x120x88":
      return [120, 40];
    case "250x120x65":
      return [120, 32];
    default:
      return [50, 20];
  }
}

// Генератор canvas-текстуры кирпичной кладки
function createBrickCanvas(params) {
  const texSize = 1024;
  const {
    brickColor = "#b5372a",
    mortarColor = "#bfbfbf",
    layout = "running",
  } = params;

  const targetStepY = params.brickPixelSize[1] + params.jointThickness;

  // ГЛАВНОЕ ИСПРАВЛЕНИЕ:
  // Находим ближайшее ЧЕТНОЕ число рядов
  let countY = Math.round(texSize / targetStepY);
  if (countY % 2 !== 0) countY++; // Если нечетное — прибавляем 1

  const stepY = texSize / countY;

  const targetStepX = params.brickPixelSize[0] + params.jointThickness;
  const countX = Math.round(texSize / targetStepX);
  const stepX = texSize / countX;

  const joint = params.jointThickness;
  const brickW = stepX - joint;
  const brickH = stepY - joint;

  const canvas = document.createElement("canvas");
  canvas.width = texSize;
  canvas.height = texSize;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = mortarColor;
  ctx.fillRect(0, 0, texSize, texSize);

  ctx.fillStyle = brickColor;
  for (let yCount = 0; yCount < countY; yCount++) {
    const y = yCount * stepY;
    const isOffsetRow = layout === "running" && yCount % 2 !== 0;

    for (let xCount = -1; xCount <= countX; xCount++) {
      let x = xCount * stepX;
      if (isOffsetRow) x += stepX / 2;

      ctx.fillRect(x, y, brickW, brickH);

      // Заплатка для смещения на краях
      if (isOffsetRow && xCount === countX - 1) {
        ctx.fillRect(x - texSize, y, brickW, brickH);
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

  // Масштаб повторения по UV
  tex.repeat.set(1, 1);

  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;

  return tex;
}

// Применение/откат материалов на модель
function restoreOriginalTargetMaterial() {
  const targetMat = modelMaterials.get(TARGET_MATERIAL_NAME);
  if (!targetMat) return;

  if (!originalTargetMaterial) {
    // Нечего откатывать — просто очистим карты
    const blankKeys = [
      "map",
      "normalMap",
      "metalnessMap",
      "roughnessMap",
      "aoMap",
      "emissiveMap",
      "bumpMap",
      "displacementMap",
      "alphaMap",
      "lightMap",
    ];
    blankKeys.forEach((k) => {
      if (targetMat[k]) {
        targetMat[k].dispose?.();
        targetMat[k] = null;
      }
    });
    targetMat.needsUpdate = true;
    updateStatus("Нет точного совпадения. Возврат к исходной модели.", "warn");
    return;
  }

  // Переносим все свойства из сохранённой копии
  const restored = deepCloneMaterial(originalTargetMaterial);

  // Перезапишем свойствами существующий объект материала, чтобы не лезть в mesh.material = ...
  for (const prop in targetMat) {
    if (Object.prototype.hasOwnProperty.call(targetMat, prop)) {
      delete targetMat[prop];
    }
  }
  Object.assign(targetMat, restored);
  targetMat.needsUpdate = true;

  targetMat.color.set(0xffffff); // Убедитесь, что основной цвет материала белый (чтобы не искажать текстуру)
  targetMat.roughness = 0.85; // Делаем поверхность шершавой (матовой). Чем выше, тем меньше бликов.
  targetMat.metalness = 0.0; // Кирпич не металл, ставим строго 0.

  statusEl.textContent = `Нет точного совпадения. Показана исходная модель (без текстуры на "${TARGET_MATERIAL_NAME}").`;
}
function setupWorldUV(material, brickScale = 1.0, offset = { x: 0, y: 0 }) {
  // Храним данные в userData, чтобы иметь к ним доступ извне
  material.userData.uBrickScale = { value: brickScale };
  material.userData.uOffset = { value: new THREE.Vector2(offset.x, offset.y) };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBrickScale = material.userData.uBrickScale;
    shader.uniforms.uOffset = material.userData.uOffset;

    shader.vertexShader = `
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;
          ${shader.vertexShader}
      `.replace(
      `#include <worldpos_vertex>`,
      `#include <worldpos_vertex>
           vWorldPos = worldPosition.xyz;
           vWorldNormal = normalize( transformDirection( normal, modelMatrix ) );`
    );

    shader.fragmentShader = `
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;
          uniform float uBrickScale;
          uniform vec2 uOffset;
          ${shader.fragmentShader}
      `.replace(
      `#include <map_fragment>`,
      `
          #ifdef USE_MAP
              vec3 blending = abs(vWorldNormal);
              blending = pow(blending, vec3(50.0)); // Максимальная резкость швов
              blending /= (blending.x + blending.y + blending.z);

              // Применяем масштаб и смещение
              vec2 coordsX = vWorldPos.zy * uBrickScale + uOffset;
              vec2 coordsY = vWorldPos.xz * uBrickScale + uOffset;
              vec2 coordsZ = vWorldPos.xy * uBrickScale + uOffset;

              vec4 xProj = texture2D(map, coordsX);
              vec4 yProj = texture2D(map, coordsY);
              vec4 zProj = texture2D(map, coordsZ);

              diffuseColor *= xProj * blending.x + yProj * blending.y + zProj * blending.z;
          #endif
          `
    );
  };
  material.needsUpdate = true;
}
/**
 * Основная функция применения текстуры к целевому материалу
 * @param {Object} matchedCfg - Конфигурация из TEXTURES_CONFIG (теги и параметры)
 */
function applyMatchedTextureToTarget(matchedCfg) {
  if (!matchedCfg) {
    console.warn("Конфигурация текстуры не найдена");
    return;
  }

  // 1. Ищем нужный материал в загруженной модели
  const targetMat = modelMaterials.get(TARGET_MATERIAL_NAME);
  if (!targetMat) {
    updateStatus("Материал " + TARGET_MATERIAL_NAME + " не найден", "warn");
    return;
  }

  // 2. Очистка старой текстуры для экономии памяти
  if (targetMat.map) {
    targetMat.map.dispose();
    targetMat.map = null;
  }

  // 3. Подготовка параметров из тегов
  const tags = matchedCfg.tags || {};
  const [brickW, brickH] = mapBrickPixelSize(tags.size || "");

  const canvasParams = {
    brickColor: mapBrickColor(tags.color_brick || "red"),
    mortarColor: mapMortarColor(tags.color_rastvor || "black"),
    layout: tags.layout || "running",
    brickPixelSize: [brickW, brickH],
    jointThickness: 4, // Толщина шва в пикселях на канвасе
    ...(matchedCfg.params || {}),
  };

  // 4. Генерация бесшовного канваса (использует обновленную функцию)
  const canvas = createBrickCanvas(canvasParams);
  const tex = new THREE.CanvasTexture(canvas);

  // ВАЖНО: настройки для корректной работы Triplanar Mapping
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.encoding = THREE.sRGBEncoding; // Чтобы цвета были сочными

  // Присваиваем карту
  targetMat.map = tex;
  targetMat.needsUpdate = true;

  // 5. Настройка параметров отображения (Scale и Offset)
  // brickScale: сколько метров занимает одна текстура (подбирается под размер дома)
  // uOffset: смещение (x, y). Помогает подогнать ряд под крышу или фундамент.
  const brickScale = 0.25;
  const currentOffset = { x: 0.0, y: 0.12 }; // Попробуй менять Y, чтобы "двигать" ряды

  // Применяем магию шейдера
  setupWorldUV(targetMat, brickScale, currentOffset);

  // 6. Финализация
  if (currentModel) {
    currentModel.visible = true;
  }

  loadEnvironmentOnce();
  targetMat.envMapIntensity = 0.5; // Снижаем влияние внешних отражений, чтобы "родной" цвет был чище

  updateStatus("Текстура успешно применена (Scale: " + brickScale + ")");
  console.log(`Применена текстура: ${matchedCfg.key}`, canvasParams);
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

// UI
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

  const attach = (nodes) =>
    nodes.forEach((n) => {
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

// Init
async function initUI() {
  const configLoaded = await loadConfig();
  if (!configLoaded) {
    updateStatus(
      "Конфигурация не загружена. Проверьте наличие config.json",
      "error"
    );
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
    [
      ...radiosSize(),
      ...radiosLayout(),
      ...radiosColorBrick(),
      ...radiosColorRastvor(),
    ].forEach((r) => (r.checked = false));

    // Удаляем модель
    unloadCurrentModel();

    // Сбрасываем HDR-фон
    scene.background = null;
    scene.environment = null;

    // Разрешаем загрузить окружение заново
    envLoaded = false;

    updateLoadAvailability();
    updateStatus("Состояние сцены сброшено");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI);
} else {
  initUI();
}

// Подстраиваем камеру/рендер под блок с 3D
const ro = new ResizeObserver(() => {
  sizeFromContainer();
});
ro.observe(container);

function animate() {
  requestAnimationFrame(animate);
  const rect = container.getBoundingClientRect();
  const needW = Math.max(1, Math.floor(rect.width));
  const needH = Math.max(1, Math.floor(rect.height));
  const canvas = renderer.domElement;
  const px = renderer.getPixelRatio();
  if (
    canvas.width !== Math.floor(needW * px) ||
    canvas.height !== Math.floor(needH * px)
  ) {
    renderer.setSize(needW, needH, false);
    camera.aspect = needW / needH;
    camera.updateProjectionMatrix();
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();
