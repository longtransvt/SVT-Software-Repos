/* =========================================================================
   IT Software Repository Portal — tích hợp Google Drive thật
   -------------------------------------------------------------------------
   Xem hướng dẫn cấu hình đầy đủ tại: ../SETUP-GOOGLE-DRIVE.md

   Cách hoạt động:
   1. Người dùng bấm "Kết nối Google Drive" -> Google Identity Services (GIS)
      mở popup OAuth2, trả về access token (scope drive.file).
   2. Khi upload: tìm (hoặc tạo mới) thư mục con theo tên hãng bên trong
      thư mục loại (Firmware/Application/OS/Patch) đã cấu hình sẵn Folder ID.
   3. Upload file bằng Resumable Upload (hỗ trợ file lớn + progress %).
   4. File mới sẽ có link "Mở trên Drive" trỏ thẳng tới webViewLink thật.
   ========================================================================= */

// ============================ CẤU HÌNH ==================================
// Điền các giá trị này theo hướng dẫn trong SETUP-GOOGLE-DRIVE.md
const DRIVE_CONFIG = {
  CLIENT_ID: "11402124429-ieasmd98scuah6hd8tv3gqb15u1quf6c.apps.googleusercontent.com",
  // spreadsheets scope cần thiết để ghi log vào Master-Index (Sheet có sẵn,
  // không do app tạo ra nên drive.file không đủ quyền ghi).
  // openid/email/profile: lấy thông tin tài khoản đăng nhập (họ tên, email, ảnh đại diện)
  // để hiển thị lên giao diện và ghi đúng "Uploaded By" thay vì tên giả định.
  SCOPES:
    "https://www.googleapis.com/auth/drive.file " +
    "https://www.googleapis.com/auth/spreadsheets " +
    "openid email profile",
  // Chỉ chấp nhận đăng nhập bằng email thuộc domain công ty (Google Workspace).
  // Để trống ("") nếu muốn cho phép mọi tài khoản Google đăng nhập.
  ALLOWED_DOMAIN: "svtech.com.vn",
  DRIVE_ID: "0AKLK-dRArCLLUk9PVA", // Shared Drive "[BẢO MẬT]_SYSTEM HCM"
  CATEGORY_FOLDER_IDS: {
    Firmware: "1DlMPVRh9zOgo5wWkPQGLRr8nqV4F0obp",     // FW-REPO/01_Firmware
    Application: "1HUpl6OWw7PUJJonVbfUHK5IJVAm0aOTF",  // FW-REPO/02_Application
    OS: "1Tu1RVAOvPOqq2gwf0bI4eOTap70t-_Dk",            // FW-REPO/03_OS
    Patch: "1bH3p6BlIHyIrvFC3Xj3FotkorIG4dNK1",         // FW-REPO/04_Patch_OS
  },
  // Master-Index Google Sheet: xem SETUP-GOOGLE-DRIVE.md mục "Ghi log Master-Index"
  MASTER_INDEX_SHEET_ID: "1gg_9rUin7h9APg5_i0sVLF6YFa7ztbEYWvDzWeHqwr4",
  MASTER_INDEX_SHEET_NAME: "Master-Index",
  // Folder 00_INDEX_METADATA — nơi nút "Khởi tạo Master-Index" sẽ tạo Sheet mới nếu chưa có
  INDEX_METADATA_FOLDER_ID: "1u60ljRoUaNLxuMr9R82CiuvaYpfpjv9a",
  // Ngưỡng dung lượng (byte) để tính checksum SHA-256 phía trình duyệt;
  // file lớn hơn sẽ ghi "N/A (file quá lớn)" để tránh treo trình duyệt.
  CHECKSUM_MAX_BYTES: 200 * 1024 * 1024, // 200MB
};
// ==========================================================================

// ---- Danh sách hãng mặc định (khớp với kiến trúc thư mục trong README) ----
const DEFAULT_VENDORS = [
  { id: "hitachi", name: "Hitachi", icon: "🟥" },
  { id: "hpe", name: "HPE", icon: "🟩" },
  { id: "dell", name: "Dell", icon: "🟦" },
  { id: "cisco", name: "Cisco", icon: "🔷" },
  { id: "netapp", name: "NetApp", icon: "🔵" },
  { id: "oracle", name: "Oracle", icon: "🔴" },
  { id: "microsoft", name: "Microsoft Windows", icon: "🪟" },
  { id: "redhat", name: "RedHat Linux", icon: "🎩" },
];

// ---- Dữ liệu mẫu để minh hoạ bảng danh sách file (không có trên Drive thật) ----
const SAMPLE_FILES = [
  { vendor: "hpe", category: "Firmware", product: "ProLiant DL380 Gen10", version: "iLO5 v2.78", date: "2026-09-15", user: "nguyen.van.a", status: "Active", driveLink: null },
  { vendor: "hpe", category: "Firmware", product: "ProLiant DL360 Gen9", version: "iLO4 v2.55", date: "2025-02-10", user: "tran.thi.b", status: "Deprecated", driveLink: null },
  { vendor: "dell", category: "Firmware", product: "PowerEdge R740", version: "iDRAC 6.10.30", date: "2026-08-02", user: "le.van.c", status: "Active", driveLink: null },
  { vendor: "cisco", category: "OS", product: "Catalyst 9300", version: "IOS-XE 17.12.3", date: "2026-07-20", user: "nguyen.van.a", status: "Active", driveLink: null },
  { vendor: "cisco", category: "Patch", product: "Nexus 9000", version: "NX-OS 9.3.12 patch", date: "2026-06-01", user: "pham.thi.d", status: "Active", driveLink: null },
  { vendor: "netapp", category: "Firmware", product: "AFF A400", version: "ONTAP 9.14.1P4", date: "2026-05-11", user: "le.van.c", status: "Active", driveLink: null },
  { vendor: "hitachi", category: "Firmware", product: "VSP E1090", version: "SVOS 9.8.3", date: "2025-11-30", user: "tran.thi.b", status: "Archived", driveLink: null },
  { vendor: "oracle", category: "Application", product: "Oracle Database", version: "19.24 RU", date: "2026-08-28", user: "nguyen.van.a", status: "Active", driveLink: null },
  { vendor: "microsoft", category: "OS", product: "Windows Server 2022", version: "Build 20348.2966", date: "2026-09-01", user: "pham.thi.d", status: "Active", driveLink: null },
  { vendor: "microsoft", category: "Patch", product: "Windows Server 2019", version: "KB5041160", date: "2026-04-14", user: "le.van.c", status: "Deprecated", driveLink: null },
  { vendor: "redhat", category: "OS", product: "RHEL 9", version: "9.4 ISO", date: "2026-06-15", user: "tran.thi.b", status: "Active", driveLink: null },
  { vendor: "redhat", category: "Patch", product: "RHEL 8", version: "RHSA-2026:5321", date: "2026-08-19", user: "nguyen.van.a", status: "Active", driveLink: null },
];

const CATEGORY_ICON = { Firmware: "📦", Application: "🧩", OS: "💽", Patch: "🩹" };

// ---- State ----
const state = {
  vendors: [...DEFAULT_VENDORS],
  files: [...SAMPLE_FILES],
  activeVendor: "all",
  activeCategory: "all",
  statusFilter: "all",
  sortBy: "date-desc",
  searchTerm: "",
  accessToken: null,   // token OAuth hiện tại (chỉ giữ trong bộ nhớ, không lưu localStorage)
  tokenClient: null,   // Google Identity Services token client
  folderCache: {},     // cache "category::vendorName" -> folderId (tránh gọi API lặp lại)
  currentUser: null,   // { email, name, picture } của người đang đăng nhập
};

// ---- DOM refs ----
const vendorListEl = document.getElementById("vendorList");
const fileTableBody = document.getElementById("fileTableBody");
const emptyStateEl = document.getElementById("emptyState");
const breadcrumbEl = document.getElementById("breadcrumb");
const resultCountEl = document.getElementById("resultCount");
const searchInput = document.getElementById("searchInput");
const statusFilterEl = document.getElementById("statusFilter");
const sortFilterEl = document.getElementById("sortFilter");
const categoryTabsEl = document.getElementById("categoryTabs");
const connectDriveBtn = document.getElementById("connectDriveBtn");
const uploadHintEl = document.getElementById("uploadHint");
const progressWrap = document.getElementById("progressWrap");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");
const submitUploadBtn = document.getElementById("submitUploadBtn");
const userAvatarEl = document.getElementById("userAvatar");
const userLabelEl = document.getElementById("userLabel");
const logoutBtnEl = document.getElementById("logoutBtn");

function vendorName(id) {
  const v = state.vendors.find((v) => v.id === id);
  return v ? `${v.icon} ${v.name}` : id;
}

// ========================================================================
// GOOGLE DRIVE AUTH
// ========================================================================

function isDriveConfigured() {
  return (
    DRIVE_CONFIG.CLIENT_ID &&
    !DRIVE_CONFIG.CLIENT_ID.startsWith("YOUR_") &&
    Object.values(DRIVE_CONFIG.CATEGORY_FOLDER_IDS).every((id) => id && !id.startsWith("FOLDER_ID_"))
  );
}

function isMasterIndexConfigured() {
  return !!getEffectiveSheetId();
}

// Sheet ID có thể lấy từ DRIVE_CONFIG (đã hard-code) hoặc từ localStorage
// (do nút "Khởi tạo Master-Index" tự tạo và lưu lại) — ưu tiên DRIVE_CONFIG.
function getEffectiveSheetId() {
  if (DRIVE_CONFIG.MASTER_INDEX_SHEET_ID && !DRIVE_CONFIG.MASTER_INDEX_SHEET_ID.startsWith("YOUR_")) {
    return DRIVE_CONFIG.MASTER_INDEX_SHEET_ID;
  }
  return localStorage.getItem("masterIndexSheetId") || null;
}

function initGoogleAuth() {
  if (typeof google === "undefined" || !google.accounts) {
    console.warn("Google Identity Services chưa tải xong, thử lại sau...");
    return;
  }
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: DRIVE_CONFIG.CLIENT_ID,
    scope: DRIVE_CONFIG.SCOPES,
    callback: async (resp) => {
      if (resp.error) {
        alert("Đăng nhập Google thất bại: " + resp.error);
        return;
      }
      state.accessToken = resp.access_token;
      try {
        await fetchUserInfo();
      } catch (err) {
        console.error(err);
        alert("Đăng nhập thành công nhưng không lấy được thông tin tài khoản: " + err.message);
      }
      updateConnectionUI(true);
    },
  });
}

// Gọi Google UserInfo endpoint để lấy email/tên/ảnh của người vừa đăng nhập,
// đồng thời kiểm tra domain công ty nếu ALLOWED_DOMAIN được cấu hình.
async function fetchUserInfo() {
  const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: driveHeaders(),
  });
  if (!resp.ok) throw new Error(`Không lấy được thông tin tài khoản (HTTP ${resp.status})`);
  const info = await resp.json();

  if (DRIVE_CONFIG.ALLOWED_DOMAIN && !info.email.toLowerCase().endsWith("@" + DRIVE_CONFIG.ALLOWED_DOMAIN.toLowerCase())) {
    signOut();
    alert(
      `Tài khoản "${info.email}" không thuộc domain công ty (@${DRIVE_CONFIG.ALLOWED_DOMAIN}).\n` +
      "Vui lòng đăng nhập lại bằng email công ty."
    );
    throw new Error("Sai domain tài khoản");
  }

  state.currentUser = { email: info.email, name: info.name || info.email, picture: info.picture || "" };
}

function initialsOf(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function updateConnectionUI(connected) {
  if (connected && state.currentUser) {
    connectDriveBtn.textContent = "✅ Đã đăng nhập";
    connectDriveBtn.classList.add("btn-connected");
    uploadHintEl.textContent = "✅ Đã đăng nhập Google. File sẽ được upload thẳng vào thư mục hãng/loại tương ứng.";
    uploadHintEl.classList.add("connected");

    userLabelEl.textContent = state.currentUser.name;
    userLabelEl.title = state.currentUser.email;
    if (state.currentUser.picture) {
      userAvatarEl.innerHTML = `<img src="${state.currentUser.picture}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
      userAvatarEl.textContent = initialsOf(state.currentUser.name);
    }
    logoutBtnEl.style.display = "inline";
  } else {
    connectDriveBtn.textContent = "🔐 Đăng nhập bằng Google";
    connectDriveBtn.classList.remove("btn-connected");
    uploadHintEl.textContent = '⚠️ Chưa đăng nhập Google. Bấm "🔐 Đăng nhập bằng Google" ở góc trên trước khi tải lên.';
    uploadHintEl.classList.remove("connected");

    userAvatarEl.textContent = "?";
    userLabelEl.textContent = "Chưa đăng nhập";
    userLabelEl.title = "";
    logoutBtnEl.style.display = "none";
  }
}

function signOut() {
  if (state.accessToken && google?.accounts?.oauth2?.revoke) {
    google.accounts.oauth2.revoke(state.accessToken, () => {});
  }
  state.accessToken = null;
  state.currentUser = null;
  state.folderCache = {};
  updateConnectionUI(false);
}

logoutBtnEl.addEventListener("click", (e) => {
  e.stopPropagation();
  signOut();
});

connectDriveBtn.addEventListener("click", () => {
  if (!isDriveConfigured()) {
    alert(
      "Chưa cấu hình Google Drive.\n\n" +
      "Vui lòng điền CLIENT_ID và CATEGORY_FOLDER_IDS trong assets/script.js.\n" +
      "Xem hướng dẫn chi tiết tại SETUP-GOOGLE-DRIVE.md."
    );
    return;
  }
  if (!state.tokenClient) initGoogleAuth();
  if (state.tokenClient) {
    state.tokenClient.requestAccessToken({ prompt: state.accessToken ? "" : "consent" });
  }
});

// ========================================================================
// DRIVE API HELPERS
// ========================================================================

function driveHeaders(extra = {}) {
  return { Authorization: `Bearer ${state.accessToken}`, ...extra };
}

// Tìm folder theo tên bên trong parentId; nếu chưa có thì tạo mới.
async function findOrCreateFolder(name, parentId) {
  const cacheKey = `${parentId}::${name}`;
  if (state.folderCache[cacheKey]) return state.folderCache[cacheKey];

  const supportsAllDrives = "supportsAllDrives=true&includeItemsFromAllDrives=true";
  const corpora = DRIVE_CONFIG.DRIVE_ID ? `&corpora=drive&driveId=${DRIVE_CONFIG.DRIVE_ID}` : "";
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  );

  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&${supportsAllDrives}${corpora}`;
  const listResp = await fetch(listUrl, { headers: driveHeaders() });
  if (!listResp.ok) throw new Error(`Không tìm được thư mục "${name}" (HTTP ${listResp.status})`);
  const listData = await listResp.json();

  let folderId;
  if (listData.files && listData.files.length > 0) {
    folderId = listData.files[0].id;
  } else {
    const createResp = await fetch(
      `https://www.googleapis.com/drive/v3/files?supportsAllDrives=true`,
      {
        method: "POST",
        headers: driveHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        }),
      }
    );
    if (!createResp.ok) throw new Error(`Không tạo được thư mục "${name}" (HTTP ${createResp.status})`);
    const created = await createResp.json();
    folderId = created.id;
  }

  state.folderCache[cacheKey] = folderId;
  return folderId;
}

// Upload file bằng Resumable Upload, trả về {id, webViewLink} + báo progress qua onProgress(percent)
function resumableUpload(file, folderId, onProgress) {
  return new Promise((resolve, reject) => {
    fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true`, {
      method: "POST",
      headers: driveHeaders({
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.type || "application/octet-stream",
        "X-Upload-Content-Length": file.size,
      }),
      body: JSON.stringify({ name: file.name, parents: [folderId] }),
    })
      .then((initResp) => {
        if (!initResp.ok) throw new Error(`Không khởi tạo được phiên upload (HTTP ${initResp.status})`);
        const uploadUrl = initResp.headers.get("Location");
        if (!uploadUrl) throw new Error("Thiếu upload URL trong phản hồi Drive API.");

        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const result = JSON.parse(xhr.responseText);
            fetch(`https://www.googleapis.com/drive/v3/files/${result.id}?fields=id,webViewLink&supportsAllDrives=true`, {
              headers: driveHeaders(),
            })
              .then((r) => r.json())
              .then((meta) => resolve({ id: result.id, webViewLink: meta.webViewLink }))
              .catch(() => resolve({ id: result.id, webViewLink: null }));
          } else {
            reject(new Error(`Upload thất bại (HTTP ${xhr.status}): ${xhr.responseText}`));
          }
        };
        xhr.onerror = () => reject(new Error("Lỗi mạng khi upload file."));
        xhr.send(file);
      })
      .catch(reject);
  });
}

// ========================================================================
// MASTER-INDEX GOOGLE SHEET LOGGING
// ========================================================================

// Tính SHA-256 checksum phía trình duyệt (bỏ qua nếu file quá lớn để tránh treo UI)
async function computeChecksum(file) {
  if (file.size > DRIVE_CONFIG.CHECKSUM_MAX_BYTES) return "N/A (file quá lớn)";
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (err) {
    console.warn("Không tính được checksum:", err);
    return "N/A";
  }
}

// Ghi 1 dòng mới vào Google Sheet "Master-Index" qua Sheets API v4.
// Thứ tự cột: Vendor | Category | Product/Model | Version | Release/Upload Date
// | Uploaded By | Checksum SHA-256 | Change Log URL | Status | Drive Link
async function appendToMasterIndex(record) {
  if (!isMasterIndexConfigured()) return { skipped: true };

  const row = [
    record.vendorLabel,
    record.category,
    record.product,
    record.version,
    record.date,
    record.user,
    record.checksum || "",
    record.changelog || "",
    record.status,
    record.driveLink || "",
  ];

  const range = `${DRIVE_CONFIG.MASTER_INDEX_SHEET_NAME}!A:J`;
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${getEffectiveSheetId()}` +
    `/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const resp = await fetch(url, {
    method: "POST",
    headers: driveHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ values: [row] }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Ghi Master-Index thất bại (HTTP ${resp.status}): ${errText}`);
  }
  return { skipped: false };
}

// Tạo mới Google Sheet "Master-Index" trong folder 00_INDEX_METADATA (chỉ chạy 1 lần,
// dùng chính access token của người bấm nút — không cần chia sẻ quyền cho ai khác).
async function createMasterIndexSheet() {
  if (!state.accessToken) {
    alert("Vui lòng bấm '🔐 Đăng nhập bằng Google' trước.");
    return;
  }
  if (isMasterIndexConfigured()) {
    const ok = confirm(
      `Đã có Master-Index Sheet ID: ${getEffectiveSheetId()}.\nBạn có chắc muốn tạo Sheet MỚI (sẽ không dùng sheet cũ nữa)?`
    );
    if (!ok) return;
  }

  try {
    // 1) Tạo file Google Sheet trong đúng folder 00_INDEX_METADATA
    const createResp = await fetch(`https://www.googleapis.com/drive/v3/files?supportsAllDrives=true`, {
      method: "POST",
      headers: driveHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        name: "Master-Index",
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: [DRIVE_CONFIG.INDEX_METADATA_FOLDER_ID],
      }),
    });
    if (!createResp.ok) throw new Error(`Tạo Sheet thất bại (HTTP ${createResp.status})`);
    const file = await createResp.json();
    const sheetId = file.id;

    // 2) Đổi tên tab mặc định "Sheet1" -> "Master-Index"
    const metaResp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`
    , { headers: driveHeaders() });
    const meta = await metaResp.json();
    const firstSheetId = meta.sheets[0].properties.sheetId;

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: "POST",
      headers: driveHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId: firstSheetId, title: DRIVE_CONFIG.MASTER_INDEX_SHEET_NAME },
              fields: "title",
            },
          },
        ],
      }),
    });

    // 3) Ghi hàng tiêu đề cột
    const headerRange = `${DRIVE_CONFIG.MASTER_INDEX_SHEET_NAME}!A1:J1`;
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(headerRange)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: driveHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          values: [[
            "Vendor", "Category", "Product/Model", "Version", "Upload Date",
            "Uploaded By", "Checksum (SHA-256)", "Change Log URL", "Status", "Drive Link",
          ]],
        }),
      }
    );

    localStorage.setItem("masterIndexSheetId", sheetId);
    alert(
      "✅ Đã tạo Google Sheet 'Master-Index' thành công trong 00_INDEX_METADATA!\n\n" +
      `Sheet ID: ${sheetId}\n\n` +
      "Sheet ID này đã được lưu để dùng ngay trên trình duyệt này.\n" +
      "Để TẤT CẢ kỹ sư khác cùng dùng chung 1 Sheet, hãy gửi Sheet ID trên cho quản trị " +
      "để điền cố định vào MASTER_INDEX_SHEET_ID trong assets/script.js."
    );
    window.open(file.webViewLink || `https://docs.google.com/spreadsheets/d/${sheetId}/edit`, "_blank");
  } catch (err) {
    console.error(err);
    alert("Tạo Master-Index Sheet thất bại: " + err.message);
  }
}

document.getElementById("initSheetBtn").addEventListener("click", createMasterIndexSheet);

// ========================================================================
// RENDER SIDEBAR / TABLE
// ========================================================================

function renderVendors() {
  vendorListEl.innerHTML = "";

  const allCount = state.files.length;
  const allLi = document.createElement("li");
  allLi.className = state.activeVendor === "all" ? "active" : "";
  allLi.innerHTML = `<span>🗂️ Tất cả hãng</span><span class="vendor-count">${allCount}</span>`;
  allLi.onclick = () => { state.activeVendor = "all"; renderVendors(); renderFiles(); };
  vendorListEl.appendChild(allLi);

  state.vendors.forEach((v) => {
    const count = state.files.filter((f) => f.vendor === v.id).length;
    const li = document.createElement("li");
    li.className = state.activeVendor === v.id ? "active" : "";
    li.innerHTML = `<span>${v.icon} ${v.name}</span><span class="vendor-count">${count}</span>`;
    li.onclick = () => { state.activeVendor = v.id; renderVendors(); renderFiles(); };
    vendorListEl.appendChild(li);
  });
}

function getFilteredFiles() {
  let list = [...state.files];

  if (state.activeVendor !== "all") list = list.filter((f) => f.vendor === state.activeVendor);
  if (state.activeCategory !== "all") list = list.filter((f) => f.category === state.activeCategory);
  if (state.statusFilter !== "all") list = list.filter((f) => f.status === state.statusFilter);

  if (state.searchTerm.trim()) {
    const q = state.searchTerm.trim().toLowerCase();
    list = list.filter((f) =>
      [f.product, f.version, vendorName(f.vendor), f.category, f.user]
        .join(" ").toLowerCase().includes(q)
    );
  }

  switch (state.sortBy) {
    case "date-asc": list.sort((a, b) => a.date.localeCompare(b.date)); break;
    case "name-asc": list.sort((a, b) => a.product.localeCompare(b.product)); break;
    default: list.sort((a, b) => b.date.localeCompare(a.date));
  }
  return list;
}

function renderFiles() {
  const files = getFilteredFiles();
  fileTableBody.innerHTML = "";

  breadcrumbEl.textContent =
    (state.activeVendor === "all" ? "Tất cả hãng" : vendorName(state.activeVendor)) +
    (state.activeCategory === "all" ? "" : ` / ${state.activeCategory}`);

  resultCountEl.textContent = `${files.length} kết quả`;
  emptyStateEl.style.display = files.length ? "none" : "block";

  files.forEach((f, idx) => {
    const tr = document.createElement("tr");
    const fileLabel = `${f.product} — ${f.version}`.replace(/\s+/g, " ");
    const actionBtn = f.driveLink
      ? `<button class="link-btn" data-action="open" data-idx="${idx}">🔗 Mở trên Drive</button>`
      : `<button class="btn btn-outline btn-small" data-action="download" data-idx="${idx}">⬇️ Tải xuống</button>`;
    tr.innerHTML = `
      <td class="file-name">${CATEGORY_ICON[f.category] || "📄"} ${fileLabel}</td>
      <td>${vendorName(f.vendor)}</td>
      <td>${f.category}</td>
      <td>${f.product}</td>
      <td>${f.version}</td>
      <td>${f.date}</td>
      <td>${f.user}</td>
      <td><span class="badge badge-${f.status}">${f.status}</span></td>
      <td class="row-actions">${actionBtn}</td>
    `;
    fileTableBody.appendChild(tr);
  });

  fileTableBody.querySelectorAll('[data-action="download"]').forEach((btn) => {
    btn.addEventListener("click", () => downloadFile(files[Number(btn.dataset.idx)]));
  });
  fileTableBody.querySelectorAll('[data-action="open"]').forEach((btn) => {
    btn.addEventListener("click", () => window.open(files[Number(btn.dataset.idx)].driveLink, "_blank"));
  });
}

function downloadFile(file) {
  alert(
    `"${file.product} — ${file.version}" là dữ liệu mẫu minh hoạ, chưa có trên Drive thật.\n` +
    `Các file được tải lên qua nút "Tải lên phiên bản mới" sau khi kết nối Drive sẽ có link "Mở trên Drive" thật.`
  );
}

// ========================================================================
// TABS / FILTERS
// ========================================================================

categoryTabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  categoryTabsEl.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  state.activeCategory = btn.dataset.category;
  renderFiles();
});

searchInput.addEventListener("input", (e) => { state.searchTerm = e.target.value; renderFiles(); });
statusFilterEl.addEventListener("change", (e) => { state.statusFilter = e.target.value; renderFiles(); });
sortFilterEl.addEventListener("change", (e) => { state.sortBy = e.target.value; renderFiles(); });

// ========================================================================
// UPLOAD MODAL
// ========================================================================

const uploadOverlay = document.getElementById("uploadModalOverlay");
const fVendor = document.getElementById("fVendor");

function refreshVendorSelect() {
  fVendor.innerHTML = state.vendors.map((v) => `<option value="${v.id}">${v.icon} ${v.name}</option>`).join("");
}

document.getElementById("openUploadBtn").addEventListener("click", () => {
  refreshVendorSelect();
  progressWrap.style.display = "none";
  progressFill.style.width = "0%";
  uploadOverlay.classList.add("open");
});
document.getElementById("closeUploadModal").addEventListener("click", () => uploadOverlay.classList.remove("open"));
document.getElementById("cancelUploadBtn").addEventListener("click", () => uploadOverlay.classList.remove("open"));

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const category = document.getElementById("fCategory").value;
  const vendorId = fVendor.value;
  const vendorLabel = state.vendors.find((v) => v.id === vendorId)?.name || vendorId;
  const product = document.getElementById("fProduct").value.trim();
  const version = document.getElementById("fVersion").value.trim();
  const changelog = document.getElementById("fChangelog").value.trim();
  const fileInput = document.getElementById("fFile");
  const fileObj = fileInput.files[0];
  if (!product || !version || !fileObj) return;

  const baseRecord = {
    vendor: vendorId,
    vendorLabel,
    category,
    product,
    version,
    changelog,
    date: new Date().toISOString().slice(0, 10),
    user: state.currentUser ? state.currentUser.email : "kỹ sư demo (chưa đăng nhập)",
    status: "Active",
    driveLink: null,
    checksum: "",
  };

  // --- Trường hợp chưa kết nối Drive: chỉ demo trong bảng, không upload thật ---
  if (!state.accessToken || !isDriveConfigured()) {
    state.files.unshift(baseRecord);
    finishUploadUI();
    return;
  }

  // --- Trường hợp đã kết nối: upload thật lên Google Drive ---
  try {
    submitUploadBtn.disabled = true;
    progressWrap.style.display = "flex";
    progressFill.style.width = "0%";
    progressLabel.textContent = "Đang chuẩn bị thư mục...";

    const categoryFolderId = DRIVE_CONFIG.CATEGORY_FOLDER_IDS[category];
    const vendorFolderId = await findOrCreateFolder(vendorLabel, categoryFolderId);

    progressLabel.textContent = "Đang tính checksum...";
    baseRecord.checksum = await computeChecksum(fileObj);

    progressLabel.textContent = "0%";
    const result = await resumableUpload(fileObj, vendorFolderId, (pct) => {
      progressFill.style.width = pct + "%";
      progressLabel.textContent = pct + "%";
    });

    baseRecord.driveLink = result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`;

    progressFill.style.width = "100%";
    progressLabel.textContent = "Đang ghi log Master-Index...";
    try {
      const logResult = await appendToMasterIndex(baseRecord);
      if (logResult.skipped) {
        console.info("Bỏ qua ghi Master-Index: chưa cấu hình MASTER_INDEX_SHEET_ID.");
      }
    } catch (logErr) {
      console.error(logErr);
      alert(
        "File đã upload lên Drive thành công, nhưng ghi log vào Master-Index thất bại:\n" +
        logErr.message +
        "\n\nHãy kiểm tra lại MASTER_INDEX_SHEET_ID và quyền chỉnh sửa Sheet."
      );
    }

    state.files.unshift(baseRecord);
    finishUploadUI();
  } catch (err) {
    console.error(err);
    alert("Upload lên Google Drive thất bại: " + err.message);
  } finally {
    submitUploadBtn.disabled = false;
  }
});

function finishUploadUI() {
  uploadOverlay.classList.remove("open");
  document.getElementById("uploadForm").reset();
  progressWrap.style.display = "none";
  state.activeVendor = "all";
  state.activeCategory = "all";
  categoryTabsEl.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  categoryTabsEl.querySelector('[data-category="all"]').classList.add("active");
  renderVendors();
  renderFiles();
}

// ========================================================================
// ADD VENDOR MODAL
// ========================================================================

const vendorOverlay = document.getElementById("vendorModalOverlay");
document.getElementById("addVendorBtn").addEventListener("click", () => vendorOverlay.classList.add("open"));
document.getElementById("closeVendorModal").addEventListener("click", () => vendorOverlay.classList.remove("open"));
document.getElementById("cancelVendorBtn").addEventListener("click", () => vendorOverlay.classList.remove("open"));

document.getElementById("vendorForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("vName").value.trim();
  const icon = document.getElementById("vIcon").value.trim() || "🏷️";
  if (!name) return;

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  // Thư mục con thật trên Drive sẽ được tự tạo (findOrCreateFolder) ngay lần
  // đầu tiên có ai đó upload file cho hãng này, không cần tạo trước ở đây.
  state.vendors.push({ id, name, icon });

  vendorOverlay.classList.remove("open");
  e.target.reset();
  renderVendors();
});

// ---- Init ----
renderVendors();
renderFiles();
updateConnectionUI(false);
window.addEventListener("load", initGoogleAuth);
