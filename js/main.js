// Import the THREE.js library
import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
// Camera controls
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";
// GLTF loader
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";

// =====================
// DOM elements (UI)
// =====================
const container = document.getElementById("container3D");
const modelSelect = document.getElementById("modelSelect");
const unloadBtn = document.getElementById("unloadBtn");

// =====================
// Scene / Camera / Renderer
// =====================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  50000
);
camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// Небольшой бонус для правильной гаммы (sRGB)
if (THREE.sRGBEncoding) {
  renderer.outputEncoding = THREE.sRGBEncoding;
}

container.appendChild(renderer.domElement);

// =====================
// Lights
// =====================
const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.8);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(5, 10, 7);
dir.castShadow = false;
scene.add(dir);

// =====================
// Controls
// =====================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableRotate = true;     // вращение ЛКМ
controls.enableZoom = true;       // колесико
controls.screenSpacePanning = true;
controls.minDistance = 0.1;
controls.maxDistance = 100000;

// =====================
// Model loading
// =====================
const loader = new GLTFLoader();

// Задай пути к моделям под свой проект (если имена файлов другие — поменяй строки)
const MODEL_PATHS = {
  model_four: "./models/nine/scene.gltf", // или model_four.gltf — как у тебя
  six: "./models/ten/scene.gltf"
};

let currentModel = null; // THREE.Object3D (корень загруженной сцены)

// Очистка текущей модели из сцены и памяти
function unloadCurrentModel() {
  if (!currentModel) return;

  scene.remove(currentModel);

  // корректно освобождаем ресурсы
  currentModel.traverse((node) => {
    if (node.isMesh) {
      if (node.geometry) node.geometry.dispose();

      if (node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => {
          // Текстуры
          for (const key in m) {
            const val = m[key];
            if (val && val.isTexture) {
              val.dispose();
            }
          }
          m.dispose?.();
        });
      }
    }
  });

  currentModel = null;
}

// Подгоняем камеру и контролы под размер модели
function fitCameraToObject(obj, offset = 1.2) {
  // Вычисляем сферу, в которую вписывается объект
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = (camera.fov * Math.PI) / 180;
  let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)));

  cameraZ *= offset; // небольшой запас

  // Обновляем позицию камеры и контролы
  camera.position.set(center.x, center.y, center.z + cameraZ);
  camera.near = cameraZ / 100;
  camera.far = cameraZ * 100;
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.maxDistance = cameraZ * 10;
  controls.update();
}

// Загрузка выбранной модели
function loadModel(key) {
  const url = MODEL_PATHS[key];
  if (!url) {
    console.warn(`Не задан путь для модели с ключом "${key}"`);
    return;
  }

  // убрать предыдущую
  unloadCurrentModel();

  loader.load(
    url,
    (gltf) => {
      currentModel = gltf.scene;
      scene.add(currentModel);
      fitCameraToObject(currentModel, 1.5);
      console.log(`Модель "${key}" загружена: ${url}`);
    },
    (xhr) => {
      if (xhr.total) {
        console.log(`${((xhr.loaded / xhr.total) * 100).toFixed(1)}% загружено`);
      } else {
        console.log(`${xhr.loaded} байт загружено`);
      }
    },
    (error) => {
      console.error(`Ошибка загрузки модели "${key}" по пути ${url}:`, error);
      alert(`Не удалось загрузить модель "${key}". Проверь путь к файлу в MODEL_PATHS.`);
    }
  );
}

// =====================
// Events (UI + Resize)
// =====================

// выбор модели из меню
modelSelect.addEventListener("change", (e) => {
  const val = e.target.value;
  if (val === "none") {
    unloadCurrentModel();
  } else {
    loadModel(val);
  }
});

// кнопка "Убрать модель"
unloadBtn.addEventListener("click", () => {
  modelSelect.value = "none";
  unloadCurrentModel();
});

// ресайз
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// =====================
// Render loop
// =====================
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
