const categories = [
  { id: "all", label: "전체" },
  { id: "food", label: "식품" },
  { id: "electronics", label: "전자기기" },
  { id: "overseas", label: "해외핫딜" },
  { id: "festa", label: "할인 페스타" },
];

const fallbackDeals = [];

let deals = [...fallbackDeals];

const state = {
  selectedCategory: "all",
  selectedSource: "all",
  sort: "latest",
  search: "",
  alertsEnabled: false,
  bookmarks: JSON.parse(localStorage.getItem("hotdeal-bookmarks") || "[]"),
  alertKeywords: JSON.parse(localStorage.getItem("hotdeal-alert-keywords") || "[]"),
  notifiedKeys: JSON.parse(localStorage.getItem("hotdeal-notified-keys") || "[]"),
  generatedAt: null,
  policyMode: "local-fallback",
  compliance: [],
  user: null,
  syncStatus: "로컬 모드",
  selectedDealId: null,
};

const categoryTabs = document.getElementById("category-tabs");
const sourceSelect = document.getElementById("source-select");
const sortSelect = document.getElementById("sort-select");
const searchInput = document.getElementById("search-input");
const dealList = document.getElementById("deal-list");
const dealCount = document.getElementById("deal-count");
const tagCloud = document.getElementById("event-tags");
const bookmarkList = document.getElementById("bookmark-list");
const toggleAlert = document.getElementById("toggle-alert");
const googleLogin = document.getElementById("google-login");
const googleLogout = document.getElementById("google-logout");
const authStatus = document.getElementById("auth-status");
const syncStatus = document.getElementById("sync-status");
const dataStatus = document.getElementById("data-status");
const keywordInput = document.getElementById("keyword-input");
const addKeywordButton = document.getElementById("add-keyword");
const keywordList = document.getElementById("keyword-list");
const requestNotificationButton = document.getElementById("request-notification");
const notificationStatus = document.getElementById("notification-status");
const detailModal = document.getElementById("deal-detail-modal");
const detailContent = document.getElementById("deal-detail-content");
const detailTitle = document.getElementById("deal-detail-title");

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

function getCategoryLabel(categoryId) {
  return categories.find((category) => category.id === categoryId)?.label || "기타";
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

function persistBookmarks() {
  localStorage.setItem(storageKey("hotdeal-bookmarks"), JSON.stringify(state.bookmarks));
  queueCloudSync("bookmarks");
}

function persistAlertState() {
  localStorage.setItem(storageKey("hotdeal-alert-keywords"), JSON.stringify(state.alertKeywords));
  localStorage.setItem(storageKey("hotdeal-notified-keys"), JSON.stringify(state.notifiedKeys));
  queueCloudSync("alerts");
}

function setSyncStatus(text) {
  state.syncStatus = text;
  if (syncStatus) {
    syncStatus.textContent = `동기화 상태: ${text}`;
  }
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

    localStorage.setItem(storageKey("hotdeal-bookmarks"), JSON.stringify(state.bookmarks));
    localStorage.setItem(storageKey("hotdeal-alert-keywords"), JSON.stringify(state.alertKeywords));
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
  if (!authClient) {
    authStatus.textContent = "Firebase 설정 전: 데모 모드";
    googleLogout.disabled = true;
    googleLogin.disabled = false;
    return;
  }

  if (state.user) {
    const label = state.user.displayName || state.user.email || "로그인 사용자";
    authStatus.textContent = `로그인됨: ${label}`;
    googleLogin.disabled = true;
    googleLogout.disabled = false;
    return;
  }

  authStatus.textContent = "비로그인 상태";
  googleLogin.disabled = false;
  googleLogout.disabled = true;
}

async function initializeFirebaseAuth() {
  const config = window.FIREBASE_CONFIG;
  if (!config || !config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    authClient = null;
    dbClient = null;
    setSyncStatus("로컬 모드");
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
    setSyncStatus("로컬 모드");
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
        state.selectedCategory === "all" || deal.category === state.selectedCategory;
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
        return new Date(a.expiresAt) - new Date(b.expiresAt);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
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
      render();
    });
  });
}

function renderDeals() {
  const list = filteredDeals();
  dealCount.textContent = `${list.length}건`;

  if (list.length === 0) {
    dealList.innerHTML = '<p class="small">조건에 맞는 딜이 없습니다.</p>';
    return;
  }

  dealList.innerHTML = list
    .map((deal) => {
      const bookmarked = state.bookmarks.includes(deal.id);
      const tags = Array.isArray(deal.eventTags) ? deal.eventTags : [];
      return `<article class="deal-item">
        <div class="deal-top">
          <div>
            <h3>${escapeHtml(deal.title)}</h3>
            <div class="deal-meta">
              <span class="tag tag-strong">${getCategoryLabel(deal.category)}</span>
              ${deal.platform ? `<span class="tag">플랫폼 ${escapeHtml(deal.platform)}</span>` : ""}
              <span class="tag">출처 ${escapeHtml(deal.source)}</span>
              ${deal.sourceCategory ? `<span class="tag">${escapeHtml(deal.sourceCategory)}</span>` : ""}
            </div>
          </div>
          <div class="price">${escapeHtml(displayPrice(deal))}</div>
        </div>
        <p class="deal-summary">${escapeHtml(deal.summary || "핵심 정보 요약이 준비되지 않았습니다.")}</p>
        <div class="deal-submeta">
          <span>${timeAgo(deal.createdAt)}</span>
          ${deal.shipping ? `<span>배송 ${escapeHtml(deal.shipping)}</span>` : ""}
          ${deal.discount ? `<span>할인 ${deal.discount}%</span>` : ""}
        </div>
        <div class="deal-meta">${tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("")}</div>
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
    return;
  }

  detailModal.hidden = false;
  detailTitle.textContent = deal.title;
  const points = Array.isArray(deal.summaryPoints) ? deal.summaryPoints : [];
  const tags = Array.isArray(deal.eventTags) ? deal.eventTags : [];

  detailContent.innerHTML = `
    <div class="detail-meta-row">
      <span class="tag tag-strong">${getCategoryLabel(deal.category)}</span>
      ${deal.platform ? `<span class="tag">플랫폼 ${escapeHtml(deal.platform)}</span>` : ""}
      <span class="tag">출처 ${escapeHtml(deal.source)}</span>
      ${deal.sourceCategory ? `<span class="tag">${escapeHtml(deal.sourceCategory)}</span>` : ""}
    </div>
    <p class="detail-summary">${escapeHtml(deal.summary || "")}</p>
    <div class="detail-grid">
      <div>
        <span class="detail-label">가격</span>
        <strong>${escapeHtml(displayPrice(deal))}</strong>
      </div>
      <div>
        <span class="detail-label">배송</span>
        <strong>${escapeHtml(deal.shipping || "원문 확인")}</strong>
      </div>
      <div>
        <span class="detail-label">업데이트</span>
        <strong>${escapeHtml(new Date(deal.createdAt).toLocaleString("ko-KR"))}</strong>
      </div>
      <div>
        <span class="detail-label">남은 시간</span>
        <strong>${hoursLeft(deal.expiresAt)}시간</strong>
      </div>
    </div>
    ${points.length > 0 ? `<ul class="detail-points">${points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>` : ""}
    <div class="deal-meta">${tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("")}</div>
    <div class="detail-actions">
      <a href="${deal.url}" target="_blank" rel="noreferrer">커뮤니티 글 보기</a>
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
  tagCloud.innerHTML = uniqueTags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("");
}

function renderAlertKeywords() {
  if (state.alertKeywords.length === 0) {
    keywordList.innerHTML = '<span class="small">등록된 알림 키워드가 없습니다.</span>';
    return;
  }

  keywordList.innerHTML = state.alertKeywords
    .map(
      (keyword) =>
        `<span class="keyword-pill">#${keyword}<button data-remove-keyword="${keyword}" type="button">x</button></span>`
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
  const generatedLabel = state.generatedAt
    ? new Date(state.generatedAt).toLocaleString("ko-KR")
    : "로컬 샘플 데이터";
  const okCount = state.compliance.filter((item) => item.status === "ok").length;
  const failCount = state.compliance.filter((item) => item.status !== "ok").length;
  dataStatus.textContent = `데이터 시각: ${generatedLabel} · 수집 모드: ${state.policyMode} · 소스 상태: 성공 ${okCount} / 실패 ${failCount} · 알림 키워드 ${state.alertKeywords.length}개`;
}

function renderBookmarks() {
  const bookmarkedDeals = deals.filter((deal) => state.bookmarks.includes(deal.id));

  if (bookmarkedDeals.length === 0) {
    bookmarkList.innerHTML = "<li>스크랩한 딜이 없습니다.</li>";
    return;
  }

  bookmarkList.innerHTML = bookmarkedDeals.map((deal) => `<li>${escapeHtml(deal.title)}</li>`).join("");
}

function bindEvents() {
  sourceSelect.addEventListener("change", () => {
    state.selectedSource = sourceSelect.value;
    renderDeals();
  });

  sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value;
    renderDeals();
  });

  searchInput.addEventListener("input", () => {
    state.search = searchInput.value.trim();
    renderDeals();
  });

  toggleAlert.addEventListener("click", () => {
    state.alertsEnabled = !state.alertsEnabled;
    toggleAlert.textContent = state.alertsEnabled ? "키워드 알림 켜짐" : "키워드 알림 켜기";
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
      alert("firebase-config.js를 설정하면 Google 로그인이 활성화됩니다.");
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
    detailModal.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement && event.target.dataset.closeDetail !== undefined) {
        closeDealDetail();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.selectedDealId !== null) {
      closeDealDetail();
    }
  });
}

function render() {
  renderSourceOptions();
  renderCategoryTabs();
  renderDeals();
  renderTags();
  renderBookmarks();
  renderAlertKeywords();
  renderNotificationStatus();
  renderDataStatus();
  renderDetailModal();
  maybeNotifyDeals();
}

bindEvents();
Promise.all([loadDeals(), initializeFirebaseAuth()]).then(() => {
  render();
  renderAuthStatus();
});
