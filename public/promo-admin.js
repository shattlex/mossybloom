const STORAGE_KEY = "sara_promo_admin_config_v2";

const refs = {
  apiBase: document.getElementById("api-base"),
  adminToken: document.getElementById("admin-token"),
  saveConfig: document.getElementById("save-config"),
  loadList: document.getElementById("load-list"),
  form: document.getElementById("promo-form"),
  promoId: document.getElementById("promo-id"),
  promoCode: document.getElementById("promo-code"),
  promoDiscount: document.getElementById("promo-discount"),
  promoMinOrder: document.getElementById("promo-min-order"),
  promoMaxTotal: document.getElementById("promo-max-total"),
  promoMaxUser: document.getElementById("promo-max-user"),
  promoStarts: document.getElementById("promo-starts"),
  promoEnds: document.getElementById("promo-ends"),
  promoActive: document.getElementById("promo-active"),
  clearForm: document.getElementById("clear-form"),
  status: document.getElementById("promo-status"),
  tableBody: document.getElementById("promo-table-body")
};

let promoRows = [];

function normalizeApiBase(value) {
  const raw = String(value || "").trim();
  if (!raw) return "http://127.0.0.1:8787";
  return raw.replace(/\/+$/, "");
}

function setStatus(text, type = "") {
  refs.status.textContent = text || "";
  refs.status.className = `status${type ? ` ${type}` : ""}`;
}

function saveConfig() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      apiBase: normalizeApiBase(refs.apiBase.value),
      adminToken: refs.adminToken.value
    })
  );
  setStatus("Настройки сохранены.", "success");
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      refs.apiBase.value = "http://127.0.0.1:8787";
      return;
    }
    const parsed = JSON.parse(raw);
    refs.apiBase.value = normalizeApiBase(parsed.apiBase);
    refs.adminToken.value = String(parsed.adminToken || "");
  } catch {
    refs.apiBase.value = "http://127.0.0.1:8787";
  }
}

function getRequestConfig() {
  const apiBase = normalizeApiBase(refs.apiBase.value);
  const adminToken = String(refs.adminToken.value || "").trim();
  if (!adminToken) {
    throw new Error("Введите ADMIN_API_TOKEN.");
  }
  return { apiBase, adminToken };
}

async function apiRequest(path, options = {}) {
  const { apiBase, adminToken } = getRequestConfig();
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminToken
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
}

function toLocalInputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function clearForm() {
  refs.promoId.value = "";
  refs.promoCode.value = "";
  refs.promoDiscount.value = "";
  refs.promoMinOrder.value = "0";
  refs.promoMaxTotal.value = "";
  refs.promoMaxUser.value = "";
  refs.promoStarts.value = "";
  refs.promoEnds.value = "";
  refs.promoActive.checked = true;
}

function fillForm(row) {
  refs.promoId.value = row.id;
  refs.promoCode.value = row.code;
  refs.promoDiscount.value = Number(row.discount_percent || 0);
  refs.promoMinOrder.value = Number(row.min_order_amount || 0);
  refs.promoMaxTotal.value = row.max_uses_total ?? "";
  refs.promoMaxUser.value = row.max_uses_per_user ?? "";
  refs.promoStarts.value = toLocalInputDate(row.starts_at);
  refs.promoEnds.value = toLocalInputDate(row.ends_at);
  refs.promoActive.checked = Boolean(row.is_active);
}

function buildPayloadFromForm() {
  return {
    code: refs.promoCode.value.trim().toUpperCase(),
    discountPercent: Number(refs.promoDiscount.value),
    isActive: refs.promoActive.checked,
    startsAt: fromLocalInputDate(refs.promoStarts.value),
    endsAt: fromLocalInputDate(refs.promoEnds.value),
    maxUsesTotal: refs.promoMaxTotal.value ? Number(refs.promoMaxTotal.value) : null,
    maxUsesPerUser: refs.promoMaxUser.value ? Number(refs.promoMaxUser.value) : null,
    minOrderAmount: Number(refs.promoMinOrder.value || 0)
  };
}

async function loadPromoCodes() {
  setStatus("Загружаем промокоды...");
  const data = await apiRequest("/api/admin/promo-codes");
  promoRows = Array.isArray(data?.promoCodes) ? data.promoCodes : [];
  renderTable();
  setStatus(`Загружено: ${promoRows.length}`, "success");
}

function renderTable() {
  refs.tableBody.innerHTML = "";
  if (!promoRows.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6" style="color:#777;">Промокодов пока нет.</td>`;
    refs.tableBody.append(row);
    return;
  }

  for (const promo of promoRows) {
    const tr = document.createElement("tr");
    const period = `${promo.starts_at ? new Date(promo.starts_at).toLocaleString("ru-RU") : "—"} → ${promo.ends_at ? new Date(promo.ends_at).toLocaleString("ru-RU") : "—"}`;
    const limits = `всего: ${promo.max_uses_total ?? "∞"} | использовано: ${promo.uses_total ?? 0} | на пользователя: ${promo.max_uses_per_user ?? "∞"} | min: ${Number(promo.min_order_amount || 0).toLocaleString("ru-RU")} ₽`;
    tr.innerHTML = `
      <td><strong>${promo.code}</strong></td>
      <td>${Number(promo.discount_percent || 0)}%</td>
      <td>${limits}</td>
      <td>${period}</td>
      <td><span class="badge ${promo.is_active ? "on" : ""}">${promo.is_active ? "Активен" : "Выключен"}</span></td>
      <td><div class="row-actions"></div></td>
    `;

    const actions = tr.querySelector(".row-actions");

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn";
    editBtn.textContent = "Изменить";
    editBtn.addEventListener("click", () => fillForm(promo));

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "btn";
    toggleBtn.textContent = promo.is_active ? "Выключить" : "Включить";
    toggleBtn.addEventListener("click", async () => {
      try {
        await apiRequest(`/api/admin/promo-codes/${encodeURIComponent(promo.id)}`, {
          method: "PATCH",
          body: { isActive: !promo.is_active }
        });
        await loadPromoCodes();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Ошибка обновления.", "error");
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-danger";
    deleteBtn.textContent = "Удалить";
    deleteBtn.addEventListener("click", async () => {
      if (!window.confirm(`Удалить промокод ${promo.code}?`)) return;
      try {
        await apiRequest(`/api/admin/promo-codes/${encodeURIComponent(promo.id)}`, { method: "DELETE" });
        await loadPromoCodes();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Ошибка удаления.", "error");
      }
    });

    actions.append(editBtn, toggleBtn, deleteBtn);
    refs.tableBody.append(tr);
  }
}

refs.saveConfig.addEventListener("click", saveConfig);
refs.loadList.addEventListener("click", async () => {
  try {
    saveConfig();
    await loadPromoCodes();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Ошибка загрузки.", "error");
  }
});

refs.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    saveConfig();
    const payload = buildPayloadFromForm();
    const promoId = refs.promoId.value.trim();
    if (promoId) {
      await apiRequest(`/api/admin/promo-codes/${encodeURIComponent(promoId)}`, {
        method: "PATCH",
        body: payload
      });
      setStatus("Промокод обновлен.", "success");
    } else {
      await apiRequest("/api/admin/promo-codes", {
        method: "POST",
        body: payload
      });
      setStatus("Промокод создан.", "success");
    }
    clearForm();
    await loadPromoCodes();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Ошибка сохранения.", "error");
  }
});

refs.clearForm.addEventListener("click", clearForm);

loadConfig();
clearForm();
