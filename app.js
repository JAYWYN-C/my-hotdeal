const categories = [
  { id: "all", label: "전체" },
  { id: "produce", label: "야채·과일" },
  { id: "meat", label: "고기·생선" },
  { id: "dairy", label: "유제품" },
  { id: "frozen", label: "냉동식품" },
  { id: "dessert", label: "디저트" },
  { id: "food-other", label: "기타 식품" },
  { id: "kitchen", label: "주방용품" },
  { id: "household", label: "생활용품" },
  { id: "cleaning", label: "청소용품" },
  { id: "travel", label: "여행" },
  { id: "voucher", label: "상품권" },
  { id: "game", label: "게임" },
  { id: "electronics", label: "전자기기" },
  { id: "overseas", label: "해외핫딜" },
  { id: "festa", label: "할인페스타" },
];

const fallbackDeals = [];
const DEALS_PER_PAGE = 20;

let deals = [...fallbackDeals];

const state = {
  selectedCategory: "all",
  selectedSource: "all",
  sort: "latest",
  search: "",
  currentPage: 1,
  alertsEnabled: false,
  bookmarks: JSON.parse(localStorage.getItem("hotdeal-bookmarks") || "[]"),
  alertKeywords: JSON.parse(localStorage.getItem("hotdeal-alert-keywords") || "[]"),
  notifiedKeys: JSON.parse(localStorage.getItem("hotdeal-notified-keys") || "[]"),
  generatedAt: null,
  policyMode: "local-fallback",
  compliance: [],
  user: null,
  syncStatus: "로컬 모드",
  authMode: "loading",
  selectedDealId: null,
};

const homeButton = document.getElementById("home-button");
const homeTitle = document.getElementById("home-title");
const menuButton = document.getElementById("menu-button");
const headerMenu = document.getElementById("header-menu");
const categoryTabs = document.getElementById("category-tabs");
const sourceSelect = document.getElementById("source-select");
const sortSelect = document.getElementById("sort-select");
const searchInput = document.getElementById("search-input");
const dealList = document.getElementById("deal-list");
const dealCount = document.getElementById("deal-count");
const dealPagination = document.getElementById("deal-pagination");
const pagePrev = document.getElementById("page-prev");
const pageNext = document.getElementById("page-next");
const pageStatus = document.getElementById("page-status");
const tagCloud = document.getElementById("event-tags");
const bookmarkList = document.getElementById("bookmark-list");
const toggleAlert = document.getElementById("toggle-alert");
const googleLogin = document.getElementById("google-login");
const googleLogout = document.getElementById("google-logout");
const authStatus = document.getElementById("auth-status");
const syncStatus = document.getElementById("sync-status");
const keywordInput = document.getElementById("keyword-input");
const addKeywordButton = document.getElementById("add-keyword");
const keywordList = document.getElementById("keyword-list");
const requestNotificationButton = document.getElementById("request-notification");
const notificationStatus = document.getElementById("notification-status");
const detailModal = document.getElementById("deal-detail-modal");
const detailContent = document.getElementById("deal-detail-content");
const detailTitle = document.getElementById("deal-detail-title");
const detailHeaderActions = document.getElementById("detail-header-actions");
const savingNowList = document.getElementById("saving-now-list");
const foodSavingList = document.getElementById("food-saving-list");
const livingSavingList = document.getElementById("living-saving-list");
const alertsPanel = document.getElementById("alerts-panel");
const bookmarkPanel = document.getElementById("bookmark-panel");

let authClient = null;
let dbClient = null;
let cloudSyncTimer = null;

function storageKey(baseKey) {
  return state.user ? `${baseKey}:${state.user.uid}` : baseKey;
}

function loadUserScopedState() {
  state.bookmarks = JSON.parse(localStorage.getItem(storageKey("hotdeal-bookmarks")) || "[]");
  state.alertKeywords = JSON.parse(localStorage.getItem(storageKey("hotdeal-alert-keywords")) || "[]");
  state.notifiedKeys = JSON.parse(localStorage.getItem(storageKey("hotdeal-notified-keys")) || "[]");
  state.alertsEnabled = JSON.parse(localStorage.getItem(storageKey("hotdeal-alerts-enabled")) || "false");
}

function toKrw(amount) {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

function displayPrice(deal) {
  if (deal.priceText) {
    return deal.priceText;
  }
  if (deal.price > 0) {
    return toKrw(deal.price);
  }
  return "가격 확인";
}

function formatGeneratedAt(dateString) {
  if (!dateString) return "업데이트 정보 없음";
  return new Date(dateString).toLocaleString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getCategoryLabel(categoryId) {
  const normalizedCategoryId = categoryId === "fish" ? "meat" : categoryId;
  return categories.find((category) => category.id === normalizedCategoryId)?.label || "기타";
}

function timeAgo(dateString) {
  const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60)));
  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffMinutes < 24 * 60) return `${Math.floor(diffMinutes / 60)}시간 전`;
  return `${Math.floor(diffMinutes / (24 * 60))}일 전`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hoursLeft(dateString) {
  const diff = new Date(dateString).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
}

function getDeadlineTime(deal) {
  const value = new Date(deal.deadlineAt || deal.expiresAt || "").getTime();
  return Number.isNaN(value) ? null : value;
}

function getStatusLabel(deal) {
  const deadlineTime = getDeadlineTime(deal);
  if (deadlineTime !== null) {
    return `${hoursLeft(new Date(deadlineTime).toISOString())}시간 남음`;
  }
  return deal.statusText || "";
}

function getDisplayTags(deal) {
  return [
    { label: getCategoryLabel(deal.category), tone: "category" },
    { label: deal.platform, tone: "platform" },
    { label: deal.source, tone: "source" },
  ].filter((tag, index, array) => {
    if (!tag.label) {
      return false;
    }
    return array.findIndex((candidate) => candidate.label === tag.label && candidate.tone === tag.tone) === index;
  });
}

function renderDealTags(tags) {
  return tags
    .map((tag) => `<span class="tag tag-${tag.tone}">${escapeHtml(tag.label)}</span>`)
    .join("");
}

function persistBookmarks() {
  localStorage.setItem(storageKey("hotdeal-bookmarks"), JSON.stringify(state.bookmarks));
  queueCloudSync("bookmarks");
}

function persistAlertState() {
  localStorage.setItem(storageKey("hotdeal-alert-keywords"), JSON.stringify(state.alertKeywords));
  localStorage.setItem(storageKey("hotdeal-notified-keys"), JSON.stringify(state.notifiedKeys));
  localStorage.setItem(storageKey("hotdeal-alerts-enabled"), JSON.stringify(state.alertsEnabled));
  queueCloudSync("alerts");
}

function setSyncStatus(text) {
  state.syncStatus = text;
}

async function pullCloudPreferences(uid) {
  if (!dbClient) {
    return;
  }

  try {
    setSyncStatus("클라우드 불러오는 중");
    const ref = dbClient.doc(dbClient.db, "userPreferences", uid);
    const snapshot = await dbClient.getDoc(ref);
    if (!snapshot.exists()) {
      setSyncStatus("클라우드 데이터 없음");
      return;
    }

    const data = snapshot.data() || {};
    state.bookmarks = Array.isArray(data.bookmarks)
      ? data.bookmarks.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : state.bookmarks;
    state.alertKeywords = Array.isArray(data.alertKeywords)
      ? data.alertKeywords.map((value) => String(value)).filter((value) => value.length > 0)
      : state.alertKeywords;
    state.alertsEnabled =
      typeof data.emailAlertsEnabled === "boolean" ? data.emailAlertsEnabled : state.alertsEnabled;

    localStorage.setItem(storageKey("hotdeal-bookmarks"), JSON.stringify(state.bookmarks));
    localStorage.setItem(storageKey("hotdeal-alert-keywords"), JSON.stringify(state.alertKeywords));
    localStorage.setItem(storageKey("hotdeal-alerts-enabled"), JSON.stringify(state.alertsEnabled));
    setSyncStatus("클라우드 동기화됨");
  } catch (error) {
    console.warn("Failed to pull cloud preferences.", error);
    setSyncStatus("동기화 오류(다운로드)");
  }
}

async function pushCloudPreferences() {
  if (!dbClient || !state.user) {
    return;
  }

  try {
    setSyncStatus("클라우드 저장 중");
    const ref = dbClient.doc(dbClient.db, "userPreferences", state.user.uid);
    await dbClient.setDoc(
      ref,
      {
        bookmarks: state.bookmarks,
        alertKeywords: state.alertKeywords,
        emailAlertsEnabled: state.alertsEnabled,
        email: state.user.email || "",
        updatedAt: dbClient.serverTimestamp(),
      },
      { merge: true }
    );
    setSyncStatus("클라우드 동기화됨");
  } catch (error) {
    console.warn("Failed to push cloud preferences.", error);
    setSyncStatus("동기화 오류(업로드)");
  }
}

function queueCloudSync() {
  if (!dbClient || !state.user) {
    return;
  }
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    pushCloudPreferences();
  }, 700);
}

function renderAuthStatus() {
  if (state.authMode === "missing-config") {
    authStatus.textContent = "Google 로그인 설정 필요";
    googleLogin.disabled = true;
    googleLogout.hidden = true;
    googleLogin.hidden = false;
    return;
  }

  if (state.authMode === "error") {
    authStatus.textContent = "Google 로그인 연결 오류";
    googleLogin.disabled = true;
    googleLogout.hidden = true;
    googleLogin.hidden = false;
    return;
  }

  if (!authClient) {
    authStatus.textContent = "비회원으로 둘러보는 중";
    googleLogin.disabled = true;
    googleLogout.hidden = true;
    googleLogin.hidden = false;
    return;
  }

  if (state.user) {
    const label = state.user.displayName || state.user.email || "로그인 사용자";
    authStatus.textContent = `${label} 계정으로 이용 중`;
    googleLogin.disabled = true;
    googleLogout.disabled = false;
    googleLogin.hidden = true;
    googleLogout.hidden = false;
    return;
  }

  authStatus.textContent = "비회원으로 둘러보는 중";
  googleLogin.disabled = false;
  googleLogout.disabled = true;
  googleLogin.hidden = false;
  googleLogout.hidden = true;
}

function renderAlertToggle() {
  if (!toggleAlert) {
    return;
  }
  toggleAlert.textContent = state.alertsEnabled ? "이메일 알림 켜짐" : "이메일 알림 켜기";
}

async function initializeFirebaseAuth() {
  const config = window.FIREBASE_CONFIG;
  if (!config || !config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    authClient = null;
    dbClient = null;
    state.authMode = "missing-config";
    renderAuthStatus();
    return;
  }

  try {
    const [
      { initializeApp },
      { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut },
      { getFirestore, doc, getDoc, setDoc, serverTimestamp }
    ] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
    ]);

    const app = initializeApp(config);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const provider = new GoogleAuthProvider();

    authClient = {
      signIn: () => signInWithPopup(auth, provider),
      signOut: () => signOut(auth)
    };

    dbClient = {
      db,
      doc,
      getDoc,
      setDoc,
      serverTimestamp
    };

    onAuthStateChanged(auth, async (user) => {
      state.authMode = "ready";
      state.user = user || null;
      loadUserScopedState();
      if (state.user) {
        await pullCloudPreferences(state.user.uid);
      } else {
        setSyncStatus("로컬 모드");
      }
      render();
      renderAuthStatus();
    });
  } catch (error) {
    console.warn("Firebase auth initialization failed.", error);
    authClient = null;
    dbClient = null;
    state.authMode = "error";
    renderAuthStatus();
  }
}

function getNotificationPermission() {
  if (!("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

async function loadDeals() {
  try {
    const response = await fetch("./data/deals.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load deals.json: ${response.status}`);
    }
    const payload = await response.json();
    if (Array.isArray(payload.deals) && payload.deals.length > 0) {
      deals = payload.deals;
    }
    state.generatedAt = payload.generatedAt || null;
    state.policyMode = payload.policy?.mode || "rss-only";
    state.compliance = Array.isArray(payload.compliance) ? payload.compliance : [];
  } catch (error) {
    console.warn("Using fallback deals because external data load failed.", error);
    deals = [...fallbackDeals];
    state.generatedAt = null;
    state.policyMode = "local-fallback";
    state.compliance = [];
  }
}

function filteredDeals() {
  return [...deals]
    .filter((deal) => {
      const categoryMatch =
        state.selectedCategory === "all" ||
        (deal.category === "fish" ? "meat" : deal.category) === state.selectedCategory;
      const sourceMatch = state.selectedSource === "all" || deal.source === state.selectedSource;
      const tags = Array.isArray(deal.eventTags) ? deal.eventTags : [];
      const searchable = `${deal.title} ${deal.productName || ""} ${deal.summary || ""} ${deal.source} ${deal.platform || ""} ${tags.join(" ")}`.toLowerCase();
      const searchMatch = searchable.includes(state.search.toLowerCase());
      return categoryMatch && sourceMatch && searchMatch;
    })
    .sort((a, b) => {
      if (state.sort === "discount") {
        return b.discount - a.discount;
      }
      if (state.sort === "deadline") {
        const deadlineA = getDeadlineTime(a);
        const deadlineB = getDeadlineTime(b);
        if (deadlineA === null && deadlineB === null) {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        if (deadlineA === null) return 1;
        if (deadlineB === null) return -1;
        return deadlineA - deadlineB;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

function paginatedDeals(list) {
  const totalPages = Math.max(1, Math.ceil(list.length / DEALS_PER_PAGE));
  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }
  const start = (state.currentPage - 1) * DEALS_PER_PAGE;
  return {
    totalPages,
    items: list.slice(start, start + DEALS_PER_PAGE),
  };
}

function setHeaderMenuOpen(isOpen) {
  if (!headerMenu || !menuButton) {
    return;
  }
  headerMenu.hidden = !isOpen;
  menuButton.setAttribute("aria-expanded", String(isOpen));
}

function scrollToSection(section) {
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetToHome() {
  state.search = "";
  state.selectedSource = "all";
  state.selectedCategory = "all";
  state.sort = "latest";
  state.currentPage = 1;
  setHeaderMenuOpen(false);
  closeDealDetail();
  if (searchInput) searchInput.value = "";
  if (sourceSelect) sourceSelect.value = "all";
  if (sortSelect) sortSelect.value = "latest";
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

function pickDashboardDeals(predicate, limit = 4) {
  return [...deals]
    .filter(predicate)
    .sort((a, b) => {
      const purchaseScore = Number(Boolean(b.purchaseUrl)) - Number(Boolean(a.purchaseUrl));
      if (purchaseScore !== 0) return purchaseScore;
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
    .slice(0, limit);
}

function renderMiniDealList(target, items, emptyText) {
  if (!target) return;
  if (items.length === 0) {
    target.innerHTML = `<p class="small">${emptyText}</p>`;
    return;
  }

  target.innerHTML = items
    .map(
      (deal) => `<button class="mini-deal" type="button" data-detail="${deal.id}">
        <span class="mini-deal-title">${escapeHtml(deal.title)}</span>
        <span class="mini-deal-meta">
          <span>${escapeHtml(displayPrice(deal))}</span>
          ${getStatusLabel(deal) ? `<span>${escapeHtml(getStatusLabel(deal))}</span>` : ""}
        </span>
      </button>`
    )
    .join("");

  target.querySelectorAll("[data-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      openDealDetail(Number(button.dataset.detail));
    });
  });
}

function renderDashboardHighlights() {
  renderMiniDealList(
    savingNowList,
    pickDashboardDeals((deal) => Boolean(deal.purchaseUrl)),
    "지금 추천할 특가가 아직 없습니다."
  );
  renderMiniDealList(
    foodSavingList,
    pickDashboardDeals((deal) => ["produce", "meat", "fish", "dairy", "frozen", "dessert", "food-other"].includes(deal.category)),
    "식비 절약 딜을 준비 중입니다."
  );
  renderMiniDealList(
    livingSavingList,
    pickDashboardDeals((deal) => ["kitchen", "household", "cleaning", "voucher", "festa"].includes(deal.category)),
    "생활비 절약 딜을 준비 중입니다."
  );
}

function renderSourceOptions() {
  const uniqueSources = [...new Set(deals.map((deal) => deal.source))].sort((a, b) => a.localeCompare(b, "ko"));
  const hasSelectedSource = state.selectedSource === "all" || uniqueSources.includes(state.selectedSource);
  if (!hasSelectedSource) {
    state.selectedSource = "all";
  }

  sourceSelect.innerHTML = [
    '<option value="all">전체</option>',
    ...uniqueSources.map((source) => `<option value="${source}">${source}</option>`)
  ].join("");
  sourceSelect.value = state.selectedSource;
}

function renderCategoryTabs() {
  categoryTabs.innerHTML = categories
    .map(
      (category) =>
        `<button data-category="${category.id}" class="${
          state.selectedCategory === category.id ? "active" : ""
        }">${category.label}</button>`
    )
    .join("");

  categoryTabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCategory = button.dataset.category;
      state.currentPage = 1;
      render();
    });
  });
}

function renderDeals() {
  const list = filteredDeals();
  dealCount.textContent = `${list.length}건`;
  const { items, totalPages } = paginatedDeals(list);

  if (list.length === 0) {
    dealList.innerHTML = '<p class="small">조건에 맞는 딜이 없습니다.</p>';
    if (dealPagination) {
      dealPagination.hidden = true;
    }
    return;
  }

  dealList.innerHTML = items
    .map((deal) => {
      const bookmarked = state.bookmarks.includes(deal.id);
      const tags = getDisplayTags(deal);
      const statusLabel = getStatusLabel(deal);
      return `<article class="deal-item">
        <div class="deal-top">
          <div>
            <h3>${escapeHtml(deal.title)}</h3>
            <div class="deal-meta">
              ${renderDealTags(tags)}
            </div>
          </div>
          <div class="price">${escapeHtml(displayPrice(deal))}</div>
        </div>
        <p class="deal-summary">${escapeHtml(deal.summary || "핵심 정보 요약이 준비되지 않았습니다.")}</p>
        <div class="deal-submeta">
          <span>${timeAgo(deal.createdAt)}</span>
          ${deal.shipping ? `<span>배송 ${escapeHtml(deal.shipping)}</span>` : ""}
          ${statusLabel ? `<span>${escapeHtml(statusLabel)}</span>` : ""}
        </div>
        <div class="link-row">
          <button data-detail="${deal.id}" type="button">자세히 보기</button>
          <button data-bookmark="${deal.id}">${bookmarked ? "스크랩 해제" : "스크랩"}</button>
        </div>
      </article>`;
    })
    .join("");

  dealList.querySelectorAll("button[data-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      openDealDetail(Number(button.dataset.detail));
    });
  });

  dealList.querySelectorAll("button[data-bookmark]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.bookmark);
      const hasId = state.bookmarks.includes(id);
      state.bookmarks = hasId ? state.bookmarks.filter((item) => item !== id) : [...state.bookmarks, id];
      persistBookmarks();
      render();
    });
  });

  if (dealPagination && pagePrev && pageNext && pageStatus) {
    dealPagination.hidden = false;
    pagePrev.disabled = state.currentPage <= 1;
    pageNext.disabled = state.currentPage >= totalPages;
    pageStatus.textContent = `${state.currentPage} / ${totalPages}페이지`;
  }
}

function openDealDetail(id) {
  state.selectedDealId = id;
  renderDetailModal();
}

function closeDealDetail() {
  state.selectedDealId = null;
  renderDetailModal();
}

function renderDetailModal() {
  if (!detailModal || !detailContent || !detailTitle) {
    return;
  }

  const deal = deals.find((item) => item.id === state.selectedDealId);
  if (!deal) {
    detailModal.hidden = true;
    detailTitle.textContent = "";
    detailContent.innerHTML = "";
    if (detailHeaderActions) {
      detailHeaderActions.innerHTML = "";
    }
    return;
  }

  detailModal.hidden = false;
  detailTitle.textContent = deal.title;
  const tags = getDisplayTags(deal);
  const deadlineTime = getDeadlineTime(deal);
  const purchaseUrl = deal.purchaseUrl || "";
  const originalUrl = deal.originalUrl || deal.url || "";
  const statusLabel = !deadlineTime ? deal.statusText || "" : "";
  const detailFacts = [
    { label: "가격", value: displayPrice(deal) },
    { label: "배송", value: deal.shipping || "배송 정보 없음" },
    { label: "업데이트", value: new Date(deal.createdAt).toLocaleString("ko-KR") },
    deadlineTime !== null
      ? { label: "남은 시간", value: `${hoursLeft(new Date(deadlineTime).toISOString())}시간` }
      : statusLabel
        ? { label: "조건", value: statusLabel }
        : null,
  ].filter(Boolean);

  if (detailHeaderActions) {
    detailHeaderActions.innerHTML = `
      ${originalUrl ? `<a href="${escapeHtml(originalUrl)}" target="_blank" rel="noreferrer" class="detail-header-link">원본글</a>` : ""}
    `;
  }

  detailContent.innerHTML = `
    <div class="detail-meta-row">
      ${renderDealTags(tags)}
    </div>
    <p class="detail-summary">${escapeHtml(deal.summary || "")}</p>
    <div class="detail-facts">
      ${detailFacts
        .map(
          (item) => `<div class="detail-fact">
            <span class="detail-fact-label">${escapeHtml(item.label)}</span>
            <strong class="detail-fact-value">${escapeHtml(item.value)}</strong>
          </div>`
        )
        .join("")}
    </div>
    <div class="detail-actions">
      ${purchaseUrl ? `<a href="${escapeHtml(purchaseUrl)}" target="_blank" rel="noreferrer">구매하러 가기</a>` : ""}
      <button type="button" data-close-detail>닫기</button>
    </div>
  `;

  detailContent.querySelectorAll("[data-close-detail]").forEach((button) => {
    button.addEventListener("click", closeDealDetail);
  });
}

function renderTags() {
  const uniqueTags = [...new Set(deals.flatMap((deal) => (Array.isArray(deal.eventTags) ? deal.eventTags : [])))];
  if (uniqueTags.length === 0) {
    tagCloud.innerHTML = '<span class="small">표시할 태그가 아직 없습니다.</span>';
    return;
  }
  tagCloud.innerHTML = uniqueTags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
}

function renderAlertKeywords() {
  if (state.alertKeywords.length === 0) {
    keywordList.innerHTML = '<span class="small">등록된 알림 키워드가 없습니다.</span>';
    return;
  }

  keywordList.innerHTML = state.alertKeywords
    .map(
      (keyword) =>
        `<span class="keyword-pill">${escapeHtml(keyword)}<button data-remove-keyword="${keyword}" type="button">x</button></span>`
    )
    .join("");

  keywordList.querySelectorAll("button[data-remove-keyword]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetKeyword = button.dataset.removeKeyword;
      state.alertKeywords = state.alertKeywords.filter((keyword) => keyword !== targetKeyword);
      persistAlertState();
      renderAlertKeywords();
      renderDataStatus();
    });
  });
}

function renderNotificationStatus() {
  const permission = getNotificationPermission();
  if (permission === "unsupported") {
    notificationStatus.textContent = "이 브라우저는 알림 API를 지원하지 않습니다.";
    return;
  }
  if (permission === "granted") {
    notificationStatus.textContent = "알림 권한 허용됨";
    return;
  }
  if (permission === "denied") {
    notificationStatus.textContent = "알림 권한 차단됨(브라우저 설정에서 변경 필요)";
    return;
  }
  notificationStatus.textContent = "알림 권한 미요청";
}

function maybeNotifyDeals() {
  if (!state.alertsEnabled || state.alertKeywords.length === 0) {
    return;
  }

  if (getNotificationPermission() !== "granted") {
    return;
  }

  const lowerKeywords = state.alertKeywords.map((keyword) => keyword.toLowerCase());

  deals.forEach((deal) => {
    const haystack = `${deal.title} ${(deal.eventTags || []).join(" ")}`.toLowerCase();
    lowerKeywords.forEach((keyword, index) => {
      if (!haystack.includes(keyword)) {
        return;
      }
      const rawKeyword = state.alertKeywords[index];
      const notifyKey = `${deal.id}:${rawKeyword}`;
      if (state.notifiedKeys.includes(notifyKey)) {
        return;
      }

      new Notification(`핫딜 키워드 매칭: ${rawKeyword}`, {
        body: `${deal.title} (${deal.source})`,
      });

      state.notifiedKeys.push(notifyKey);
    });
  });

  if (state.notifiedKeys.length > 500) {
    state.notifiedKeys = state.notifiedKeys.slice(-300);
  }
  persistAlertState();
}

function renderDataStatus() {
  if (syncStatus) {
    syncStatus.textContent = `마지막 핫딜 업데이트: ${formatGeneratedAt(state.generatedAt)}`;
  }
}

function renderBookmarks() {
  const bookmarkedDeals = deals.filter((deal) => state.bookmarks.includes(deal.id));

  if (bookmarkedDeals.length === 0) {
    bookmarkList.innerHTML = "<li>스크랩한 딜이 없습니다.</li>";
    return;
  }

  bookmarkList.innerHTML = bookmarkedDeals
    .map(
      (deal) => `<li>
        <button class="bookmark-item" type="button" data-bookmark-detail="${deal.id}">
          ${escapeHtml(deal.title)}
        </button>
      </li>`
    )
    .join("");

  bookmarkList.querySelectorAll("button[data-bookmark-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      openDealDetail(Number(button.dataset.bookmarkDetail));
    });
  });
}

function bindEvents() {
  homeButton?.addEventListener("click", resetToHome);
  homeTitle?.addEventListener("click", resetToHome);
  menuButton?.addEventListener("click", () => {
    setHeaderMenuOpen(Boolean(headerMenu?.hidden));
  });

  headerMenu?.querySelectorAll("[data-menu-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-menu-target");
      if (target === "alerts") {
        scrollToSection(alertsPanel);
        keywordInput?.focus();
      } else if (target === "bookmarks") {
        scrollToSection(bookmarkPanel);
      }
      setHeaderMenuOpen(false);
    });
  });

  sourceSelect.addEventListener("change", () => {
    state.selectedSource = sourceSelect.value;
    state.currentPage = 1;
    render();
  });

  sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value;
    state.currentPage = 1;
    render();
  });

  searchInput.addEventListener("input", () => {
    state.search = searchInput.value.trim();
    state.currentPage = 1;
    render();
  });

  pagePrev?.addEventListener("click", () => {
    if (state.currentPage <= 1) {
      return;
    }
    state.currentPage -= 1;
    renderDeals();
    window.scrollTo({ top: dealList.offsetTop - 120, behavior: "smooth" });
  });

  pageNext?.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(filteredDeals().length / DEALS_PER_PAGE));
    if (state.currentPage >= totalPages) {
      return;
    }
    state.currentPage += 1;
    renderDeals();
    window.scrollTo({ top: dealList.offsetTop - 120, behavior: "smooth" });
  });

  toggleAlert.addEventListener("click", () => {
    state.alertsEnabled = !state.alertsEnabled;
    persistAlertState();
    renderAlertToggle();
    maybeNotifyDeals();
  });

  addKeywordButton.addEventListener("click", () => {
    const keyword = keywordInput.value.trim();
    if (!keyword) {
      return;
    }
    if (!state.alertKeywords.includes(keyword)) {
      state.alertKeywords.push(keyword);
      persistAlertState();
    }
    keywordInput.value = "";
    renderAlertKeywords();
    renderDataStatus();
    maybeNotifyDeals();
  });

  keywordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addKeywordButton.click();
    }
  });

  requestNotificationButton.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      renderNotificationStatus();
      return;
    }
    await Notification.requestPermission();
    renderNotificationStatus();
    maybeNotifyDeals();
  });

  googleLogin.addEventListener("click", async () => {
    if (!authClient) {
      return;
    }
    try {
      await authClient.signIn();
    } catch (error) {
      alert(`로그인 실패: ${error.message}`);
    }
  });

  googleLogout.addEventListener("click", async () => {
    if (!authClient) {
      return;
    }
    try {
      await authClient.signOut();
    } catch (error) {
      alert(`로그아웃 실패: ${error.message}`);
    }
  });

  if (detailModal) {
    detailModal.querySelectorAll("[data-close-detail]").forEach((button) => {
      button.addEventListener("click", closeDealDetail);
    });
    detailModal.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement && event.target.dataset.closeDetail !== undefined) {
        closeDealDetail();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && headerMenu && !headerMenu.hidden) {
      setHeaderMenuOpen(false);
    }
    if (event.key === "Escape" && state.selectedDealId !== null) {
      closeDealDetail();
    }
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node)) {
      return;
    }
    if (!headerMenu || headerMenu.hidden) {
      return;
    }
    if (headerMenu.contains(event.target) || menuButton?.contains(event.target)) {
      return;
    }
    setHeaderMenuOpen(false);
  });
}

function render() {
  renderDashboardHighlights();
  renderSourceOptions();
  renderCategoryTabs();
  renderAlertToggle();
  renderDeals();
  renderTags();
  renderBookmarks();
  renderAlertKeywords();
  renderNotificationStatus();
  renderDataStatus();
  renderDetailModal();
  maybeNotifyDeals();
}

loadUserScopedState();
bindEvents();
Promise.all([loadDeals(), initializeFirebaseAuth()]).then(() => {
  render();
  renderAuthStatus();
});
