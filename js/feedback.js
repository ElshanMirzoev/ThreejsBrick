// js/feedback.js
// Модуль анкетирования: обратная связь + заказ звонка

const FEEDBACK_KEY = "feedback_messages_v1";
const CALLBACK_KEY = "callback_requests_v1";

// ---------- Утилиты ----------
function openModal(el) { if (el) el.hidden = false; }
function closeModal(el) { if (el) el.hidden = true; }

function saveToStorage(key, record) {
  try {
    const list = JSON.parse(localStorage.getItem(key)) || [];
    list.push(record);
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch (err) {
    console.error("Ошибка сохранения:", err);
    return false;
  }
}

function showStatus(form, message, type = "ok") {
  const box = form.querySelector("[data-status]");
  if (!box) return;
  box.textContent = message;
  box.className = `form-status form-status--${type}`;
}

function clearStatus(form) {
  const box = form.querySelector("[data-status]");
  if (box) { box.textContent = ""; box.className = "form-status"; }
}

// ---------- Маска телефона ----------
function attachPhoneMask(input) {
  if (!input) return;
  input.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^\d\+\-\s\(\)]/g, "");
  });
}

// ---------- Обратная связь ----------
function initFeedback() {
  const btn = document.getElementById("feedbackBtn");
  const modal = document.getElementById("feedbackModal");
  const form = document.getElementById("feedbackForm");
  if (!btn || !modal || !form) return;

  btn.addEventListener("click", () => {
    form.reset();
    clearStatus(form);
    openModal(modal);
  });

  modal.querySelectorAll("[data-close-feedback]").forEach((el) =>
    el.addEventListener("click", () => closeModal(modal))
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearStatus(form);

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const record = {
      id: Date.now(),
      date: new Date().toISOString(),
      type: "feedback",
      name: data.get("name")?.trim() || "",
      email: data.get("email")?.trim() || "",
      subject: data.get("subject") || "",
      message: data.get("message")?.trim() || "",
      consent: data.get("consent") === "on",
    };

    if (saveToStorage(FEEDBACK_KEY, record)) {
      console.log("Обратная связь сохранена:", record);
      showStatus(form, "Спасибо! Ваше сообщение отправлено.", "ok");
      form.reset();
      setTimeout(() => closeModal(modal), 1500);
    } else {
      showStatus(form, "Не удалось сохранить. Попробуйте позже.", "error");
    }
  });
}

// ---------- Заказ звонка ----------
function initCallback() {
  const btn = document.getElementById("callbackBtn");
  const modal = document.getElementById("callbackModal");
  const form = document.getElementById("callbackForm");
  if (!btn || !modal || !form) return;

  btn.addEventListener("click", () => {
    form.reset();
    clearStatus(form);
    openModal(modal);
  });

  modal.querySelectorAll("[data-close-callback]").forEach((el) =>
    el.addEventListener("click", () => closeModal(modal))
  );

  const phoneInput = form.querySelector('input[name="phone"]');
  attachPhoneMask(phoneInput);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearStatus(form);

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const record = {
      id: Date.now(),
      date: new Date().toISOString(),
      type: "callback",
      name: data.get("name")?.trim() || "",
      phone: data.get("phone")?.trim() || "",
      callTime: data.get("callTime") || "",
      comment: data.get("comment")?.trim() || "",
      consent: data.get("consent") === "on",
    };

    if (saveToStorage(CALLBACK_KEY, record)) {
      console.log("Заявка на звонок сохранена:", record);
      showStatus(form, "Заявка принята! Мы перезвоним в указанное время.", "ok");
      form.reset();
      setTimeout(() => closeModal(modal), 1500);
    } else {
      showStatus(form, "Не удалось сохранить. Попробуйте позже.", "error");
    }
  });
}

// ---------- Инициализация ----------
function init() {
  initFeedback();
  initCallback();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
