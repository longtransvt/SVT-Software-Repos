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
  CLIENT_ID: "YOUR_CLIENT_ID.apps.googleusercontent.com", // Bước 3
  // spreadsheets scope cần thiết để ghi log vào Master-Index (Sheet có sẵn,
  // không do app tạo ra nên drive.file không đủ quyền ghi).
  SCOPES: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets",
  DRIVE_ID: "", // Điền Shared Drive ID nếu dùng Shared Drive, để trống nếu dùng thư mục My Drive thường
  CATEGORY_FOLDER_IDS: {
    Firmware: "FOLDER_ID_01_Firmware",
    Application: "FOLDER_ID_02_Application",
    OS: "FOLDER_ID_03_OS",
    Patch: "FOLDER_ID_04_Patch_OS",
  },
  // Master-Index Google Sheet: xem SETUP-GOOGLE-DRIVE.md mục "Ghi log Master-Index"
  MASTER_INDEX_SHEET_ID: "YOUR_MASTER_INDEX_SHEET_ID",
  MASTER_INDEX_SHEET_NAME: "Master-Index",
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
  return (
    DRIVE_CONFIG.MASTER_INDEX_SHEET_ID &&
    !DRIVE_CONFIG.MASTER_INDEX_SHEET_ID.startsWith("YOUR_")
  );
}

function initGoogleAuth() {
  if (typeof google === "undefined" || !google.accounts) {
    console.warn("Google Identity Services chưa tải xong, thử lại sau...");
    return;
  }
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: DRIVE_CONFIG.CLIENT_ID,
    scope: DRIVE_CONFIG.SCOPES,
    callback: (resp) => {
      if (resp.error) {
        alert("Đăng nhập Google Drive thất bại: " + resp.error);
        return;
      }
      state.accessToken = resp.access_token;
      updateConnectionUI(true);
    },
  });
}

function updateConnectionUI(connected) {
  if (connected) {
    connectDriveBtn.textContent = "✅ Đã kết nối Google Drive";
    connectDriveBtn.classList.add("btn-connected");
    uploadHintEl.textContent = "✅ Đã kết nối Google Drive. File sẽ được upload thẳng vào thư mục hãng/loại tương ứng.";
    uploadHintEl.classList.add("connected");
  } else {
    connectDriveBtn.textContent = "🔗 Kết nối Google Drive";
    connectDriveBtn.classList.remove("btn-connected");
    uploadHintEl.textContent = '⚠️ Chưa kết nối Google Drive. Bấm "🔗 Kết nối Google Drive" ở góc trên trước khi tải lên.';
    uploadHintEl.classList.remove("connected");
  }
}

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
    `https://sheets.googleapis.com/v4/spreadsheets/${DRIVE_CONFIG.MASTER_INDEX_SHEET_ID}` +
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
    user: "kỹ sư demo",
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
