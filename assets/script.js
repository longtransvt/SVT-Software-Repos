/* =========================================================================
   IT Software Repository Portal — tích hợp Google Drive thật
   -------------------------------------------------------------------------
   Xem hướng dẫn cấu hình đầy đủ tại: ../SETUP-GOOGLE-DRIVE.md

   Cách hoạt động:
   1. Người dùng bấm "Đăng nhập bằng Google" -> Google Identity Services (GIS)
      mở popup OAuth2, trả về access token + thông tin tài khoản.
   2. Cấu trúc thư mục thật trên Drive là THEO HÃNG trước, mỗi hãng có sẵn
      5 thư mục con cố định: 01_Firmware, 02_Application, 03_OS, 04_Patch_OS,
      99_Archive. Khi upload, app dùng thẳng Folder ID đã cấu hình sẵn trong
      VENDOR_CATEGORY_FOLDER_IDS bên dưới — KHÔNG tạo mới/tìm kiếm lại bằng tên
      cho các hãng đã biết, để tránh tạo trùng thư mục do độ trễ index tìm kiếm
      của Drive. Chỉ hãng MỚI (chưa có trong danh sách) mới dùng findOrCreateFolder.
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
  // Thư mục gốc FW-REPO — dùng làm nơi tự tạo folder cho HÃNG MỚI (chưa có sẵn ID cấu hình).
  FW_REPO_ROOT_ID: "13WbsXxjez47VLrepNNZiolYZQtAWDy65",
  // Map "Category" trong form upload -> tên thư mục con thật trên Drive.
  CATEGORY_SUBFOLDER_NAMES: {
    Firmware: "01_Firmware",
    Application: "02_Application",
    OS: "03_OS",
    Patch: "04_Patch_OS",
  },
  // Folder ID CỐ ĐỊNH cho từng hãng + từng loại — lấy trực tiếp từ cấu trúc thật
  // trên Shared Drive (FW-REPO/{Hãng}/{01_Firmware,02_Application,03_OS,04_Patch_OS}).
  // Dùng thẳng ID này khi upload để KHÔNG tạo trùng thư mục.
  VENDOR_CATEGORY_FOLDER_IDS: {
    hitachi: {
      Firmware: "1Wo5idilWXyzTAixF8BK0GTHL9t9KpSuI",
      Application: "1kQL1AabUgrN6UM6mqdaLKyzicaFLd8Om",
      OS: "1P8vJL_pi7Mtr9bzkJjgD2d0uee6M5nQY",
      Patch: "1cPc2vIvSXTM0ars3NtwYg3sAEw7645o0",
    },
    hpe: {
      Firmware: "1kD25q8PoDzpNubwv4K7WwqZ87PKx-bH9",
      Application: "1QIaxUf8-0bKRQ1llwALV6wuzXzjBy37c",
      OS: "12SoTUxhdEc7q-QitW299MS7mHbXTeJY-",
      Patch: "1GRzJ9pdIRk0wUl35xF0eHlyjpkVO_WLy",
    },
    dell: {
      Firmware: "16mkn7lmU2FrKWm9Rs6M5LtcEBUUaX1EN",
      Application: "1rhnW4T85TcXbtUyckohJEnyPce4sI7qS",
      OS: "1dTcNRJxNrMo07jUncFvvGTsKskXebwrn",
      Patch: "1WaJB9VtkJ_OmnA8M3is2kR-0HcIht99X",
    },
    cisco: {
      Firmware: "11hnVzZrju_ub42Rjh4KEB5k48i1RfcYX",
      Application: "16Ij_TybeQq_JV2fcFT78gQsxGqyjye4_",
      OS: "1nWtensCrnXvJC0J_fIn6tHZlZCIa21xq",
      Patch: "1m6lcxmHpDTq1B56-2klsqiOVTzS6J2Vu",
    },
    netapp: {
      Firmware: "13wFWLYmeZeZYzflnL7Fd3mbIpCVCz4ug",
      Application: "1T-XTjMty30gvubezJFzESv7fxjTt0XZE",
      OS: "1ZS3FeaXfZC17RxDJfr0Kr-OAwPnsI5ox",
      Patch: "1zDD1s6PksVNFE30tSe6fQcqg2HbMhQB8",
    },
    oracle: {
      Firmware: "10L0CrXPUw6X4y7_oegFIGhDaPB5Tri3h",
      Application: "1gjSQ7CHmUE546vJD3Ue4VijmFkecLvTa",
      OS: "1ZbfLROf8pVF_po1Ao9XhvwjMi_xeOBJT",
      Patch: "1VkIC0Y84qzNLyeGqvZcBK2lyxLQP0UZZ",
    },
    microsoft: {
      Firmware: "1lDpc700RBP6Gy8e6Day86feWVblrM2cA",
      Application: "18CollD6sSBdu0l1eq5gtyZ5wTLQqqKTX",
      OS: "1pAV44uwZilbDf__0D0CLfo5qmWfGgXgQ",
      Patch: "1iCUW4a2zsplnYYVc5jS7jfcMWLm4KJu4",
    },
    redhat: {
      Firmware: "1nlfTg9OoTdgLsrHbLM-MBa_rRKYvjOUi",
      Application: "1sDZZQ6vFQKyRuENTsxPVYuNUaf5HpE9s",
      OS: "1xaJL9x_y6SqSplR_lGBuKtLH0nQwhLSC",
      Patch: "1S5ZHmkbnoYsqwik1oS1HIgkn8hIpqPfB",
    },
    vmware: {
      Firmware: "1VfoeHd8TILEddaqA7SIn4yDvb7yzJBJQ",
      Application: "1Tn_fTVEYuj9zA41QXIRedHnlcFHfMSpv",
      OS: "1xCMfJCZ3IEqhHW4Yw1xZqw2jP0mQL9T5",
      Patch: "1w1ur-Wj4DpI-OB9LLHrOoIEWWb2ibZwM",
    },
    others: {
      Firmware: "1VTH0pqGn8u7c_F9vSZ3-X1b3VVVJbrPT",
      Application: "1gWoDZTONJmsQg0l3zW_lcqqLjbTgTqVX",
      OS: "1LKVZl94roRrK-FX1DlWZTyKN2-s1BXSs",
      Patch: "14N21mA-XXeHJ76RTPDJWhAe-DypzUNDv",
    },
  },
  // Folder gốc của từng hãng (chứa 5 thư mục con) — dùng khi cần tự tạo thêm
  // category subfolder mới cho 1 hãng đã biết (trường hợp hiếm, ví dụ thêm loại mới).
  VENDOR_ROOT_FOLDER_IDS: {
    hitachi: "1S6RWT4fvnNhDJ989p-w_lbin1QL8xQvv",
    hpe: "19iKHrEwD2kL-7G14ZOH9sO9M3km8CSqK",
    dell: "1fSGRcqJ2T-4tRSp3SLudgmmfg_fyZb9K",
    cisco: "1R8R8PFyuHeOlwdX7ufkqqR3APuKqg1Mv",
    netapp: "1LIoooHv6z9cI7bXGL7UUafU6gfBklZfI",
    oracle: "1DiGpws9HZpF9RzGJkEy3oKBiz1Xfd_xI",
    microsoft: "14zS6wK3sWKd4nb9dBJozp2WtPlH58SwG",
    redhat: "1RrI2U_L55gNh6AoWePoGkqME015yeK9P",
    vmware: "16xUoJp71SCPFymuh-rHZG0e6XvbtjbAE",
    others: "1nvpTo9oh91RQ7FaNnBkf1LsQLAE2E_ic",
  },
  // Master-Index Google Sheet: xem SETUP-GOOGLE-DRIVE.md mục "Ghi log Master-Index"
  MASTER_INDEX_SHEET_ID: "1gg_9rUin7h9APg5_i0sVLF6YFa7ztbEYWvDzWeHqwr4",
  MASTER_INDEX_SHEET_NAME: "Master-Index",
  // Tab "danh mục gốc" (master data) nằm trong CÙNG file Sheet Master-Index ở trên,
  // lưu danh sách Hãng Công Nghệ + Sản phẩm/Model đã từng được thêm, để dùng chung
  // cho mọi kỹ sư (không bị mất khi tải lại trang / đổi máy).
  MASTER_DATA_SHEET_NAME: "Master-Data",
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
  { id: "vmware", name: "VMware", icon: "⚙️" },
  { id: "others", name: "Others (Khác)", icon: "🗂️" },
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
  productCatalog: {},  // { vendorId: Set(["Product/Model đã có"]) } — đọc từ tab Master-Data
  masterDataTabReady: false, // đã kiểm tra/tạo tab "Master-Data" trong phiên này chưa
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
    DRIVE_CONFIG.FW_REPO_ROOT_ID &&
    !DRIVE_CONFIG.FW_REPO_ROOT_ID.startsWith("YOUR_")
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

      // Đồng bộ danh mục Hãng Công Nghệ + Sản phẩm/Model dùng chung từ tab Master-Data
      try {
        await loadMasterData();
        renderVendors();
        refreshVendorSelect();
      } catch (err) {
        console.error("Đồng bộ Master-Data thất bại:", err);
      }
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
  state.masterDataTabReady = false;
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
      "Vui lòng điền CLIENT_ID và FW_REPO_ROOT_ID trong assets/script.js.\n" +
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

// Tạo đầy đủ cấu trúc thư mục cho 1 HÃNG MỚI, giống hệt các hãng đã có:
// {Hãng}/01_Firmware, 02_Application, 03_OS, 04_Patch_OS, 99_Archive.
// Trả về { root, Firmware, Application, OS, Patch, Archive } (đều là Folder ID thật).
async function createVendorFolderStructure(vendorLabel, onProgress) {
  onProgress?.(`Đang tạo thư mục hãng "${vendorLabel}"...`);
  const root = await findOrCreateFolder(vendorLabel, DRIVE_CONFIG.FW_REPO_ROOT_ID);

  const subfolders = [
    ["Firmware", "01_Firmware"],
    ["Application", "02_Application"],
    ["OS", "03_OS"],
    ["Patch", "04_Patch_OS"],
    ["Archive", "99_Archive"],
  ];
  const folderIds = { root };
  for (const [key, folderName] of subfolders) {
    onProgress?.(`Đang tạo thư mục ${folderName}...`);
    folderIds[key] = await findOrCreateFolder(folderName, root);
  }
  return folderIds;
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
// MASTER-DATA (danh mục Hãng Công Nghệ + Sản phẩm/Model) — dùng chung 1 file
// Sheet với Master-Index, tab riêng tên "Master-Data".
// ========================================================================

// Đảm bảo tab "Master-Data" đã tồn tại trong Sheet Master-Index; nếu chưa có
// thì tự tạo + ghi hàng tiêu đề. Chỉ cần chạy 1 lần cho mỗi phiên đăng nhập.
async function ensureMasterDataTab() {
  if (state.masterDataTabReady || !isMasterIndexConfigured()) return;
  const sheetId = getEffectiveSheetId();

  const metaResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: driveHeaders() }
  );
  if (!metaResp.ok) throw new Error(`Không đọc được cấu trúc Sheet (HTTP ${metaResp.status})`);
  const meta = await metaResp.json();
  const exists = meta.sheets.some((s) => s.properties.title === DRIVE_CONFIG.MASTER_DATA_SHEET_NAME);

  if (!exists) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: "POST",
      headers: driveHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: DRIVE_CONFIG.MASTER_DATA_SHEET_NAME } } }],
      }),
    });

    const headerRange = `${DRIVE_CONFIG.MASTER_DATA_SHEET_NAME}!A1:M1`;
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(headerRange)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: driveHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          values: [[
            "Loại (Vendor/Product)", "Vendor ID", "Hãng Công Nghệ", "Icon",
            "Sản phẩm/Model", "Thêm bởi", "Ngày thêm",
            "Root Folder ID", "Firmware Folder ID", "Application Folder ID",
            "OS Folder ID", "Patch Folder ID", "Archive Folder ID",
          ]],
        }),
      }
    );
  }
  state.masterDataTabReady = true;
}

// Đọc toàn bộ tab "Master-Data", gộp Hãng vào state.vendors (bỏ trùng theo id)
// và dựng catalog Sản phẩm/Model theo từng hãng để tránh ghi trùng sau này.
async function loadMasterData() {
  if (!isMasterIndexConfigured()) return;
  try {
    await ensureMasterDataTab();
    const range = `${DRIVE_CONFIG.MASTER_DATA_SHEET_NAME}!A2:M5000`;
    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${getEffectiveSheetId()}/values/${encodeURIComponent(range)}`,
      { headers: driveHeaders() }
    );
    if (!resp.ok) throw new Error(`Đọc Master-Data thất bại (HTTP ${resp.status})`);
    const data = await resp.json();
    const rows = data.values || [];

    for (const row of rows) {
      const [kind, vendorId, vendorLabel, icon, product, , , rootId, fwId, appId, osId, patchId] = row;
      if (!vendorId) continue;

      if (kind === "Vendor" && !state.vendors.some((v) => v.id === vendorId)) {
        state.vendors.push({ id: vendorId, name: vendorLabel || vendorId, icon: icon || "🏷️" });
      }
      if (kind === "Product" && product) {
        if (!state.productCatalog[vendorId]) state.productCatalog[vendorId] = new Set();
        state.productCatalog[vendorId].add(product);
      }

      // Đồng bộ Folder ID của các hãng do NGƯỜI KHÁC thêm mới (từ máy khác) về
      // cấu hình runtime của phiên hiện tại, để không phải tìm-kiếm-theo-tên
      // (tránh tạo trùng thư mục) mỗi khi upload cho hãng đó.
      if (kind === "Vendor" && rootId) {
        if (!DRIVE_CONFIG.VENDOR_ROOT_FOLDER_IDS[vendorId]) {
          DRIVE_CONFIG.VENDOR_ROOT_FOLDER_IDS[vendorId] = rootId;
        }
        if (!DRIVE_CONFIG.VENDOR_CATEGORY_FOLDER_IDS[vendorId] && (fwId || appId || osId || patchId)) {
          DRIVE_CONFIG.VENDOR_CATEGORY_FOLDER_IDS[vendorId] = {
            Firmware: fwId || "",
            Application: appId || "",
            OS: osId || "",
            Patch: patchId || "",
          };
        }
      }
    }
  } catch (err) {
    console.error("Không tải được Master-Data:", err);
  }
}

// Ghi 1 dòng mới (Hãng mới hoặc Sản phẩm/Model mới) vào tab "Master-Data".
// folderIds (chỉ áp dụng khi kind === "Vendor"): { root, Firmware, Application, OS, Patch, Archive }
async function appendMasterDataRow({ kind, vendorId, vendorLabel, icon = "", product = "", folderIds = null }) {
  if (!isMasterIndexConfigured() || !state.accessToken) return;
  await ensureMasterDataTab();

  const row = [
    kind, vendorId, vendorLabel, icon, product,
    state.currentUser ? state.currentUser.email : "",
    new Date().toISOString().slice(0, 10),
    folderIds?.root || "",
    folderIds?.Firmware || "",
    folderIds?.Application || "",
    folderIds?.OS || "",
    folderIds?.Patch || "",
    folderIds?.Archive || "",
  ];
  const range = `${DRIVE_CONFIG.MASTER_DATA_SHEET_NAME}!A:M`;
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${getEffectiveSheetId()}` +
    `/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const resp = await fetch(url, {
    method: "POST",
    headers: driveHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ values: [row] }),
  });
  if (!resp.ok) throw new Error(`Ghi Master-Data thất bại (HTTP ${resp.status})`);
}

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
  if (isDriveConfigured() && !state.accessToken) {
    alert(
      "Bạn cần đăng nhập bằng tài khoản Google có quyền truy cập Shared Drive trước khi tải lên.\n" +
      "Bấm '🔐 Đăng nhập bằng Google' ở góc trên, sau đó thử lại."
    );
    return;
  }
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

  // --- Bắt buộc đăng nhập Google (tài khoản có quyền truy cập Shared Drive)
  // khi hệ thống đã cấu hình Drive thật — không cho phép upload "chui" ẩn danh. ---
  if (isDriveConfigured() && !state.accessToken) {
    alert(
      "Bạn cần đăng nhập bằng tài khoản Google có quyền truy cập Shared Drive trước khi tải lên.\n" +
      "Bấm '🔐 Đăng nhập bằng Google' ở góc trên, sau đó thử lại."
    );
    return;
  }

  // --- Trường hợp CHƯA cấu hình Drive (môi trường demo/dev): chỉ minh hoạ trong bảng. ---
  if (!isDriveConfigured()) {
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

    // Ưu tiên dùng Folder ID cố định đã cấu hình sẵn cho hãng + loại này
    // (tránh gọi API tìm-kiếm-theo-tên có thể bị trễ index và tạo trùng thư mục).
    let targetFolderId = DRIVE_CONFIG.VENDOR_CATEGORY_FOLDER_IDS[vendorId]?.[category];

    if (!targetFolderId) {
      // Hãng mới hoặc loại mới chưa có ID cấu hình sẵn -> tự tìm/tạo theo tên,
      // dựa trên thư mục gốc của hãng (nếu đã biết) hoặc thư mục gốc FW-REPO.
      const vendorRootId =
        DRIVE_CONFIG.VENDOR_ROOT_FOLDER_IDS[vendorId] ||
        (await findOrCreateFolder(vendorLabel, DRIVE_CONFIG.FW_REPO_ROOT_ID));
      const categorySubfolderName = DRIVE_CONFIG.CATEGORY_SUBFOLDER_NAMES[category] || category;
      targetFolderId = await findOrCreateFolder(categorySubfolderName, vendorRootId);
    }

    progressLabel.textContent = "Đang tính checksum...";
    baseRecord.checksum = await computeChecksum(fileObj);

    progressLabel.textContent = "0%";
    const result = await resumableUpload(fileObj, targetFolderId, (pct) => {
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

    // Nếu Sản phẩm/Model này chưa từng có trong danh mục Master-Data thì ghi thêm 1 dòng
    // để lần sau các kỹ sư khác biết hãng này đã có model gì.
    const knownProducts = state.productCatalog[vendorId];
    if (!knownProducts || !knownProducts.has(product)) {
      try {
        await appendMasterDataRow({ kind: "Product", vendorId, vendorLabel, product });
        if (!state.productCatalog[vendorId]) state.productCatalog[vendorId] = new Set();
        state.productCatalog[vendorId].add(product);
      } catch (err) {
        console.error("Ghi Sản phẩm/Model vào Master-Data thất bại:", err);
      }
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
const vendorStatusLabel = document.getElementById("vendorStatusLabel");
const submitVendorBtn = document.getElementById("submitVendorBtn");

document.getElementById("addVendorBtn").addEventListener("click", () => {
  if (isDriveConfigured() && !state.accessToken) {
    alert(
      "Bạn cần đăng nhập bằng tài khoản Google có quyền truy cập Shared Drive trước khi thêm hãng mới\n" +
      "(hệ thống sẽ tự tạo cấu trúc thư mục thật trên Drive cho hãng đó).\n" +
      "Bấm '🔐 Đăng nhập bằng Google' ở góc trên, sau đó thử lại."
    );
    return;
  }
  vendorStatusLabel.textContent = "";
  vendorOverlay.classList.add("open");
});
document.getElementById("closeVendorModal").addEventListener("click", () => vendorOverlay.classList.remove("open"));
document.getElementById("cancelVendorBtn").addEventListener("click", () => vendorOverlay.classList.remove("open"));

document.getElementById("vendorForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("vName").value.trim();
  const icon = document.getElementById("vIcon").value.trim() || "🏷️";
  if (!name) return;

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (state.vendors.some((v) => v.id === id)) {
    alert(`Hãng "${name}" đã có trong danh mục.`);
    return;
  }

  // --- Chưa cấu hình Drive thật (môi trường demo/dev): chỉ thêm trên giao diện. ---
  if (!isDriveConfigured()) {
    state.vendors.push({ id, name, icon });
    vendorOverlay.classList.remove("open");
    e.target.reset();
    renderVendors();
    refreshVendorSelect();
    return;
  }

  // --- Bắt buộc đăng nhập bằng tài khoản có quyền truy cập Shared Drive để tạo thư mục thật. ---
  if (!state.accessToken) {
    alert("Vui lòng đăng nhập bằng tài khoản Google có quyền truy cập Shared Drive trước khi thêm hãng mới.");
    return;
  }

  try {
    submitVendorBtn.disabled = true;
    // Tự động tạo đầy đủ cấu trúc thư mục trên Drive: {Hãng}/01_Firmware, 02_Application,
    // 03_OS, 04_Patch_OS, 99_Archive — giống hệt các hãng đã có, KHÔNG tạo thư mục trùng
    // vì findOrCreateFolder luôn tìm-theo-tên trước khi tạo mới trong đúng thư mục cha.
    const folderIds = await createVendorFolderStructure(name, (msg) => {
      vendorStatusLabel.textContent = msg;
    });

    // Ghi thẳng vào cấu hình runtime để các lần upload tiếp theo trong phiên này
    // dùng ngay Folder ID vừa tạo, không phải tìm-kiếm-theo-tên lại (tránh trùng thư mục).
    DRIVE_CONFIG.VENDOR_ROOT_FOLDER_IDS[id] = folderIds.root;
    DRIVE_CONFIG.VENDOR_CATEGORY_FOLDER_IDS[id] = {
      Firmware: folderIds.Firmware,
      Application: folderIds.Application,
      OS: folderIds.OS,
      Patch: folderIds.Patch,
    };

    state.vendors.push({ id, name, icon });

    // Lưu vào Master-Data (kèm Folder ID) để mọi kỹ sư khác/máy khác cũng thấy hãng mới
    // này và dùng đúng Folder ID có sẵn, không tự tạo trùng thư mục nữa.
    vendorStatusLabel.textContent = "Đang lưu vào Master-Data...";
    try {
      await appendMasterDataRow({ kind: "Vendor", vendorId: id, vendorLabel: name, icon, folderIds });
    } catch (err) {
      console.error(err);
      alert(
        "Đã tạo xong thư mục trên Drive và thêm hãng trên giao diện, nhưng lưu vào Master-Data thất bại:\n" +
        err.message
      );
    }

    vendorOverlay.classList.remove("open");
    e.target.reset();
    renderVendors();
    refreshVendorSelect();
  } catch (err) {
    console.error(err);
    alert("Tạo cấu trúc thư mục trên Google Drive thất bại: " + err.message);
  } finally {
    submitVendorBtn.disabled = false;
    vendorStatusLabel.textContent = "";
  }
});

// ---- Init ----
renderVendors();
renderFiles();
updateConnectionUI(false);
window.addEventListener("load", initGoogleAuth);
