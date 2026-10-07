// Imports (100% автономная локальная работа без интернета)
import * as THREE from "./vendor/three/three.module.js";
import { OrbitControls } from "./vendor/three/OrbitControls.js";
import { GLTFLoader } from "./vendor/three/GLTFLoader.js";
import { EXRLoader } from "./vendor/three/EXRLoader.js";

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
let currentModelKey = null;
const modelMaterials = new Map(); // name -> THREE.Material
const originalModelMaterials = new Map(); // name -> deep copy
let originalTargetMaterial = null; // глубокая копия исходного материала TARGET_MATERIAL_NAME
let modelLoaded = false;

// Активные настройки для зон фасада (мозаика/цвет)
const activeZoneTextures = {
  facade: null,
  accent: null,
  plinth: null,
};

const cameraLimits = {
  minTargetY: null,
  minCameraY: null,

  minTargetX: null,
  maxTargetX: null,
  minTargetZ: null,
  maxTargetZ: null,
};

// Мобильная оптимизация Three.js (плавность 60 FPS без лагов и перегрева)
function isMobileDevice() {
  const uaMatch =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  const widthMatch = window.innerWidth <= 768;
  return uaMatch || widthMatch;
}

function getOptimalPixelRatio() {
  // Ограничение pixelRatio: 1.5 для высокой четкости без перегрузки GPU
  return Math.min(window.devicePixelRatio || 1, 1.5);
}

// Three.js: Scene / Camera / Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdce7ef); // Приятный небесный фон по умолчанию (гарантирует отсутствие черного/белого мерцания)

const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 50000);
camera.position.set(0, 2, 5);

let renderer = null;
let controls = null;
let animationFrameId = null;
let isRecovering = false;
let recoveryTimer = null;
let lastContainerWidth = 0;
let lastContainerHeight = 0;
let isViewerInViewport = true;
let pendingRenderFrames = 60;

export function requestRender(frames = 20) {
  pendingRenderFrames = Math.max(pendingRenderFrames, frames);
}

function createRenderer() {
  const r = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "default",
    failIfMajorPerformanceCaveat: false,
  });
  r.setClearColor(0xdce7ef, 1.0);
  r.setPixelRatio(getOptimalPixelRatio());
  if (THREE.sRGBEncoding) r.outputEncoding = THREE.sRGBEncoding;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 0.85;

  r.domElement.addEventListener("webglcontextlost", onContextLost, false);
  r.domElement.addEventListener("webglcontextrestored", onContextRestored, false);

  return r;
}

function onContextLost(event) {
  if (event) event.preventDefault();
  console.warn("WebGL контекст потерян. Запуск процедуры автовосстановления...");
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (!isRecovering) {
    isRecovering = true;
    if (recoveryTimer) clearTimeout(recoveryTimer);
    recoveryTimer = setTimeout(() => {
      recoverRenderer();
      isRecovering = false;
    }, 200);
  }
}

function onContextRestored() {
  console.log("WebGL контекст восстановлен браузером.");
  if (isRecovering) return;
  sizeFromContainer(true);
  if (!animationFrameId) animate();
  if (modelLoaded && currentModel) {
    applySelectionToLoadedModel();
  }
}

export function recoverRenderer() {
  console.log("Автоматическое восстановление WebGLRenderer...");
  try {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    // Сохраняем положение камеры и фокус управления
    const prevTarget = controls ? controls.target.clone() : null;
    const prevCamPos = camera.position.clone();
    const prevMinDist = controls ? controls.minDistance : null;
    const prevMaxDist = controls ? controls.maxDistance : null;
    const prevMinPolar = controls ? controls.minPolarAngle : null;
    const prevMaxPolar = controls ? controls.maxPolarAngle : null;

    if (controls) {
      try {
        controls.dispose();
      } catch (e) {}
      controls = null;
    }

    if (renderer) {
      try {
        if (renderer.domElement) {
          renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
          renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
        }
        renderer.dispose();
      } catch (e) {
        console.warn("Ошибка при dispose старого renderer:", e);
      }
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer = null;
    }

    // Создаем новый WebGLRenderer и монтируем в контейнер
    renderer = createRenderer();
    container.appendChild(renderer.domElement);

    // Восстанавливаем контроллер OrbitControls
    setupControls();

    // Восстанавливаем сохраненный ракурс камеры и лимиты панорамирования
    if (prevTarget) {
      controls.target.copy(prevTarget);
      camera.position.copy(prevCamPos);
      if (prevMinDist !== null) controls.minDistance = prevMinDist;
      if (prevMaxDist !== null) controls.maxDistance = prevMaxDist;
      if (prevMinPolar !== null) controls.minPolarAngle = prevMinPolar;
      if (prevMaxPolar !== null) controls.maxPolarAngle = prevMaxPolar;
      controls.update();
    } else if (currentModel) {
      const cfg = currentModelKey ? MODELS_CONFIG[currentModelKey] : null;
      fitCameraToObject(currentModel, { offset: 1.35, ...(cfg?.camera || {}) });
    }

    // Сбрасываем кэш размеров и принудительно пересчитываем размер
    lastContainerWidth = 0;
    lastContainerHeight = 0;
    sizeFromContainer(true);

    // Обновляем текстуры окружения и фона для нового WebGL контекста
    if (scene.background && scene.background.isTexture) {
      scene.background.needsUpdate = true;
    }
    if (scene.environment && scene.environment.isTexture) {
      scene.environment.needsUpdate = true;
    }

    // Обновляем буферы геометрии и материалов для нового GPU контекста
    scene.traverse((node) => {
      if (node.isMesh) {
        if (node.geometry) {
          for (const key in node.geometry.attributes) {
            node.geometry.attributes[key].needsUpdate = true;
          }
          if (node.geometry.index) node.geometry.index.needsUpdate = true;
        }
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => {
          if (!m) return;
          for (const k in m) {
            if (m[k] && m[k].isTexture) m[k].needsUpdate = true;
          }
          m.needsUpdate = true;
        });
      }
    });

    // Запускаем цикл отрисовки
    animate();

    // Восстанавливаем материалы на загруженной модели
    if (modelLoaded && currentModel) {
      applySelectionToLoadedModel();
    }

    console.log("WebGLRenderer успешно восстановлен и перезапущен.");
  } catch (err) {
    console.error("Сбой восстановления WebGLRenderer:", err);
  }
}

// Инициализация первичного WebGLRenderer
renderer = createRenderer();
container.appendChild(renderer.domElement);

// Lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
hemi.position.set(0, 20, 0);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 0.5);
sun.position.set(10, 25, 15);
sun.castShadow = true;
const shadowSize = 1024;
sun.shadow.mapSize.set(shadowSize, shadowSize);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);

// Controls
function setupControls() {
  if (controls) {
    try {
      controls.dispose();
    } catch (e) {}
  }
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.enablePan = false;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.1;
  controls.maxDistance = 100000;
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };
  controls.addEventListener("change", clampCameraPan);
  controls.addEventListener("change", () => requestRender(30));
  controls.addEventListener("start", () => requestRender(60));
  controls._hasPanClamp = true;
}
setupControls();

// Окружение EXR
const exrLoader = new EXRLoader();
let envLoaded = false;
let groundMesh = null;
let cachedEnvTexture = null;

export function ensureEnvironmentActive() {
  if (cachedEnvTexture) {
    scene.background = cachedEnvTexture;
    scene.environment = cachedEnvTexture;
    if (groundMesh) groundMesh.visible = true;
    requestRender(20);
  } else {
    loadEnvironmentOnce();
  }
}

// фон / окружение / hdri / трава (с защитой от сбоя и запасным оффлайн-освещением)
function loadEnvironmentOnce() {
  if (cachedEnvTexture) {
    ensureEnvironmentActive();
    return;
  }
  if (envLoaded) return;

  exrLoader.setPath("./hdr/");
  exrLoader.load(
    "lilienstein_1k.exr",
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      cachedEnvTexture = texture;
      scene.background = texture;
      scene.environment = texture;
      if (groundMesh) groundMesh.visible = true;
      envLoaded = true;
      requestRender(20);
    },
    undefined,
    (err) => {
      console.warn("EXR фон lilienstein_1k.exr не загружен или не поддерживается GPU. Применяем надежный оффлайн fallback:", err);
      scene.background = new THREE.Color(0xdce7ef);
      hemi.intensity = 1.1;
      sun.intensity = 0.7;
      envLoaded = true;
      requestRender(20);
    }
  );
}

// Установка начального размера по контейнеру (с защитой от схлопывания 0x0)
export function sizeFromContainer(force = false) {
  if (!container || !renderer) return;
  const rect = container.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);

  if (w < 10 || h < 10) {
    // Контейнер скрыт или схлопнут (например, активен 2D режим)
    lastContainerWidth = 0;
    lastContainerHeight = 0;
    return;
  }

  if (!force && w === lastContainerWidth && h === lastContainerHeight) {
    return;
  }

  lastContainerWidth = w;
  lastContainerHeight = h;

  const pr = getOptimalPixelRatio();
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  requestRender(10);
}
sizeFromContainer(true);

// Loaders
const loader = new GLTFLoader();

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
  currentModelKey = null;
  if (!currentModel) return;
  scene.remove(currentModel);
  disposeObject(currentModel);
  currentModel = null;
  modelMaterials.clear();
  originalModelMaterials.clear();
  activeZoneTextures.facade = null;
  activeZoneTextures.accent = null;
  activeZoneTextures.plinth = null;
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
  const options = typeof opts === "number" ? { offset: opts } : opts;
  const {
    offset = 1.35,
    azimuthDeg = 222,
    startHeightRatio = 0.25,
    minZoomRatio = 0.45,
    maxZoomRatio = 2.0,
    minDistance = null,
    maxDistance = null,
    near = null,
  } = options;

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

  // Расчет camera.near: защита от срезания геометрии перед камерой
  if (near !== null) {
    camera.near = near;
  } else if (baseDistance > 100) {
    camera.near = Math.max(0.5, baseDistance / 500);
  } else {
    camera.near = 0.1;
  }
  camera.far = Math.max(10000, baseDistance * 10);
  camera.updateProjectionMatrix();

  // Контроллер
  controls.target.set(center.x, targetY, center.z);

  // Геометро-безопасная минимальная дистанция (камера не проваливается сквозь стены и столбы)
  const halfX = size.x * 0.5;
  const halfZ = size.z * 0.5;
  const cornerRadius = Math.hypot(halfX, halfZ);
  const safeMinDist = cornerRadius * 1.10;

  if (minDistance !== null) {
    controls.minDistance = Math.max(minDistance, safeMinDist);
  } else {
    controls.minDistance = Math.max(baseDistance * minZoomRatio, safeMinDist);
  }
  controls.maxDistance = maxDistance !== null ? maxDistance : baseDistance * maxZoomRatio;

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
      if (!groundMesh) {
        const groundGeo = new THREE.PlaneGeometry(200, 200);
        // ShadowMaterial делает пол почти прозрачным, но с видимыми тенями
        const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
        groundMesh = new THREE.Mesh(groundGeo, groundMat);
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.position.y = 0;
        groundMesh.receiveShadow = true;
        scene.add(groundMesh);
      }

      const currentSel = getCurrentSelection();
      const isReady = allModulesSelected(currentSel);
      currentModel.visible = isReady;
      if (groundMesh) groundMesh.visible = isReady;
      if (isReady) {
        ensureEnvironmentActive();
      }
      fitCameraToObject(currentModel, { offset: 1.35, ...(cfg.camera || {}) });

      modelMaterials.clear();
      originalModelMaterials.clear();
      const mats = extractModelMaterials(currentModel);
      mats.forEach((mat, name) => {
        modelMaterials.set(name, mat);
        originalModelMaterials.set(name, deepCloneMaterial(mat));
      });

      // Подготавливаем кирпичные материалы (Bricks026, BricksAccent)
      ["Bricks026", "BricksAccent"].forEach((matName) => {
        const mat = modelMaterials.get(matName);
        if (mat) {
          const MAP_KEYS = [
            "map", "normalMap", "bumpMap", "roughnessMap", "metalnessMap",
            "aoMap", "displacementMap", "emissiveMap", "alphaMap",
            "lightMap", "specularMap", "envMap",
          ];
          MAP_KEYS.forEach((k) => {
            if (mat[k]) {
              mat[k].dispose?.();
              mat[k] = null;
            }
          });
          if (mat.color) mat.color.set(0xffffff);
          mat.roughness = 0.85;
          mat.metalness = 0.0;
          mat.needsUpdate = true;
        }
      });

      originalTargetMaterial = originalModelMaterials.get(TARGET_MATERIAL_NAME) || null;

      // Настройка реалистичного архитектурного остекления окон (устраняет просвечивание внутренних пустот/стен)
      const glassMat = modelMaterials.get("Translucent_Glass_Gray");
      if (glassMat) {
        glassMat.transparent = true;
        glassMat.opacity = 0.88;
        glassMat.color = new THREE.Color(0x182430); // Глубокий оттенок архитектурного стекла
        glassMat.roughness = 0.08;
        glassMat.metalness = 0.90; // Зеркальное отражение неба и окружения
        if (glassMat.transmission !== undefined) glassMat.transmission = 0.0;
        glassMat.envMapIntensity = 2.0;
        glassMat.needsUpdate = true;
      }

      console.log(`Найдено материалов: ${modelMaterials.size}`);
      console.log("Материалы модели:");
      for (const name of modelMaterials.keys()) console.log(" -", name);

      modelLoaded = true;
      currentModelKey = key;
      resolve();
    } catch (err) {
      currentModelKey = null;
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

function updateModelVisibilityAndHint() {
  const sel = getCurrentSelection();
  const ready = allModulesSelected(sel);
  const hintOverlay = document.getElementById("hintOverlay3D");

  if (hintOverlay) {
    if (ready) {
      hintOverlay.classList.add("is-hidden");
      hintOverlay.style.display = "none";
    } else {
      hintOverlay.classList.remove("is-hidden");
      hintOverlay.style.display = "flex";
    }
  }

  if (currentModel) {
    currentModel.visible = ready;
  }
  if (groundMesh) {
    groundMesh.visible = ready;
  }
  if (ready) {
    ensureEnvironmentActive();
  }
  requestRender(20);
}

function updateLoadAvailability() {
  const sel = getCurrentSelection();
  const ready = allModulesSelected(sel);
  if (loadBtn) loadBtn.disabled = !ready;
  window.dispatchEvent(new CustomEvent("selection-updated", { detail: { available: ready, selection: sel } }));
  updateModelVisibilityAndHint();
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
export function mapBrickColor(tagColor) {
  switch (tagColor) {
    case "gray":
      return "#a8b0b8"; // Серо-голубой
    case "gray2":
      return "#8f9ba5"; // Тёмно-серый
    case "pink":
      return "#e8a89a"; // Розово-персиковый
    case "peach":
      return "#f0b8a0"; // Персиковый
    case "beige":
      return "#e8d4a8"; // Бежево-кремовый
    case "cream":
      return "#f0e8d8"; // Кремово-белый
    default:
      return "#d4d4d4";
  }
}

export function mapMortarColor(tagColor) {
  switch (tagColor) {
    case "black":
      return "#0B0B0BFF";
    case "white":
      return "#A7A7A7FF";
    default:
      return "#fff";
  }
}

export function mapBrickPixelSize(sizeTag) {
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

// Генератор canvas-текстуры кирпичной кладки сверхвысокого разрешения (2048x2048)
export function createBrickCanvas(params, existingCanvas = null) {
  const texSize = existingCanvas ? existingCanvas.width : (params.texSize || 2048);
  const scaleRatio = texSize / 1024;
  const {
    brickColor = "#b5372a",
    mortarColor = "#bfbfbf",
    layout = "running",
    mosaicColors = null,
  } = params;

  const targetStepY = (params.brickPixelSize[1] + params.jointThickness) * scaleRatio;

  let countY = Math.round(texSize / targetStepY);
  if (countY % 2 !== 0) countY++;

  const stepY = texSize / countY;

  const targetStepX = (params.brickPixelSize[0] + params.jointThickness) * scaleRatio;
  const countX = Math.round(texSize / targetStepX);
  const stepX = texSize / countX;

  const joint = params.jointThickness * scaleRatio;
  const brickW = stepX - joint;
  const brickH = stepY - joint;

  const canvas = existingCanvas || document.createElement("canvas");
  if (canvas.width !== texSize) canvas.width = texSize;
  if (canvas.height !== texSize) canvas.height = texSize;
  const ctx = canvas.getContext("2d");

  // Заливка швов базовым цветом раствора
  ctx.fillStyle = mortarColor;
  ctx.fillRect(0, 0, texSize, texSize);

  // Мягкая микротекстура цементного раствора для устранения "пластикового" вида
  const isLightMortar = mortarColor === "#ffffff" || mortarColor.toLowerCase() === "#a7a7a7" || mortarColor.toLowerCase() === "#fff";
  ctx.fillStyle = isLightMortar ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.06)";
  const grainStep = Math.max(2, Math.round(3 * scaleRatio));
  for (let gy = 0; gy < texSize; gy += grainStep * 2) {
    for (let gx = 0; gx < texSize; gx += grainStep * 2) {
      if ((gx * 17 + gy * 31) % 7 < 3) {
        ctx.fillRect(gx, gy, grainStep, grainStep);
      }
    }
  }

  // Поддержка мозаики
  const hasMosaic = Array.isArray(mosaicColors) && mosaicColors.length > 1;
  let cumulative = [];
  if (hasMosaic) {
    const totalRatio = mosaicColors.reduce((sum, item) => sum + (Number(item.ratio) || 0), 0);
    let acc = 0;
    cumulative = mosaicColors.map((item) => {
      const r = (totalRatio > 0) ? (Number(item.ratio) || 0) / totalRatio : (1 / mosaicColors.length);
      acc += r;
      return { color: item.color, threshold: acc };
    });
    if (cumulative.length > 0) {
      cumulative[cumulative.length - 1].threshold = 1.0;
    }
  }

  function getBrickColor(col, row, totalCols) {
    if (!hasMosaic) {
      return (Array.isArray(mosaicColors) && mosaicColors.length === 1 && mosaicColors[0]?.color)
        ? mosaicColors[0].color
        : brickColor;
    }
    const gridX = ((col % totalCols) + totalCols) % totalCols;
    const gridY = ((row % countY) + countY) % countY;
    const hash = Math.abs(Math.sin(gridX * 127.1 + gridY * 311.7) * 43758.5453) % 1;
    for (const item of cumulative) {
      if (hash <= item.threshold) {
        return item.color;
      }
    }
    return cumulative[cumulative.length - 1].color;
  }

  // Отрисовка отдельного кирпича с объемной фаской и светотенью
  function renderSingleBrick(bx, by, bw, bh, col, row, totalCols) {
    const baseColor = getBrickColor(col, row, totalCols);

    // 1. Тело кирпича
    ctx.fillStyle = baseColor;
    ctx.fillRect(bx, by, bw, bh);

    // 2. Фаска (объемные края)
    const bevel = Math.max(1, Math.round(2 * scaleRatio));

    // Верхний и левый край: мягкий световой блик (ловит свет)
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(bx, by, bw, bevel);
    ctx.fillRect(bx, by, bevel, bh);

    // Нижний и правый край: мягкая тень от заглубленного шва
    ctx.fillStyle = "rgba(0, 0, 0, 0.20)";
    ctx.fillRect(bx, by + bh - bevel, bw, bevel);
    ctx.fillRect(bx + bw - bevel, by, bevel, bh);
  }
  
  for (let yCount = 0; yCount < countY; yCount++) {
    const y = yCount * stepY;

    // КЛАДКА 2: 3 ряда ложковых, 1 ряд тычковый (Пачка из 4 рядов)
    if (layout === "multirow") {
      const isHeaderRow = (yCount % 4 === 3); 

      const targetStepX = (params.brickPixelSize[0] + params.jointThickness) * scaleRatio;
      const countX = Math.round(texSize / targetStepX);
      const stepX = texSize / countX; 
      const brickW = stepX - joint;

      const headerStepX = stepX / 2;
      const headerBrickW = headerStepX - joint;
      const headerCountX = countX * 2;

      if (isHeaderRow) {
        const headerRowOffset = stepX * 0.25 - joint / 2;

        for (let xCount = -2; xCount <= headerCountX + 2; xCount++) {
          let x = xCount * headerStepX + headerRowOffset;

          if (x < 0 && x + headerBrickW > 0 && (x + headerBrickW) < (headerBrickW * 0.3)) {
            x -= (headerBrickW * 0.5); 
          }

          renderSingleBrick(x, y, headerBrickW, brickH, xCount, yCount, headerCountX);

          if (x + headerBrickW > texSize) renderSingleBrick(x - texSize, y, headerBrickW, brickH, xCount, yCount, headerCountX);
          if (x < 0) renderSingleBrick(x + texSize, y, headerBrickW, brickH, xCount, yCount, headerCountX);
        }
      } else {
        const spoonIndex = yCount % 4; 
        
        let spoonOffset = -joint / 2;
        if (spoonIndex === 1) {
          spoonOffset += stepX * 0.5;
        }

        for (let xCount = -2; xCount <= countX + 2; xCount++) {
          let x = xCount * stepX + spoonOffset;

          if (x < 0 && x + brickW > 0 && (x + brickW) < (brickW * 0.3)) {
            x -= (brickW * 0.5);
          }

          renderSingleBrick(x, y, brickW, brickH, xCount, yCount, countX);

          if (x + brickW > texSize) renderSingleBrick(x - texSize, y, brickW, brickH, xCount, yCount, countX);
          if (x < 0) renderSingleBrick(x + texSize, y, brickW, brickH, xCount, yCount, countX);
        }
      }
    }

    // КЛАДКА 3: 5 рядов ложковых, 1 ряд тычковый (Пачка из 6 рядов)
    else if (layout === "multirow_5_1") {
      const isHeaderRow = (yCount % 6 === 5); 

      const targetStepX = (params.brickPixelSize[0] + params.jointThickness) * scaleRatio;
      const countX = Math.round(texSize / targetStepX);
      const stepX = texSize / countX; 
      const brickW = stepX - joint;

      const headerStepX = stepX / 2;
      const headerBrickW = headerStepX - joint;
      const headerCountX = countX * 2;

      if (isHeaderRow) {
        const headerRowOffset = stepX * 0.25 - joint / 2;

        for (let xCount = -2; xCount <= headerCountX + 2; xCount++) {
          let x = xCount * headerStepX + headerRowOffset;

          if (x < 0 && x + headerBrickW > 0 && (x + headerBrickW) < (headerBrickW * 0.3)) {
            x -= (headerBrickW * 0.5); 
          }

          renderSingleBrick(x, y, headerBrickW, brickH, xCount, yCount, headerCountX);

          if (x + headerBrickW > texSize) renderSingleBrick(x - texSize, y, headerBrickW, brickH, xCount, yCount, headerCountX);
          if (x < 0) renderSingleBrick(x + texSize, y, headerBrickW, brickH, xCount, yCount, headerCountX);
        }
      } else {
        const spoonIndex = yCount % 6; 
        
        let spoonOffset = -joint / 2;
        if (spoonIndex === 1 || spoonIndex === 3) {
          spoonOffset += stepX * 0.5;
        }

        for (let xCount = -2; xCount <= countX + 2; xCount++) {
          let x = xCount * stepX + spoonOffset;

          if (x < 0 && x + brickW > 0 && (x + brickW) < (brickW * 0.3)) {
            x -= (brickW * 0.5);
          }

          renderSingleBrick(x, y, brickW, brickH, xCount, yCount, countX);

          if (x + brickW > texSize) renderSingleBrick(x - texSize, y, brickW, brickH, xCount, yCount, countX);
          if (x < 0) renderSingleBrick(x + texSize, y, brickW, brickH, xCount, yCount, countX);
        }
      }
    }

    else {
      // Ложковая логика (running, stack)
      const isOffsetRow = layout === "running" && yCount % 2 !== 0;

      for (let xCount = -1; xCount <= countX; xCount++) {
        let x = xCount * stepX;
        if (isOffsetRow) x += stepX / 2;

        renderSingleBrick(x, y, brickW, brickH, xCount, yCount, countX);

        if (isOffsetRow && xCount === countX - 1) {
          renderSingleBrick(x - texSize, y, brickW, brickH, xCount, yCount, countX);
        }
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
  tex.repeat.set(1, 1);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = Math.min(4, renderer?.capabilities?.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4);
  tex.encoding = THREE.sRGBEncoding;
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

  console.warn(`[Material] Нет точного совпадения. Показана исходная модель (без текстуры на "${TARGET_MATERIAL_NAME}").`);
}
function setupWorldUV(material, brickScale = 0.25, offset = { x: 0, y: 0.12 }) {
  if (material.userData.uBrickScale && material.userData.uOffset) {
    material.userData.uBrickScale.value = brickScale;
    material.userData.uOffset.value.set(offset.x, offset.y);
    return;
  }
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
              blending = pow(blending, vec3(16.0)); // Сбалансированная резкость без ступенчатых пикселей
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
/**
 * Наложение процедурной кирпичной текстуры на конкретный материал по имени
 */
export function applyBrickTextureToMaterial(matName, canvasParams, brickScale = 0.25, currentOffset = { x: 0.0, y: 0.12 }) {
  const targetMat = modelMaterials.get(matName);
  if (!targetMat) {
    console.warn(`Материал "${matName}" не найден в модели`);
    return false;
  }

  if (targetMat.map) {
    targetMat.map.dispose?.();
    targetMat.map = null;
  }

  const canvas = createBrickCanvas(canvasParams);
  const tex = new THREE.CanvasTexture(canvas);

  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = Math.min(16, renderer?.capabilities?.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 16);
  tex.encoding = THREE.sRGBEncoding;
  tex.needsUpdate = true;

  targetMat.map = tex;
  if (targetMat.color) targetMat.color.set(0xffffff);
  targetMat.roughness = 0.85;
  targetMat.metalness = 0.0;
  targetMat.needsUpdate = true;

  setupWorldUV(targetMat, brickScale, currentOffset);
  ensureEnvironmentActive();
  targetMat.envMapIntensity = 0.5;

  if (currentModel) {
    currentModel.visible = true;
  }
  return true;
}

export function getCurrentBrickScale() {
  const slider = document.getElementById("brick-scale-slider");
  if (slider && !isNaN(parseFloat(slider.value))) {
    return parseFloat(slider.value);
  }
  return 0.25;
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

  const tags = matchedCfg.tags || {};
  const [brickW, brickH] = mapBrickPixelSize(tags.size || "");

  const canvasParams = {
    brickColor: mapBrickColor(tags.color_brick || "red"),
    mortarColor: mapMortarColor(tags.color_rastvor || "black"),
    layout: tags.layout || "running",
    brickPixelSize: [brickW, brickH],
    jointThickness: 4,
    ...(matchedCfg.params || {}),
  };

  const brickScale = getCurrentBrickScale();
  const currentOffset = { x: 0.0, y: 0.12 };

  // Если для фасада уже была задана активная мозаика, учитываем её или применяем одиночный цвет
  const facadeParams = activeZoneTextures.facade && activeZoneTextures.facade.mosaicColors
    ? { ...canvasParams, mosaicColors: activeZoneTextures.facade.mosaicColors }
    : canvasParams;

  applyBrickTextureToMaterial(TARGET_MATERIAL_NAME, facadeParams, brickScale, currentOffset);
  activeZoneTextures.facade = facadeParams;

  // Если в модели есть BricksAccent (эркер и простенки трехэтажного дома):
  if (modelMaterials.has("BricksAccent")) {
    if (activeZoneTextures.accent) {
      applyBrickTextureToMaterial("BricksAccent", { ...canvasParams, ...activeZoneTextures.accent }, brickScale, currentOffset);
    } else {
      // ИСПРАВЛЕНИЕ: Применяем тот же выбранный кирпич, чтобы вся модель окрашивалась на 100% целиком
      applyBrickTextureToMaterial("BricksAccent", canvasParams, brickScale, currentOffset);
    }
  }

  updateStatus("Текстура успешно применена (Scale: " + brickScale + ")");
  console.log(`Применена текстура: ${matchedCfg.key}`, canvasParams);
}

/**
 * Применение мозаики ко всем стенам модели
 * @param {string} zone - 'all'
 * @param {Object} options - { mosaicColors, brickColor, mortarColor, layout, brickPixelSize, jointThickness }
 */
export function applyZoneMosaic(zone, options = {}) {
  const sel = getCurrentSelection();
  const [defW, defH] = mapBrickPixelSize(sel.size || "250x120x65");
  const defMortar = mapMortarColor(sel.color_rastvor || "black");
  const defLayout = sel.layout || "running";

  const canvasParams = {
    brickColor: options.brickColor || mapBrickColor(sel.color_brick || "gray"),
    mortarColor: options.mortarColor || defMortar,
    layout: options.layout || defLayout,
    brickPixelSize: options.brickPixelSize || [defW, defH],
    jointThickness: options.jointThickness || 4,
    mosaicColors: options.mosaicColors || null,
  };

  const brickScale = getCurrentBrickScale();
  const currentOffset = { x: 0.0, y: 0.12 };

  // Применяем мозаику ко всем кирпичным стенам (основные + акцентный эркер)
  activeZoneTextures.facade = canvasParams;
  activeZoneTextures.accent = canvasParams;

  let applied = false;
  if (modelLoaded && currentModel) {
    const canvas = createBrickCanvas(canvasParams);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = Math.min(4, renderer?.capabilities?.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4);
    tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;

    ["Bricks026", "BricksAccent"].forEach((matName) => {
      const targetMat = modelMaterials.get(matName);
      if (targetMat) {
        if (targetMat.map) targetMat.map.dispose?.();
        targetMat.map = tex;
        if (targetMat.color) targetMat.color.set(0xffffff);
        targetMat.roughness = 0.85;
        targetMat.metalness = 0.0;
        targetMat.needsUpdate = true;
        setupWorldUV(targetMat, brickScale, currentOffset);
        targetMat.envMapIntensity = 0.5;
        applied = true;
      }
    });
    ensureEnvironmentActive();
    if (currentModel) currentModel.visible = true;
    requestRender(20);
  }

  updateStatus("Мозаика успешно применена ко всем стенам");
  window.dispatchEvent(new CustomEvent("facade-mosaic-applied", { detail: { zone: "all", params: canvasParams } }));
  return applied;
}

/**
 * Сброс мозаики стен в обычный кирпич
 */
export function resetZoneMosaic(zone) {
  const sel = getCurrentSelection();
  const [defW, defH] = mapBrickPixelSize(sel.size || "250x120x65");
  const defMortar = mapMortarColor(sel.color_rastvor || "black");
  const defLayout = sel.layout || "running";
  const defColor = mapBrickColor(sel.color_brick || "gray");

  const monoParams = {
    brickColor: defColor,
    mortarColor: defMortar,
    layout: defLayout,
    brickPixelSize: [defW, defH],
    jointThickness: 4,
    mosaicColors: null,
  };

  const brickScale = getCurrentBrickScale();
  const currentOffset = { x: 0.0, y: 0.12 };

  activeZoneTextures.facade = monoParams;
  activeZoneTextures.accent = monoParams;

  if (modelLoaded && currentModel) {
    const canvas = createBrickCanvas(monoParams);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = Math.min(4, renderer?.capabilities?.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4);
    tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;

    ["Bricks026", "BricksAccent"].forEach((matName) => {
      const targetMat = modelMaterials.get(matName);
      if (targetMat) {
        if (targetMat.map) targetMat.map.dispose?.();
        targetMat.map = tex;
        if (targetMat.color) targetMat.color.set(0xffffff);
        targetMat.roughness = 0.85;
        targetMat.metalness = 0.0;
        targetMat.needsUpdate = true;
        setupWorldUV(targetMat, brickScale, currentOffset);
        targetMat.envMapIntensity = 0.5;
      }
    });
    ensureEnvironmentActive();
    if (currentModel) currentModel.visible = true;
    requestRender(20);
  }

  updateStatus("Все стены сброшены в обычный кирпич");
  window.dispatchEvent(new CustomEvent("facade-mosaic-applied", { detail: { zone: "all", params: monoParams } }));
}

export function getActiveZoneTextures() {
  return { ...activeZoneTextures };
}

export function getCurrentBrickParams() {
  const sel = getCurrentSelection();
  const [brickW, brickH] = mapBrickPixelSize(sel.size || "250x120x65");
  return {
    brickColor: mapBrickColor(sel.color_brick || "gray"),
    mortarColor: mapMortarColor(sel.color_rastvor || "black"),
    layout: sel.layout || "running",
    brickPixelSize: [brickW, brickH],
    jointThickness: 4,
    modelLoaded,
    hasAccentMaterial: modelMaterials.has("BricksAccent"),
    hasPlinthMaterial: modelMaterials.has("Concrete05"),
  };
}

// Применяем текущую конфигурацию к уже загруженной модели (или откатываем)
export function applySelectionToLoadedModel() {
  const sel = getCurrentSelection();
  const ready = allModulesSelected(sel);

  updateModelVisibilityAndHint();

  if (!ready) {
    if (currentModel) currentModel.visible = false;
    if (groundMesh) groundMesh.visible = false;
    return;
  }

  if (!modelLoaded || !currentModel) return;

  const matched = findExactTextureByTags(sel);

  if (!matched) {
    // Точного совпадения нет
    console.warn(`[Configurator] Точного совпадения нет для параметров:`, sel);
    restoreOriginalTargetMaterial();
    if (currentModel) currentModel.visible = false;
    if (groundMesh) groundMesh.visible = false;
    return;
  }

  // Для процедурной текстуры нет асинхронной загрузки — обновляем сразу
  applyMatchedTextureToTarget(matched);
  if (currentModel) currentModel.visible = true;
  if (groundMesh) groundMesh.visible = true;
  ensureEnvironmentActive();
  updateModelVisibilityAndHint();
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

// Ограничение цветов кирпича в зависимости от размера
// На заводе ЧЗСК единственный кирпич 250×120×65 — рядовой (gray). Цветные кирпичи — только 250×120×88.
export function updateColorAvailabilityBySize() {
  const currentSize = document.querySelector('input[name="size"]:checked')?.value;
  const isSingle = currentSize === "250x120x65";
  const colorRadios = radiosColorBrick();

  const mosaicBtn = document.getElementById("mosaicBtn");
  if (mosaicBtn) {
    if (isSingle) {
      mosaicBtn.disabled = true;
      mosaicBtn.classList.add("btn-disabled");
      mosaicBtn.setAttribute("title", "Мозаика недоступна для размера 250×120×65 (доступен только рядовой цвет)");
      // Если пользователь переключился на 250x120x65 в то время, когда была наложена мозаика — сбрось мозаику в обычный цвет
      if (activeZoneTextures.facade?.mosaicColors || activeZoneTextures.accent?.mosaicColors) {
        resetZoneMosaic("all");
      }
    } else {
      mosaicBtn.disabled = false;
      mosaicBtn.classList.remove("btn-disabled");
      mosaicBtn.setAttribute("title", "Конструктор мозаики");
    }
  }

  colorRadios.forEach((radio) => {
    const label = radio.closest("label");
    if (isSingle) {
      if (radio.value !== "gray") {
        radio.disabled = true;
        if (label) {
          label.classList.add("color-tile-disabled");
          label.setAttribute("title", "Доступен только в размере 250×120×88 на заводе ЧЗСК");
        }
      } else {
        radio.disabled = false;
        if (label) {
          label.classList.remove("color-tile-disabled");
          label.setAttribute("title", "Серо-голубой (рядовой 200/50)");
        }
      }
    } else {
      radio.disabled = false;
      if (label) {
        label.classList.remove("color-tile-disabled");
        const originalTitles = {
          gray: "Серо-голубой",
          gray2: "Тёмно-серый",
          pink: "Розово-персиковый",
          peach: "Персиковый",
          beige: "Бежево-кремовый",
          cream: "Кремово-белый",
        };
        label.setAttribute("title", originalTitles[radio.value] || "");
      }
    }
  });

  // Если выбран 250x120x65 и сейчас был выбран недоступный цвет — переключаем на gray
  if (isSingle) {
    const checkedColor = document.querySelector('input[name="color_brick"]:checked');
    if (!checkedColor || checkedColor.value !== "gray") {
      const grayRadio = document.querySelector('input[name="color_brick"][value="gray"]');
      if (grayRadio) {
        grayRadio.checked = true;
        grayRadio.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }
}

// ================= СОХРАНЕНИЕ И ВОССТАНОВЛЕНИЕ СОСТОЯНИЯ =================
const STATE_STORAGE_KEY = "threejsbrick_active_state_v1";

function saveActiveState() {
  const sel = getCurrentSelection();
  if (!sel.modelKey) return;
  const state = {
    modelKey: sel.modelKey,
    size: sel.size,
    layout: sel.layout,
    color_brick: sel.color_brick,
    color_rastvor: sel.color_rastvor,
  };
  try {
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

function restoreActiveState() {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (!state || !state.modelKey) return null;

    if (modelSelect) {
      modelSelect.value = state.modelKey;
    }

    const setRadio = (name, val) => {
      if (!val) return;
      const r = document.querySelector(`input[name="${name}"][value="${val}"]`);
      if (r) r.checked = true;
    };

    setRadio("size", state.size);
    updateColorAvailabilityBySize();
    setRadio("layout", state.layout);
    setRadio("color_brick", state.color_brick);
    setRadio("color_rastvor", state.color_rastvor);

    updateLoadAvailability();
    return state;
  } catch (e) {
    return null;
  }
}

function attachSelectionListeners() {
  modelSelect.addEventListener("change", async () => {
    updateLoadAvailability();
    updateModelVisibilityAndHint();
    saveActiveState();
    const sel = getCurrentSelection();
    if (sel.modelKey) {
      if (modelLoaded && currentModel && currentModelKey === sel.modelKey) {
        applySelectionToLoadedModel();
        return;
      }
      try {
        await loadModelByKey(sel.modelKey);
        applySelectionToLoadedModel();
        ensureEnvironmentActive();
        requestRender(20);
      } catch (e) {
        console.warn("Ошибка переключения модели:", e);
      }
    } else {
      unloadCurrentModel();
      updateModelVisibilityAndHint();
      requestRender(10);
    }
  });

  const is2DModeActive = () => {
    const card2D = document.getElementById("card2D");
    return Boolean(card2D && window.getComputedStyle(card2D).display !== "none");
  };

  const handleRadioChange = () => {
    // Если объект не выбран, автоматически выбираем первый доступный объект
    if (!modelSelect.value && modelSelect.options.length > 1) {
      modelSelect.value = modelSelect.options[1].value;
    }

    // Если раствор не выбран, но выбран цвет кирпича — по умолчанию черный раствор
    const checkedRastvor = document.querySelector('input[name="color_rastvor"]:checked');
    if (!checkedRastvor) {
      const defaultRastvor = document.querySelector('input[name="color_rastvor"][value="black"]');
      if (defaultRastvor) defaultRastvor.checked = true;
    }

    updateLoadAvailability();
    if (!is2DModeActive()) {
      const sel = getCurrentSelection();
      if (sel.modelKey && allModulesSelected(sel)) {
        if (!modelLoaded) {
          loadModelByKey(sel.modelKey)
            .then(() => {
              applySelectionToLoadedModel();
              ensureEnvironmentActive();
              requestRender(20);
            })
            .catch((err) => console.warn("Ошибка загрузки модели:", err));
        } else {
          applySelectionToLoadedModel();
          ensureEnvironmentActive();
          requestRender(20);
        }
      }
    }
    updateModelVisibilityAndHint();
    saveActiveState();
    requestRender(20);
  };

  // Отслеживаем смену размера для блокировки цветов ЧЗСК
  radiosSize().forEach((r) => {
    r.addEventListener("change", () => {
      updateColorAvailabilityBySize();
      handleRadioChange();
    });
  });

  radiosLayout().forEach((r) => {
    r.addEventListener("change", handleRadioChange);
  });

  radiosColorBrick().forEach((r) => {
    r.addEventListener("change", () => {
      // Сбрасываем мозаику при выборе конкретного цвета кирпича
      activeZoneTextures.facade = null;
      activeZoneTextures.accent = null;
      handleRadioChange();
    });
  });

  radiosColorRastvor().forEach((r) => {
    r.addEventListener("change", handleRadioChange);
  });

  // Интерактивный ползунок масштаба кладки
  const brickScaleSlider = document.getElementById("brick-scale-slider");
  const brickScaleValue = document.getElementById("brick-scale-value");
  if (brickScaleSlider) {
    brickScaleSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (brickScaleValue) brickScaleValue.textContent = val.toFixed(1);
      ["Bricks026", "BricksAccent"].forEach((matName) => {
        const mat = modelMaterials.get(matName);
        if (mat && mat.userData && mat.userData.uBrickScale) {
          mat.userData.uBrickScale.value = val;
        }
      });
    });
  }
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
  updateColorAvailabilityBySize();
  updateLoadAvailability();

  // Восстановление ранее выбранной конфигурации и модели
  const restored = restoreActiveState();

  // Если состояние не было сохранено (первый визит) — выставляем дефолт
  if (!restored || !restored.modelKey) {
    if (modelSelect && modelSelect.options.length > 1) {
      modelSelect.value = modelSelect.options[1].value;
    }
    const setDefaultRadio = (name, val) => {
      const r = document.querySelector(`input[name="${name}"][value="${val}"]`);
      if (r) r.checked = true;
    };
    setDefaultRadio("size", "250x120x88");
    setDefaultRadio("layout", "running");
    setDefaultRadio("color_brick", "gray");
    setDefaultRadio("color_rastvor", "black");
    updateColorAvailabilityBySize();
    updateLoadAvailability();
    saveActiveState();
  }

  if (loadBtn) {
    loadBtn.addEventListener("click", async () => {
      const sel = getCurrentSelection();
      if (!allModulesSelected(sel)) return;

      // Если модель уже загружена и ключ совпадает — не перезагружаем тяжелый GLTF!
      // Мгновенно применяем выбранный кирпич/текстуру
      if (modelLoaded && currentModel && currentModelKey === sel.modelKey) {
        applySelectionToLoadedModel();
        saveActiveState();
        return;
      }

      try {
        await loadModelByKey(sel.modelKey);
        applySelectionToLoadedModel();
        saveActiveState();
      } catch (e) {
        // ошибки уже обработаны внутри
      }
    });
  }

  // Загружаем активную модель сразу при открытии страницы
  const activeSel = getCurrentSelection();
  if (activeSel.modelKey && allModulesSelected(activeSel)) {
    loadModelByKey(activeSel.modelKey)
      .then(() => {
        applySelectionToLoadedModel();
      })
      .catch((err) => {
        console.warn("Автозагрузка модели не удалась:", err);
      });
  } else {
    updateModelVisibilityAndHint();
  }

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

    // Сохраняем приятный небесный фон сцены (НЕ черный void!)
    scene.background = new THREE.Color(0xdce7ef);
    if (groundMesh) groundMesh.visible = false;

    try {
      localStorage.removeItem(STATE_STORAGE_KEY);
    } catch (e) {}

    updateColorAvailabilityBySize();
    updateLoadAvailability();
    updateModelVisibilityAndHint();
    updateStatus("Состояние сцены сброшено");
    requestRender(10);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI);
} else {
  initUI();
}

// Подстраиваем камеру/рендер под блок с 3D с троттлингом через requestAnimationFrame
let resizeRafId = null;
const handleResizeDebounced = () => {
  if (resizeRafId) cancelAnimationFrame(resizeRafId);
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null;
    sizeFromContainer();
    requestRender(10);
  });
};

const ro = new ResizeObserver(handleResizeDebounced);
ro.observe(container);

window.addEventListener("resize", handleResizeDebounced);

window.addEventListener("view-mode-changed", (e) => {
  if (e.detail?.mode === "3D") {
    if (modelLoaded && currentModel) {
      applySelectionToLoadedModel();
    }
    requestAnimationFrame(() => {
      sizeFromContainer(true);
      requestRender(20);
    });
  }
});

// Viewport Culling: отслеживаем видимость контейнера во viewport
if (typeof IntersectionObserver !== "undefined" && container) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        isViewerInViewport = entry.isIntersecting;
        if (isViewerInViewport) {
          requestRender(20);
        }
      });
    },
    { threshold: 0.01 }
  );
  io.observe(container);
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);

  // Если 3D-контейнер не виден на экране — полностью пропускаем рендеринг!
  if (!isViewerInViewport) {
    return;
  }

  let needRender = false;

  if (controls) {
    // controls.update() возвращает true, если камера переместилась (включая damping)
    const moved = controls.update();
    if (moved) {
      needRender = true;
      pendingRenderFrames = Math.max(pendingRenderFrames, 5);
    }
  }

  if (pendingRenderFrames > 0) {
    pendingRenderFrames--;
    needRender = true;
  }

  if (needRender && renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}
animate();

// Глобальный доступ для надежности и тестов
window.THREE = THREE;
window.recoverRenderer = recoverRenderer;
window.__threeApp = {
  get scene() { return scene; },
  get camera() { return camera; },
  get controls() { return controls; },
  get renderer() { return renderer; },
  get currentModel() { return currentModel; },
  get modelLoaded() { return modelLoaded; },
  get currentModelKey() { return currentModelKey; },
  get cachedEnvTexture() { return cachedEnvTexture; },
  get isViewerInViewport() { return isViewerInViewport; },
  get pendingRenderFrames() { return pendingRenderFrames; },
  THREE,
  fitCameraToObject,
  recoverRenderer,
  ensureEnvironmentActive,
  requestRender,
};