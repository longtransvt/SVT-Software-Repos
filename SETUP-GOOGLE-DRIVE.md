# Hướng dẫn cấu hình tích hợp Google Drive (upload thật)

Portal này dùng **Google Identity Services (GIS)** để đăng nhập OAuth ngay
trên trình duyệt (không cần backend), sau đó gọi thẳng **Google Drive API v3**
để tạo thư mục hãng (nếu chưa có) và upload file bằng **resumable upload**
(hỗ trợ file lớn, có thanh tiến trình %).

## Bước 0 — Điều kiện cần thiết về tài khoản Google (đọc trước khi bắt đầu)

### 0.1. Loại tài khoản Google
| | Google Workspace (khuyến nghị) | Gmail cá nhân miễn phí |
|---|---|---|
| **Shared Drive** (ổ đĩa dùng chung của phòng ban) | ✅ Có, quản lý phân quyền theo nhóm | ❌ Không có tính năng Shared Drive, chỉ có folder trong "My Drive" của 1 cá nhân |
| **Dung lượng lưu trữ** | Theo gói (30GB–5TB+/user hoặc pooled storage) | 15GB dùng chung Gmail+Photos+Drive — dễ hết dung lượng với file firmware lớn |
| **OAuth consent screen = Internal** | ✅ Có (chỉ nhân viên trong domain công ty mới đăng nhập được, không cần Google duyệt app) | ❌ Không có, bắt buộc dùng **External** |
| **Phù hợp cho hệ thống nội bộ** | ✅ Rất phù hợp | ⚠️ Chỉ nên dùng thử nghiệm/demo cá nhân |

> **Khuyến nghị:** dùng tài khoản **Google Workspace của công ty** (ví dụ `it@congty.com`) để có Shared Drive thật, dung lượng đủ lớn, và kiểm soát quyền truy cập theo nhóm nhân viên.

### 0.2. Quyền cần có để thực hiện các bước dưới đây
- **Người tạo GCP Project & OAuth Client ID**: cần đăng nhập bằng tài khoản Google (Workspace hoặc cá nhân đều được) có thể truy cập https://console.cloud.google.com — không cần license trả phí riêng, Google Cloud Console dùng miễn phí cho việc tạo Project/API/OAuth Client ở quy mô này.
- **Chọn OAuth consent screen = Internal**: chỉ khả dụng nếu tài khoản đó thuộc **Google Workspace** và bạn là người có quyền quản trị OAuth trong domain (thường là Workspace Admin, hoặc được Admin cấp quyền "API Access"). Nếu bạn không thấy tuỳ chọn Internal, nghĩa là tài khoản không thuộc Workspace hoặc chưa được cấp quyền — hãy dùng **External** + thêm email kỹ sư vào **Test users**.
- **Tạo/chỉnh sửa Shared Drive**: cần tài khoản Workspace có quyền **Manager** trên Shared Drive đó (hoặc quyền tạo Shared Drive mới do Admin bật trong **Admin Console → Apps → Google Workspace → Drive and Docs → Sharing settings**).
- **Từng kỹ sư sử dụng portal**: cần có tài khoản Google (Workspace) được người quản trị Shared Drive thêm vào với vai trò tối thiểu **Content Manager** (được tạo/sửa/xoá file) hoặc **Contributor** (chỉ thêm file, không xoá của người khác) — xem mục phân quyền trong `README.md`.
- **Ghi log Master-Index**: mỗi kỹ sư cần quyền **Editor** trên Google Sheet đó.

### 0.3. Về việc "xác minh ứng dụng" (App verification) của Google
- Nếu chọn **Internal** (Workspace): **không cần** Google xác minh app, dùng ngay trong nội bộ domain.
- Nếu bắt buộc dùng **External** (vì không có Workspace):
  - Ở chế độ **Testing**, app hoạt động ngay nhưng giới hạn tối đa **100 tài khoản test user** (đủ dùng cho phòng IT nội bộ) và người dùng sẽ thấy cảnh báo "Google chưa xác minh ứng dụng này" — vẫn bấm **Advanced → Go to (tên app) (unsafe)** để tiếp tục được, không ảnh hưởng chức năng.
  - Nếu muốn bỏ cảnh báo và không giới hạn 100 user, phải nộp app cho Google xác minh (mất thời gian, cần chính sách bảo mật, video demo...) — thường không cần thiết cho công cụ nội bộ nhỏ.

### 0.4. Yêu cầu hạ tầng khi triển khai
- Portal phải được **host qua HTTP/HTTPS** (không mở trực tiếp bằng đường dẫn `file://`), vì Google OAuth yêu cầu Authorized JavaScript origin là 1 domain/host thật (localhost cũng được khi test).
- Nếu host nội bộ bằng domain riêng, khuyến nghị dùng **HTTPS** (chứng chỉ nội bộ hoặc Let's Encrypt) để trình duyệt không chặn/warning.

---

## Bước 1 — Tạo Google Cloud Project
1. Vào https://console.cloud.google.com/ → chọn/tạo một **Project** mới (vd `it-software-repo`).
2. Vào **APIs & Services → Library** → tìm **Google Drive API** → bấm **Enable**.

## Bước 1b — Bật thêm Google Sheets API (để ghi log Master-Index)
Vào **APIs & Services → Library** → tìm **Google Sheets API** → bấm **Enable**.

## Bước 2 — Cấu hình màn hình xin quyền (OAuth consent screen)
1. **APIs & Services → OAuth consent screen**.
2. Nếu công ty dùng **Google Workspace**, chọn **Internal** (chỉ nhân viên nội bộ mới đăng nhập được) — khuyến nghị cho hệ thống nội bộ này.
   - Nếu không dùng Workspace, chọn **External** và thêm các email kỹ sư vào mục **Test users** (khi ở chế độ Testing).
3. Điền tên ứng dụng (vd "IT Software Repository Portal"), email hỗ trợ.
4. Ở mục **Scopes**, thêm 3 nhóm scope:
   - `https://www.googleapis.com/auth/drive.file` — chỉ cho phép ứng dụng truy cập những file/thư mục do chính nó tạo hoặc được cấp quyền (an toàn hơn `drive` toàn quyền).
   - `https://www.googleapis.com/auth/spreadsheets` — cần thiết để ghi log vào Google Sheet **Master-Index** có sẵn (không do app tạo ra nên `drive.file` không đủ quyền).
   - `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (thường gộp sẵn khi bạn chọn "See your primary Google Account email address" và "See your personal info") — dùng để nhận diện đúng người đăng nhập (họ tên, email, ảnh đại diện) hiển thị trên giao diện và ghi vào cột "Uploaded By".

## Bước 3 — Tạo OAuth Client ID
1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Chọn loại **Web application**.
3. Ở **Authorized JavaScript origins**, thêm (các) domain sẽ host portal này, ví dụ:
   - `http://localhost:8791` (khi bạn đang test cục bộ)
   - `https://it-portal.congty.local` (khi triển khai nội bộ thật)
4. Bấm **Create** → copy **Client ID** dạng `xxxxxxxx.apps.googleusercontent.com`.

## Bước 4 — Chuẩn bị thư mục trên Google Drive
1. Tạo (hoặc dùng) **Shared Drive** nội bộ theo cấu trúc trong `README.md`
   (`01_Firmware`, `02_Application`, `03_OS`, `04_Patch_OS`).
2. Mở từng thư mục loại (Firmware/Application/OS/Patch) trên trình duyệt,
   copy **Folder ID** từ URL:
   `https://drive.google.com/drive/folders/<FOLDER_ID>` ← phần `<FOLDER_ID>` này.
3. Nếu dùng **Shared Drive** (Team Drive) thay vì thư mục trong My Drive,
   lấy thêm **Drive ID** của Shared Drive đó (mở Shared Drive → xem URL
   `.../drive/folders/<DRIVE_ID>` ở cấp gốc, hoặc vào phần cài đặt Shared Drive).

## Bước 5 — Điền cấu hình vào `assets/script.js`
Mở `assets/script.js`, tìm khối `const DRIVE_CONFIG = { ... }` ở đầu file và điền:

```js
const DRIVE_CONFIG = {
  CLIENT_ID: "xxxxxxxx.apps.googleusercontent.com", // Client ID ở Bước 3
  SCOPES: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets openid email profile",
  DRIVE_ID: "",                 // Điền nếu dùng Shared Drive, để trống nếu dùng My Drive folder thường
  FW_REPO_ROOT_ID: "FOLDER_ID_FW_REPO", // Thư mục gốc chứa các hãng, dùng để tự tạo hãng MỚI
  CATEGORY_SUBFOLDER_NAMES: {
    Firmware: "01_Firmware",
    Application: "02_Application",
    OS: "03_OS",
    Patch: "04_Patch_OS",
  },
  // Folder ID cố định cho từng hãng + từng loại (cấu trúc: {Hãng}/{01_Firmware,...})
  VENDOR_CATEGORY_FOLDER_IDS: {
    hitachi: { Firmware: "FOLDER_ID", Application: "FOLDER_ID", OS: "FOLDER_ID", Patch: "FOLDER_ID" },
    // ... tương tự cho các hãng khác (hpe, dell, cisco, netapp, oracle, microsoft, redhat, vmware, others)
  },
  VENDOR_ROOT_FOLDER_IDS: {
    hitachi: "FOLDER_ID_GOC_CUA_HANG",
    // ... tương tự cho các hãng khác
  },
  MASTER_INDEX_SHEET_ID: "SHEET_ID_CUA_MASTER_INDEX",
  MASTER_INDEX_SHEET_NAME: "Master-Index",
  MASTER_DATA_SHEET_NAME: "Master-Data",
  CHECKSUM_MAX_BYTES: 200 * 1024 * 1024,
};
```

> **Vì sao cấu hình cứng (hardcode) Folder ID cho từng hãng/loại thay vì tìm-kiếm-theo-tên?**
> Khi app tự tìm folder theo tên (`findOrCreateFolder`) ngay sau khi vừa tạo folder đó, chỉ mục tìm kiếm của Google Drive có thể bị trễ vài giây → app tưởng chưa có nên tạo thêm 1 folder trùng tên. Dùng thẳng Folder ID đã biết trước giúp loại bỏ hoàn toàn rủi ro này cho các hãng đã có sẵn cấu trúc. `findOrCreateFolder` chỉ còn được dùng khi thêm **hãng mới** (chưa có Folder ID cấu hình sẵn).


## Bước 5b — Tạo & cấu hình Google Sheet "Master-Index"
1. Tạo một Google Sheet mới trong `00_INDEX_METADATA` (hoặc dùng file `Master-Index.gsheet` đã có trong cấu trúc README).
2. Đặt tên tab (sheet) là **Master-Index** (đúng với `MASTER_INDEX_SHEET_NAME`), hàng đầu tiên là tiêu đề cột theo đúng thứ tự:

   | A | B | C | D | E | F | G | H | I | J |
   |---|---|---|---|---|---|---|---|---|---|
   | Vendor | Category | Product/Model | Version | Upload Date | Uploaded By | Checksum (SHA-256) | Change Log URL | Status | Drive Link |

3. Mở Sheet trên trình duyệt, copy **Sheet ID** từ URL:
   `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit` ← phần `<SHEET_ID>`.
4. Điền `SHEET_ID` vào `MASTER_INDEX_SHEET_ID` trong `DRIVE_CONFIG`.
5. Đảm bảo tài khoản kỹ sư đăng nhập Drive đều có quyền **Editor** trên Sheet này (chia sẻ qua Google Group nội bộ như mô tả ở README mục phân quyền).
6. Vì Sheet này không do app tạo ra, cần bổ sung scope `spreadsheets` ở Bước 5 (đã có sẵn trong mẫu cấu hình) — nếu chỉ dùng `drive.file` sẽ không ghi được vào Sheet có sẵn.

> Sau mỗi lần upload thành công, app sẽ tự động gọi Sheets API (`values:append`) để thêm 1 dòng mới vào cuối sheet, kèm checksum SHA-256 tính ngay trên trình duyệt (bỏ qua nếu file > 200MB để tránh treo UI — có thể chỉnh `CHECKSUM_MAX_BYTES`).

## Master-Data — danh mục Hãng Công Nghệ & Sản phẩm/Model dùng chung
- App tự tạo thêm 1 **tab riêng tên "Master-Data"** trong CHÍNH file Sheet Master-Index ở trên (không cần tạo tay) — tự động chạy lần đầu sau khi ai đó đăng nhập thành công.
- Cấu trúc cột:

  | A | B | C | D | E | F | G | H | I | J | K | L | M |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|
  | Loại (Vendor/Product) | Vendor ID | Hãng Công Nghệ | Icon | Sản phẩm/Model | Thêm bởi | Ngày thêm | Root Folder ID | Firmware Folder ID | Application Folder ID | OS Folder ID | Patch Folder ID | Archive Folder ID |

- Khi kỹ sư bấm **"+ Thêm hãng"** và tạo hãng mới:
  1. App **bắt buộc phải đăng nhập trước** (tài khoản có quyền truy cập Shared Drive).
  2. App tự động tạo trên Drive thật đầy đủ 5 thư mục con giống các hãng có sẵn:
     `{Hãng}/01_Firmware`, `02_Application`, `03_OS`, `04_Patch_OS`, `99_Archive` (dùng `findOrCreateFolder`
     nên nếu thư mục đã tồn tại thì dùng lại, không tạo trùng).
  3. Ghi 1 dòng `Vendor` vào tab Master-Data, kèm đầy đủ Folder ID (cột H–M) vừa tạo.
- Khi upload file với **Sản phẩm/Model** chưa từng xuất hiện trước đó (theo đúng hãng) → tự động ghi thêm 1 dòng `Product` để lưu lại model mới.
- Ngay sau khi đăng nhập, app đọc lại toàn bộ tab **Master-Data**:
  - Gộp các hãng đã lưu vào danh sách sidebar/dropdown — nhờ vậy **mọi kỹ sư dùng chung 1 danh mục**, không bị mất khi tải lại trang hay đổi máy khác.
  - Đồng thời nạp luôn Folder ID (cột H–M) của các hãng do **người khác/máy khác** thêm vào cấu hình runtime (`VENDOR_ROOT_FOLDER_IDS`/`VENDOR_CATEGORY_FOLDER_IDS`) — nhờ vậy dù ai thêm hãng mới ở đâu, các kỹ sư khác upload cho hãng đó vẫn dùng đúng Folder ID có sẵn, **không bao giờ tạo trùng thư mục**.
- Nếu chưa cấu hình Drive thật (chế độ demo/dev), hãng mới thêm chỉ tồn tại tạm trong phiên trình duyệt hiện tại và sẽ mất khi tải lại trang.

## Bắt buộc đăng nhập trước khi Tải lên / Thêm hãng
Khi hệ thống đã cấu hình Drive thật (`CLIENT_ID` + `FW_REPO_ROOT_ID`), app **yêu cầu đăng nhập Google trước** khi cho phép:
- Mở modal "Upload Software" và thực hiện submit.
- Mở modal "+ Thêm hãng" và tạo hãng mới (vì cần quyền ghi để tạo thư mục thật + ghi Master-Data).

Việc đăng nhập dùng Google Identity Services (OAuth2), giới hạn theo domain công ty (`ALLOWED_DOMAIN`).
Quyền **thực sự** upload/download vào Shared Drive vẫn do chính Google Drive kiểm soát: nếu tài khoản
đăng nhập không nằm trong danh sách thành viên Shared Drive (`[BẢO MẬT]_SYSTEM HCM`), các lệnh gọi API
sẽ trả lỗi 403 và app sẽ hiển thị thông báo lỗi tương ứng — vì vậy chỉ cần cấp quyền truy cập Shared Drive
đúng cho từng kỹ sư (qua Google Group nội bộ) là đủ để kiểm soát ai được upload/download.


## Bước 6 — Host & chạy thử
- Host portal qua HTTP(S) đúng domain đã khai báo ở Bước 3 (OAuth không hoạt động khi mở trực tiếp file `file://`).
- Mở portal → bấm **"🔐 Đăng nhập bằng Google"** → đăng nhập bằng tài khoản Google Workspace công ty → **Allow**.
- Sau khi đăng nhập, mở **"Upload Software"**: chọn hãng, loại, điền metadata, chọn file → bấm **Tải lên**.
  - Ứng dụng sẽ tự tìm hoặc tạo thư mục con theo tên hãng bên trong thư mục loại tương ứng, rồi upload file vào đó bằng resumable upload (có thanh tiến trình %).
  - Sau khi upload xong, dòng file mới trong bảng sẽ có link **"Mở trên Drive"** trỏ thẳng tới file thật.

## Đăng nhập theo Google email
- Nút **"🔐 Đăng nhập bằng Google"** ở góc trên vừa xin quyền truy cập Drive/Sheets, vừa lấy thông tin tài khoản (họ tên, email, ảnh đại diện) qua Google UserInfo endpoint.
- Sau khi đăng nhập, góc trên bên phải hiển thị đúng ảnh đại diện + tên thật của kỹ sư (thay cho "Kỹ sư demo" cũ), kèm nút **"Đăng xuất"**.
- Cột **"Người upload"** trong bảng và cột **"Uploaded By"** ghi vào Master-Index Sheet sẽ tự lấy đúng email Google của người đang đăng nhập — không cần nhập tay.
- Có kiểm tra domain: `DRIVE_CONFIG.ALLOWED_DOMAIN` (mặc định `svtech.com.vn`). Nếu ai đó đăng nhập bằng tài khoản Gmail cá nhân hoặc domain khác, hệ thống tự đăng xuất và báo lỗi. Đặt thành `""` nếu muốn cho phép mọi tài khoản Google.
- Bấm **"Đăng xuất"** để thu hồi quyền truy cập (revoke token) và quay lại trạng thái "Chưa đăng nhập".

## Kiểm tra kết nối (checklist nhanh)
1. Mở Console trình duyệt (F12) trước khi bấm "🔐 Đăng nhập bằng Google" để theo dõi lỗi nếu có.
2. Bấm **Đăng nhập bằng Google** → nếu hiện popup chọn tài khoản Google → chọn đúng tài khoản Workspace công ty → màn hình xin quyền hiển thị Drive, Sheets và thông tin tài khoản → **Allow**.
3. Nút chuyển thành **"✅ Đã đăng nhập"** (nền xanh), góc trên bên phải hiện đúng tên/ảnh đại diện thật là đã đăng nhập thành công.
4. Thử upload 1 file nhỏ (vd ảnh test), theo dõi thanh tiến trình chạy tới 100%, sau đó dòng mới xuất hiện với nút **"🔗 Mở trên Drive"** và cột "Người upload" đúng email vừa đăng nhập.
5. Vào Google Sheet Master-Index kiểm tra đã có thêm 1 dòng mới, cột "Uploaded By" đúng email thật.

## Sự cố thường gặp
| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| `redirect_uri_mismatch` hoặc popup OAuth báo lỗi origin | Domain đang host portal chưa được thêm vào Authorized JavaScript origins | Quay lại Bước 3, thêm đúng domain (kể cả cổng, vd `:8791`) |
| "This app isn't verified" | Đang dùng OAuth External + chưa xác minh app | Bấm Advanced → Go to (unsafe) để tiếp tục (không ảnh hưởng chức năng), hoặc chuyển sang Internal nếu có Workspace |
| HTTP 403 khi upload / tạo folder | Tài khoản đăng nhập chưa được cấp quyền Content Manager/Editor trên Shared Drive | Nhờ quản trị Shared Drive thêm tài khoản vào đúng vai trò |
| HTTP 404 khi ghi Master-Index | `MASTER_INDEX_SHEET_ID` sai hoặc tài khoản chưa có quyền Editor trên Sheet | Kiểm tra lại Sheet ID và quyền chia sẻ |
| Nút "Đăng nhập bằng Google" báo "Chưa cấu hình Google Drive" | Chưa điền đủ `CLIENT_ID`/`FW_REPO_ROOT_ID` trong `assets/script.js` | Hoàn tất Bước 5 |
| Đăng nhập xong bị tự đăng xuất kèm cảnh báo sai domain | Đăng nhập bằng tài khoản Gmail cá nhân hoặc domain khác `svtech.com.vn` | Đăng nhập lại đúng bằng email công ty, hoặc chỉnh `ALLOWED_DOMAIN` nếu muốn nới lỏng |

## Ghi chú bảo mật
- Scope `drive.file` giới hạn quyền truy cập chỉ trong phạm vi file do app tạo/được chia sẻ — không đọc được toàn bộ Drive của người dùng.
- Access token chỉ lưu tạm trong bộ nhớ trình duyệt (biến JS), không lưu localStorage, hết phiên phải đăng nhập lại.
- Không public Client ID kèm quyền ghi vào domain lạ — chỉ khai báo đúng origin nội bộ ở Bước 3.
- `ALLOWED_DOMAIN` chỉ là lớp kiểm tra bổ sung phía client; lớp bảo vệ chính vẫn là OAuth consent screen **Internal** (chỉ nhân viên trong domain Workspace mới đăng nhập được ngay từ đầu).
- Với dữ liệu nhạy cảm/tuân thủ cao hơn, cân nhắc thêm lớp backend (Google Apps Script hoặc Cloud Function) để kiểm soát ghi log, virus-scan trước khi đẩy lên Drive.
