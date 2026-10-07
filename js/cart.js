// js/cart.js
// Модуль корзины с отправкой заявки на email через FormSubmit

// ================================================================
// НАСТРОЙКИ
// ================================================================
const RECIPIENT_EMAIL = "26a.l.e.x07@mail.ru"; // ← ЗАМЕНИТЕ НА EMAIL ЗАКАЗЧИКА ПРИ НЕОБХОДИМОСТИ
const FORM_SUBMIT_URL = `https://formsubmit.co/ajax/${RECIPIENT_EMAIL}`;

const BRICK_PRICE = 22.70;              // Базовая цена рядового полуторного кирпича, ₽ за шт.
const STORAGE_KEY = "cart_items_v1";    // ключ корзины
const ORDERS_KEY  = "cart_orders_v1";   // ключ истории заявок

const COLOR_NAMES = {
  gray:  "Серо-голубой",
  gray2: "Тёмно-серый",
  pink:  "Розово-персиковый",
  peach: "Персиковый",
  beige: "Бежево-кремовый",
  cream: "Кремово-белый",
};

const COLOR_HEX = {
  gray:  "#a8b0b8",
  gray2: "#8f9ba5",
  pink:  "#e8a89a",
  peach: "#f0b8a0",
  beige: "#e8d4a8",
  cream: "#f0e8d8",
};

// ================================================================
// АКТУАЛЬНЫЕ ЦЕНЫ И ФОТО ПРОДУКЦИИ ЧЗСК (silicatbrick.ru)
// ================================================================
const COLOR_PRICES = {
  gray: 22.70,   // Кирпич силикатный утолщенный рядовой полнотелый СУРПо М-200
  cream: 21.30,  // Кирпич силикатный утолщенный рядовой пустотелый СУРПу М-150
  gray2: 35.50,  // Кирпич силикатный утолщенный окрашенный «Графит» М-150
  peach: 35.50,  // Кирпич силикатный утолщенный окрашенный «Оранжевый» М-150
  pink: 35.50,   // Кирпич силикатный утолщенный окрашенный «Красный» М-150
  beige: 35.50,  // Кирпич силикатный утолщенный окрашенный «Желтый» М-150
};

const COLOR_PRODUCT_IMAGES = {
  gray: "images/products/utolschennyy_gray.jpg",
  cream: "images/products/utolschennyy_cream.jpg",
  gray2: "images/products/utolschennyy_gray2.jpg",
  peach: "images/products/utolschennyy_peach.jpg",
  pink: "images/products/utolschennyy_pink.jpg",
  beige: "images/products/utolschennyy_beige.jpg",
};

const COLOR_OFFICIAL_NAMES = {
  gray: "Кирпич полнотелый рядовой СУРПо М-200",
  cream: "Кирпич пустотелый рядовой СУРПу М-150",
  gray2: "Кирпич окрашенный «Графит» М-150",
  peach: "Кирпич окрашенный «Оранжевый» М-150",
  pink: "Кирпич окрашенный «Красный» М-150",
  beige: "Кирпич окрашенный «Желтый» М-150",
};

// ================================================================
// СОСТОЯНИЕ
// ================================================================
let cart = loadCart();

// ================================================================
// DOM
// ================================================================
const cartBtn        = document.getElementById("cartBtn");
const cartCount      = document.getElementById("cartCount");
const addToCartBtn   = document.getElementById("addToCartBtn");
const cartColorSel   = document.getElementById("cartColor");
const cartQtyInput   = document.getElementById("cartQty");
const cartPanelTotal = document.getElementById("cartPanelTotal");

const cartModal      = document.getElementById("cartModal");
const cartItemsEl    = document.getElementById("cartItems");
const cartTotalEl    = document.getElementById("cartTotal");
const checkoutBtn    = document.getElementById("checkoutBtn");

const checkoutModal  = document.getElementById("checkoutModal");
const checkoutForm   = document.getElementById("checkoutForm");

const thanksModal    = document.getElementById("thanksModal");

// ================================================================
// ХРАНИЛИЩЕ
// ================================================================
function loadCart() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(data)) return [];
    return data.map((item) => {
      const color = item.color || "gray";
      const officialPrice = COLOR_PRICES[color] || 22.70;
      return {
        ...item,
        price: item.price === 40 || !item.price ? officialPrice : item.price,
        imageUrl: item.imageUrl || COLOR_PRODUCT_IMAGES[color] || "",
        name:
          item.name && !item.name.includes("40")
            ? item.name
            : COLOR_OFFICIAL_NAMES[color] || "Кирпич силикатный • " + (COLOR_NAMES[color] || color),
      };
    });
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

// ================================================================
// ФОРМАТ ЦЕНЫ
// ================================================================
function formatPrice(n) {
  const num = typeof n === "number" ? n : parseFloat(n) || 0;
  return (
    num.toLocaleString("ru-RU", {
      minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
      maximumFractionDigits: 2,
    }) + " ₽"
  );
}

// ================================================================
// ЛОГИКА КОРЗИНЫ
// ================================================================
function cartTotal() {
  return cart.reduce((s, i) => s + i.price * i.qty, 0);
}
function cartCountTotal() {
  return cart.reduce((s, i) => s + i.qty, 0);
}

function addItem(color, qty = 1, customPrice = null, customName = null, customImage = null) {
  const price = customPrice !== null ? customPrice : (COLOR_PRICES[color] || 22.70);
  const name = customName || COLOR_OFFICIAL_NAMES[color] || ("Кирпич силикатный • " + (COLOR_NAMES[color] || color));
  const imageUrl = customImage || COLOR_PRODUCT_IMAGES[color] || "";

  const existing = cart.find((i) => i.name === name && Math.abs(i.price - price) < 0.01);
  if (existing) {
    existing.qty += qty;
    if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
  } else {
    cart.push({
      color,
      name,
      price,
      imageUrl,
      qty,
    });
  }
  saveCart();
  renderAll();
}

function removeItem(index) {
  cart.splice(index, 1);
  saveCart();
  renderAll();
}

function changeQty(index, delta) {
  const item = cart[index];
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
  renderAll();
}

// ================================================================
// РЕНДЕР
// ================================================================
function renderAll() {
  renderCount();
  renderCartModal();
  renderPanelTotal();
}

function renderCount() {
  if (cartCount) cartCount.textContent = cartCountTotal();
}

function renderPanelTotal() {
  if (!cartPanelTotal || !cartQtyInput) return;
  const qty = parseInt(cartQtyInput.value, 10) || 1;
  const color = cartColorSel?.value || "gray";
  const unitPrice = COLOR_PRICES[color] || 22.70;
  cartPanelTotal.textContent = formatPrice(qty * unitPrice);
}

function renderCartModal() {
  if (!cartItemsEl || !cartTotalEl) return;

  if (cart.length === 0) {
    cartItemsEl.innerHTML = `<div class="cart-empty">Корзина пуста</div>`;
    cartTotalEl.textContent = "0 ₽";
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  cartItemsEl.innerHTML = cart
    .map(
      (item, i) => {
        const imgSrc = item.imageUrl || COLOR_PRODUCT_IMAGES[item.color] || "";
        return `
      <div class="cart-item">
        <div class="cart-item__color">
          ${
            imgSrc
              ? `<img class="cart-item__thumb" src="${imgSrc}" alt="${item.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';">`
              : ""
          }
          <span class="cart-item__swatch" style="background:${COLOR_HEX[item.color] || "#ccc"}; ${imgSrc ? "display: none;" : ""}"></span>
          <div class="cart-item__info">
            <span class="cart-item__name">${item.name}</span>
            <span class="cart-item__unit-price">${formatPrice(item.price)} / шт.</span>
          </div>
        </div>
        <div class="cart-item__qty">
          <button type="button" data-minus="${i}">−</button>
          <span>${item.qty}</span>
          <button type="button" data-plus="${i}">+</button>
        </div>
        <div class="cart-item__price">${formatPrice(item.price * item.qty)}</div>
        <button type="button" class="cart-item__remove" data-remove="${i}">×</button>
      </div>`;
      }
    )
    .join("");

  cartTotalEl.textContent = formatPrice(cartTotal());
  if (checkoutBtn) checkoutBtn.disabled = false;
}

// ================================================================
// МОДАЛКИ
// ================================================================
function openModal(el)  { if (el) el.hidden = false; }
function closeModal(el) { if (el) el.hidden = true; }

// ================================================================
// ОТПРАВКА НА EMAIL (FormSubmit AJAX)
// ================================================================
async function sendOrderToEmail(order) {
  const itemsText = order.items
    .map((i) => `• ${i.name} — ${i.qty} шт. × ${i.price} ₽ = ${i.qty * i.price} ₽`)
    .join("\n");

  const payload = {
    _subject: `Новая заявка с сайта — ${order.customer.name}`,
    _template: "table",   // красивое HTML-письмо
    _captcha: "false",    // без капчи (для теста)

    "Имя":           order.customer.name,
    "Email":         order.customer.email,
    "Телефон":       order.customer.phone,
    "Город":         order.customer.city || "—",
    "Адрес":         order.customer.address || "—",
    "Комментарий":   order.customer.comment || "—",

    "Товары":        itemsText,
    "Сумма заказа":  formatPrice(order.total),
    "Дата заявки":   new Date(order.date).toLocaleString("ru-RU"),
  };

  const response = await fetch(FORM_SUBMIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`FormSubmit вернул ${response.status}`);
  }

  return response.json();
}

// ================================================================
// СТАТУС ФОРМЫ
// ================================================================
function showFormStatus(message, type = "ok") {
  const box = checkoutForm.querySelector("[data-status]");
  if (!box) return;
  box.textContent = message;
  box.className = `form-status form-status--${type}`;
}

function clearFormStatus() {
  const box = checkoutForm.querySelector("[data-status]");
  if (box) {
    box.textContent = "";
    box.className = "form-status";
  }
}

// ================================================================
// СОБЫТИЯ
// ================================================================
function initCart() {
  // Синхронизация цвета в корзине при выборе цвета в конфигураторе
  document.querySelectorAll('input[name="color_brick"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked && cartColorSel) {
        cartColorSel.value = radio.value;
        renderPanelTotal();
      }
    });
  });

  if (cartColorSel) {
    cartColorSel.addEventListener("change", renderPanelTotal);
  }

  // Пересчёт «Итого» при вводе количества
  if (cartQtyInput) {
    cartQtyInput.addEventListener("input", renderPanelTotal);
  }

  // Добавить в корзину
  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", () => {
      const color = cartColorSel?.value || "gray";
      const qty = Math.max(1, parseInt(cartQtyInput?.value, 10) || 1);
      addItem(color, qty);
    });
  }

  // Открыть корзину
  if (cartBtn) {
    cartBtn.addEventListener("click", () => {
      renderCartModal();
      openModal(cartModal);
    });
  }

  // Закрытие модалок
  document.querySelectorAll("[data-close-cart]").forEach((el) =>
    el.addEventListener("click", () => closeModal(cartModal))
  );
  document.querySelectorAll("[data-close-checkout]").forEach((el) =>
    el.addEventListener("click", () => closeModal(checkoutModal))
  );
  document.querySelectorAll("[data-close-thanks]").forEach((el) =>
    el.addEventListener("click", () => closeModal(thanksModal))
  );

  // Кнопки +/− и удаление
  if (cartItemsEl) {
    cartItemsEl.addEventListener("click", (e) => {
      const t = e.target;
      if (t.dataset.plus   !== undefined) changeQty(+t.dataset.plus, +1);
      if (t.dataset.minus  !== undefined) changeQty(+t.dataset.minus, -1);
      if (t.dataset.remove !== undefined) removeItem(+t.dataset.remove);
    });
  }

  // Оформить заказ → открыть форму
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      closeModal(cartModal);
      clearFormStatus();
      openModal(checkoutModal);
    });
  }

  // Отправка формы
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormStatus();

      if (!checkoutForm.checkValidity()) {
        checkoutForm.reportValidity();
        return;
      }

      if (cart.length === 0) {
        showFormStatus("Корзина пуста", "error");
        return;
      }

      const data = new FormData(checkoutForm);

      const order = {
        id: Date.now(),
        date: new Date().toISOString(),
        customer: {
          name:    (data.get("name")    || "").trim(),
          email:   (data.get("email")   || "").trim(),
          phone:   (data.get("phone")   || "").trim(),
          city:    (data.get("city")    || "").trim(),
          address: (data.get("address") || "").trim(),
          comment: (data.get("comment") || "").trim(),
        },
        items: cart.map((i) => ({ ...i })),
        total: cartTotal(),
      };

      // Блокируем кнопку на время отправки
      const submitBtn = checkoutForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Отправка...";

      try {
        await sendOrderToEmail(order);

        // Сохраняем локально (история заявок)
        try {
          const orders = JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
          orders.push(order);
          localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
        } catch (err) {
          console.warn("Не удалось сохранить в localStorage:", err);
        }

        // Успех
        cart = [];
        saveCart();
        checkoutForm.reset();
        renderAll();

        closeModal(checkoutModal);
        openModal(thanksModal);
      } catch (err) {
        console.error("Ошибка отправки заявки:", err);
        showFormStatus(
          "Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.",
          "error"
        );
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // Начальный рендер
  renderAll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCart);
} else {
  initCart();
}

// Экспорт для модуля просмотренных товаров (viewed.js)
export { addItem, COLOR_NAMES, COLOR_HEX, BRICK_PRICE, COLOR_PRICES, COLOR_PRODUCT_IMAGES, formatPrice };

// Глобальный доступ при необходимости
if (typeof window !== "undefined") {
  window.cartModule = {
    addItem,
    COLOR_NAMES,
    COLOR_HEX,
    BRICK_PRICE,
    COLOR_PRICES,
    COLOR_PRODUCT_IMAGES,
    formatPrice,
  };
}

