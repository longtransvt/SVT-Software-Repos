# Hướng dẫn cấu hình tích hợp Google Drive (upload thật)

Portal này dùng **Google Identity Services (GIS)** để đăng nhập OAuth ngay
trên trình duyệt (không cần backend), sau đó gọi thẳng **Google Drive API v3**
để tạo thư mục hãng (nếu chưa có) và upload file bằng **resumable upload**
(hỗ trợ file lớn, có thanh tiến trình %).

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
4. Ở mục **Scopes**, thêm 2 scope:
   - `https://www.googleapis.com/auth/drive.file` — chỉ cho phép ứng dụng truy cập những file/thư mục do chính nó tạo hoặc được cấp quyền (an toàn hơn `drive` toàn quyền).
   - `https://www.googleapis.com/auth/spreadsheets` — cần thiết để ghi log vào Google Sheet **Master-Index** có sẵn (không do app tạo ra nên `drive.file` không đủ quyền).

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
  SCOPES: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets",
  DRIVE_ID: "",                 // Điền nếu dùng Shared Drive, để trống nếu dùng My Drive folder thường
  CATEGORY_FOLDER_IDS: {
    Firmware: "FOLDER_ID_01_Firmware",
    Application: "FOLDER_ID_02_Application",
    OS: "FOLDER_ID_03_OS",
    Patch: "FOLDER_ID_04_Patch_OS",
  },
  MASTER_INDEX_SHEET_ID: "SHEET_ID_CUA_MASTER_INDEX",
  MASTER_INDEX_SHEET_NAME: "Master-Index",
  CHECKSUM_MAX_BYTES: 200 * 1024 * 1024,
};
```

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


## Bước 6 — Host & chạy thử
- Host portal qua HTTP(S) đúng domain đã khai báo ở Bước 3 (OAuth không hoạt động khi mở trực tiếp file `file://`).
- Mở portal → bấm **"Kết nối Google Drive"** → đăng nhập bằng tài khoản Google Workspace công ty → **Allow**.
- Sau khi kết nối, mở **"Tải lên phiên bản mới"**: chọn hãng, loại, điền metadata, chọn file → bấm **Tải lên**.
  - Ứng dụng sẽ tự tìm hoặc tạo thư mục con theo tên hãng bên trong thư mục loại tương ứng, rồi upload file vào đó bằng resumable upload (có thanh tiến trình %).
  - Sau khi upload xong, dòng file mới trong bảng sẽ có link **"Mở trên Drive"** trỏ thẳng tới file thật.

## Ghi chú bảo mật
- Scope `drive.file` giới hạn quyền truy cập chỉ trong phạm vi file do app tạo/được chia sẻ — không đọc được toàn bộ Drive của người dùng.
- Access token chỉ lưu tạm trong bộ nhớ trình duyệt (biến JS), không lưu localStorage, hết phiên phải đăng nhập lại.
- Không public Client ID kèm quyền ghi vào domain lạ — chỉ khai báo đúng origin nội bộ ở Bước 3.
- Với dữ liệu nhạy cảm/tuân thủ cao hơn, cân nhắc thêm lớp backend (Google Apps Script hoặc Cloud Function) để kiểm soát ghi log, virus-scan trước khi đẩy lên Drive.
