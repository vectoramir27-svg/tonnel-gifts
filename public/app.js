/**
 * Telegram Gifts Live Engine - Редизайн Liquid Glass
 */

const CONFIG = {
  wsUrl: "wss://ws.telegram-gifts.ru/?accessToken=gifts.wss",
  apiProxy: "/api-proxy",
  artworkBase: "https://api.changes.tg/original",
  catalogUrl: "https://api.changes.tg/ids",
  nftBase: "https://nft.fragment.com/gift"
};

const state = {
  currentTab: "summary",
  online: 0,
  giftsMap: new Map(),
  giftNames: new Map(),
  totals: {
    gifts: 0,
    stars: 0,
    sessionGifted: 0,
    sessionHidden: 0
  },
  feed: [],
  nftItems: []
};

const openedAt = Date.now();
const numFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function formatNum(n) {
  return numFormat.format(Math.max(0, Math.round(Number(n) || 0)));
}

// --- Управление вкладками и Dock ---
function switchTab(tabId) {
  state.currentTab = tabId;

  // Обновляем классы экрана
  document.querySelectorAll(".tab-pane").forEach(el => el.classList.remove("active"));
  const targetPane = document.getElementById(`pane-${tabId}`);
  if (targetPane) targetPane.classList.add("active");

  // Обновляем ПК-шапку
  document.querySelectorAll(".Header-module__tab__-X7D").forEach(btn => {
    btn.classList.toggle("Header-module__current__7nDH", btn.dataset.tab === tabId);
  });

  // Обновляем мобильный Dock
  document.querySelectorAll(".dock-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- Таймер на сайте ---
function updateTimer() {
  const diff = Math.floor((Date.now() - openedAt) / 1000);
  const h = String(Math.floor(diff / 3600)).padStart(2, "0");
  const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
  const s = String(diff % 60).padStart(2, "0");
  const timerEl = document.getElementById("siteTimer");
  if (timerEl) timerEl.textContent = `${h}:${m}:${s}`;
}
setInterval(updateTimer, 1000);

// --- Отрисовка сводки ---
function updateSummaryView() {
  document.getElementById("stat-total-gifts").textContent = formatNum(state.totals.gifts);
  document.getElementById("stat-total-stars").textContent = formatNum(state.totals.stars);
  document.getElementById("stat-session-gifted").textContent = formatNum(state.totals.sessionGifted);
  document.getElementById("stat-session-hidden").textContent = formatNum(state.totals.sessionHidden);
  document.getElementById("onlineCount").textContent = formatNum(state.online);
}

// --- Прямой эфир (Live Feed) ---
function addFeedItem(item, isHide = false) {
  const feedList = document.getElementById("feedList");
  const emptyEl = document.getElementById("feedEmpty");
  if (!feedList) return;

  if (emptyEl) emptyEl.style.display = "none";

  const card = document.createElement("div");
  card.className = `feed-event-card ${isHide ? "is-hidden" : "is-mint"}`;
  
  const imgUrl = `${CONFIG.artworkBase}/${item.giftId || item.id}.png`;
  const name = state.giftNames.get(String(item.giftId || item.id)) || "Подарок";

  card.innerHTML = `
    <img src="${imgUrl}" alt="" loading="lazy">
    <div class="feed-event-info">
      <span class="feed-event-name">${name}</span>
      <span class="feed-event-stars">★ ${formatNum(item.stars || 0)}</span>
    </div>
  `;

  feedList.prepend(card);
  if (feedList.children.length > 28) {
    feedList.lastElementChild.remove();
  }
}

// --- Каталог подарков ---
function renderCatalog() {
  const grid = document.getElementById("catalogGrid");
  if (!grid) return;

  const filter = (document.getElementById("giftSearchInput")?.value || "").toLowerCase().trim();
  const sorted = [...state.giftsMap.values()].filter(g => {
    const name = (state.giftNames.get(g.id) || "").toLowerCase();
    return !filter || name.includes(filter) || g.id.includes(filter);
  }).sort((a, b) => b.totalStars - a.totalStars);

  grid.innerHTML = sorted.map(g => {
    const name = state.giftNames.get(g.id) || `ID: ${g.id}`;
    return `
      <div class="gift-catalog-card">
        <div class="gift-catalog-thumb">
          <img src="${CONFIG.artworkBase}/${g.id}.png" loading="lazy" alt="">
        </div>
        <div class="gift-catalog-meta">
          <div class="gift-catalog-title">${name}</div>
          <div class="gift-catalog-count">${formatNum(g.count)} шт.</div>
          <div class="gift-catalog-price">★ ${formatNum(g.starsPerGift)}</div>
        </div>
      </div>
    `;
  }).join("");
}

// --- NFT Каталог ---
function renderNftCatalog() {
  const grid = document.getElementById("nftGrid");
  if (!grid || state.nftItems.length === 0) return;

  grid.innerHTML = state.nftItems.map(item => `
    <div class="gift-catalog-card">
      <div class="gift-catalog-thumb">
        <img src="${CONFIG.nftBase}/${item.slug.toLowerCase()}.medium.jpg" loading="lazy" alt="">
      </div>
      <div class="gift-catalog-meta">
        <div class="gift-catalog-title">${item.title} #${item.uniqueNumber}</div>
        <div class="gift-catalog-price">${item.price ? `${item.price} TON` : "Без цены"}</div>
      </div>
    </div>
  `).join("");
}

// --- Поиск людей через Прокси ---
const peopleInput = document.getElementById("peopleSearchInput");
if (peopleInput) {
  let debounceTimeout = null;
  peopleInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimeout);
    const query = e.target.value.trim().replace(/^@/, "");
    if (query.length < 2) return;

    debounceTimeout = setTimeout(async () => {
      const container = document.getElementById("peopleResult");
      container.innerHTML = `<p style="color: var(--muted);">Поиск...</p>`;
      try {
        const resp = await fetch(`${CONFIG.apiProxy}/web/users/get?id=${encodeURIComponent(query)}`);
        if (!resp.ok) throw new Error("Пользователь не найден");
        const data = await resp.json();
        const user = data.response;
        container.innerHTML = `
          <div style="display: inline-flex; align-items: center; gap: 14px; text-align: left;">
            <div style="font-size: 1.2rem; font-weight: 800;">${user.currentFirstName || user.firstName || "Пользователь"}</div>
            <div style="color: var(--muted);">@${user.currentUsername || user.username || user.id}</div>
          </div>
        `;
      } catch (err) {
        container.innerHTML = `<p style="color: #ff453a;">Пользователь не найден в базе</p>`;
      }
    }, 450);
  });
}

// --- Инициализация WebSocket ---
function initLiveSocket() {
  const ws = new WebSocket(CONFIG.wsUrl);

  ws.onopen = () => {
    console.log("🟢 WebSocket подключен к живому эфиру подарков");
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const payload = data.data || data;

      // Онлайн
      if (typeof payload.online === "number") {
        state.online = payload.online;
      }

      // Полный срез подарков
      if (Array.isArray(payload.gifts)) {
        let totalG = 0, totalS = 0;
        payload.gifts.forEach(g => {
          const id = String(g.id || g.giftId);
          const count = Number(g.count) || 0;
          const starsPerGift = Number(g.starsPerGift) || 0;
          const totalStars = Number(g.totalStars) || (count * starsPerGift);
          state.giftsMap.set(id, { id, count, starsPerGift, totalStars });
          totalG += count;
          totalS += totalStars;
        });
        state.totals.gifts = totalG;
        state.totals.stars = totalS;
        renderCatalog();
      }

      // Подаренные вживую
      if (Array.isArray(payload.newGifts)) {
        payload.newGifts.forEach(item => {
          state.totals.sessionGifted += 1;
          state.totals.gifts += 1;
          const s = Number(item.stars) || 0;
          state.totals.stars += s;
          addFeedItem(item, false);
        });
      }

      // Скрытые вживую
      if (Array.isArray(payload.hideGifts)) {
        payload.hideGifts.forEach(item => {
          state.totals.sessionHidden += 1;
          addFeedItem(item, true);
        });
      }

      // NFT улучшения
      if (payload.type === "new_improvement_gift" && payload.data) {
        const list = Array.isArray(payload.data) ? payload.data : [payload.data];
        list.forEach(nft => state.nftItems.unshift(nft));
        state.nftItems = state.nftItems.slice(0, 40);
        renderNftCatalog();
      }

      updateSummaryView();
    } catch (e) {
      console.warn("Ошибка разбора пакета сокета:", e);
    }
  };

  ws.onclose = () => {
    console.log("Крах сокета, переподключение через 3 секунды...");
    setTimeout(initLiveSocket, 3000);
  };
}

// Загрузка названий подарков
async function loadGiftCatalogNames() {
  try {
    const res = await fetch(CONFIG.catalogUrl);
    if (res.ok) {
      const json = await res.json();
      Object.entries(json).forEach(([id, name]) => state.giftNames.set(String(id), String(name)));
      renderCatalog();
    }
  } catch (e) {
    console.warn("Каталог имен недоступен");
  }
}

// Старт
document.getElementById("giftSearchInput")?.addEventListener("input", renderCatalog);
loadGiftCatalogNames();
initLiveSocket();