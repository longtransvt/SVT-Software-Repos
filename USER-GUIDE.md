# 📘 Hướng dẫn sử dụng — SVTECH Software Repository Portal

> Tài liệu này dành cho **kỹ sư sử dụng hằng ngày** (tra cứu, tải lên/tải xuống firmware, OS, application,
> patch OS). Nếu bạn cần cấu hình Google Drive/OAuth cho hệ thống, xem `SETUP-GOOGLE-DRIVE.md`.
> Nếu cần hiểu cấu trúc thư mục lưu trữ trên Drive, xem `README.md`.

🌐 Truy cập:
- **Nội bộ (khuyến nghị):** https://refactored-bassoon-5wo89nj.pages.github.io/ — chỉ thành viên tổ chức
  GitHub `svtech-system` đã đăng nhập mới xem được.
- Public (đang chạy song song tạm thời): https://longtransvt.github.io/SVT-Software-Repos/

---

## Mục lục
1. [Tổng quan kiến trúc hệ thống](#1-tổng-quan-kiến-trúc-hệ-thống)
2. [Đăng nhập / Đăng xuất](#2-đăng-nhập--đăng-xuất)
3. [Giao diện chính](#3-giao-diện-chính)
4. [Duyệt & tìm kiếm file](#4-duyệt--tìm-kiếm-file)
5. [Bộ lọc nâng cao](#5-bộ-lọc-nâng-cao)
6. [Tải xuống file](#6-tải-xuống-file)
7. [Lượt tải & Tag phản hồi nhanh](#7-lượt-tải--tag-phản-hồi-nhanh)
8. [Tải lên file (Upload Software)](#8-tải-lên-file-upload-software)
9. [Quản lý phiên bản & xác thực file](#9-quản-lý-phiên-bản--xác-thực-file)
10. [Thêm Hãng công nghệ mới](#10-thêm-hãng-công-nghệ-mới)
11. [Thêm Sản phẩm/Model mới](#11-thêm-sản-phẩmmodel-mới)
12. [Chế độ sáng/tối](#12-chế-độ-sángtối)
13. [Câu hỏi thường gặp / Xử lý sự cố](#13-câu-hỏi-thường-gặp--xử-lý-sự-cố)

---

## 1. Tổng quan kiến trúc hệ thống

Portal là một **trang web tĩnh** (HTML/CSS/JavaScript thuần, không cần server/backend riêng), đóng vai trò
lớp giao diện thân thiện phía trên **Google Drive** (lưu file thật) và **Google Sheets** (lưu danh mục/nhật ký).

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│   Trình duyệt (Portal Web)  │        │        Google Cloud           │
│  index.html + script.js     │──OAuth─▶  Google Identity Services     │
│  (host qua GitHub Pages)    │        │  (đăng nhập bằng tài khoản    │
│                              │        │   Google công ty)             │
│  - Sidebar Hãng công nghệ   │        └──────────────────────────────┘
│  - Bảng danh sách file       │
│  - Modal Upload / Thêm hãng  │        ┌──────────────────────────────┐
└─────────────┬────────────────┘──API──▶  Google Drive API v3          │
              │                        │  - Shared Drive "FW-REPO"     │
              │                        │  - Cấu trúc: Hãng/Loại/Model  │
              │                        └──────────────────────────────┘
              │
              │                        ┌──────────────────────────────┐
              └────────────API────────▶│  Google Sheets API            │
                                        │  - Master-Index (nhật ký file)│
                                        │  - Master-Data (danh mục Hãng │
                                        │    + Sản phẩm/Model dùng chung)│
                                        └──────────────────────────────┘
```

**Thành phần chính:**

| Thành phần | Vai trò |
|---|---|
| `index.html` | Cấu trúc giao diện: header, sidebar hãng, bảng file, các modal (Upload, Thêm hãng) |
| `assets/styles.css` | Giao diện (sáng/tối, responsive) |
| `assets/script.js` | Toàn bộ logic: đăng nhập Google, gọi Drive API, gọi Sheets API, lọc/tìm kiếm, render bảng |
| **Shared Drive `FW-REPO`** | Nơi lưu file thật, cấu trúc `{Hãng}/01_Firmware, 02_Application, 03_OS, 04_Patch_OS, 99_Archive` |
| **Google Sheet "Master-Index"** | Nhật ký mọi file đã upload (vendor, loại, model, version, ngày, người upload, checksum, dung lượng...) |
| **Tab "Master-Data"** (trong cùng Sheet Master-Index) | Danh mục dùng chung: danh sách Hãng công nghệ + Sản phẩm/Model đã từng thêm, kèm Folder ID tương ứng — giúp **mọi kỹ sư, mọi máy đều thấy cùng 1 danh mục** |

**Nguyên tắc lưu trữ:** mỗi hãng công nghệ luôn có đúng 5 thư mục con cố định trên Drive:
`01_Firmware`, `02_Application`, `03_OS`, `04_Patch_OS`, `99_Archive`. Mỗi Sản phẩm/Model có 1 thư mục
con riêng bên trong `{Hãng}/{Loại}` để chứa tất cả các phiên bản đã từng upload (không ghi đè).

---

## 2. Đăng nhập / Đăng xuất

### Đăng nhập
1. Mở portal → màn hình **Landing/Đăng nhập** hiện ra đầu tiên nếu chưa đăng nhập.
2. Bấm **"Sign in with Google"** (hoặc **"🔐 Đăng nhập bằng Google"** ở góc trên bên phải).
3. Chọn đúng **tài khoản Google công ty** (domain `@svtech.com.vn`) → bấm **Allow** khi Google hỏi xin quyền
   truy cập Drive/Sheets.
4. Sau khi đăng nhập thành công:
   - Landing page tự đóng lại, vào thẳng giao diện chính.
   - Góc trên bên phải hiển thị đúng **ảnh đại diện + tên thật** của bạn.
   - Hệ thống tự động đồng bộ danh mục Hãng/Sản phẩm và danh sách file thật từ Google Sheet.

> ⚠️ **Chỉ tài khoản thuộc domain công ty** mới đăng nhập được. Nếu dùng Gmail cá nhân hoặc domain khác,
> hệ thống sẽ tự đăng xuất và báo lỗi sai domain.

### Đăng xuất
- Bấm nút **"Đăng xuất"** cạnh tên tài khoản ở góc trên bên phải.
- Hệ thống thu hồi quyền truy cập (revoke token) và **chuyển thẳng về Landing Page đăng nhập**.
- Cần đăng nhập lại để tiếp tục tải lên/tải xuống.

---

## 3. Giao diện chính

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Logo] Software Repository Portal      [🔎 Tìm kiếm toàn cục......] │
│                          [🌙][🔐 Đăng nhập][⬆️ Upload][👤 Tên user] │
├───────────────┬───────────────────────────────────────────────────────┤
│ HÃNG CÔNG NGHỆ│  📄 Tổng số file  💾 Dung lượng  🏢 Số hãng  🆕 Mới  │
│ 🗂️ Tất cả (12)│                                                       │
│ 🟥 Hitachi (1)│  Tất cả hãng                                          │
│ 🟩 HPE (2)    │  [Tất cả][📦Firmware][🧩App][💽OS][🩹Patch OS]       │
│ 🟦 Dell (1)   │  [Trạng thái ▾][Sắp xếp ▾][🔧 Bộ lọc nâng cao]        │
│ 🔷 Cisco (2)  │  ─────────────────────────────────────────────────  │
│ ...           │  TÊN FILE | HÃNG | LOẠI | MODEL | VERSION | NGÀY... │
│ + Thêm hãng   │  (bảng danh sách file, có nút Tải xuống/Checksum)   │
└───────────────┴───────────────────────────────────────────────────────┘
```

- **Sidebar trái**: danh sách Hãng công nghệ, mỗi hãng hiện số lượng file kèm theo. Bấm vào 1 hãng để lọc
  bảng chỉ hiện file của hãng đó.
- **Dashboard 4 thẻ thống kê**: Tổng số file, Tổng dung lượng đã dùng, Số hãng công nghệ, Số file mới trong 7 ngày.
- **Tab loại file**: Tất cả / 📦 Firmware / 🧩 Application / 💽 OS / 🩹 Patch OS.
- **Bảng file**: Tên file, Hãng, Loại, Sản phẩm/Model, Version, Ngày upload, Người upload, Trạng thái, Thao tác.

---

## 4. Duyệt & tìm kiếm file

**Duyệt theo cây thư mục (sidebar + tab):**
- Bấm 1 hãng ở sidebar → chỉ hiện file của hãng đó.
- Bấm thêm 1 tab loại (Firmware/Application/OS/Patch OS) → thu hẹp theo cả Hãng + Loại.
- Bấm "Tất cả hãng" để xem lại toàn bộ.

**Tìm kiếm toàn cục:**
- Gõ từ khoá vào ô tìm kiếm trên cùng (🔎). Tìm kiếm áp dụng trên **tất cả các hãng**, không bị giới hạn
  bởi hãng/loại đang chọn ở sidebar — kể cả khi bạn đang ở trong 1 hãng cụ thể.
- Từ khoá khớp theo: **tên sản phẩm/model, version, tên hãng, loại file, người upload**.
- Khi bạn chuyển sang duyệt bằng cách bấm sidebar/tab, ô tìm kiếm sẽ tự xoá để tránh xung đột 2 chế độ lọc.

**Sắp xếp & lọc theo trạng thái:**
- Dropdown **Trạng thái**: Tất cả / Active / Deprecated / Archived.
- Dropdown **Sắp xếp**: Ngày upload mới nhất → cũ nhất, hoặc Tên A-Z.

---

## 5. Bộ lọc nâng cao

Bấm nút **"🔧 Bộ lọc nâng cao"** để mở/đóng panel lọc chi tiết, gồm 4 tiêu chí (kết hợp được với nhau
và với ô tìm kiếm toàn cục):

| Bộ lọc | Mô tả |
|---|---|
| **Hãng** | Lọc theo 1 hãng cụ thể — độc lập với sidebar, dùng được cả khi đang tìm kiếm toàn cục |
| **Sản phẩm/Model** | Danh sách sản phẩm tự động thu hẹp theo Hãng vừa chọn ở trên (chọn "Tất cả hãng" thì hiện đủ mọi model) |
| **Người upload** | Lọc theo email/tên kỹ sư đã upload file |
| **Ngày upload từ / Đến ngày** | Lọc theo khoảng thời gian upload |
| **Tag phản hồi** | Lọc theo tag kỹ sư đã gắn (Lỗi / Cũ/Lỗi thời / Cần cập nhật / Đã xác nhận OK — xem mục 7) |

- Chọn lại **Hãng** sẽ tự động reset **Sản phẩm/Model** về "Tất cả sản phẩm" (tránh chọn nhầm model của hãng cũ).
- Bấm **"✕ Xoá bộ lọc nâng cao"** để reset cả 4 tiêu chí về mặc định trong 1 lần.
- Số kết quả hiện tại luôn hiển thị ở góc phải thanh bộ lọc (VD: "3 kết quả").

---

## 6. Tải xuống file

- Mỗi dòng file trong bảng có nút:
  - **🔗 Mở trên Drive** — nếu file đã có link Drive thật (đã upload qua hệ thống), mở file trong tab mới.
  - **⬇️ Tải xuống** — với dữ liệu mẫu minh hoạ (chưa gắn Drive thật).
- Cột **📝** (biểu tượng ghi chú, ngay cạnh tên file) — nếu có, bấm để mở **Release Notes / Change Log**
  của phiên bản đó (mở tab mới tới URL đã điền khi upload).
- Cột **🔑 Checksum** — xem mục 9 bên dưới.

---

## 7. Lượt tải & Tag phản hồi nhanh

**Đếm lượt download**
- Mỗi khi có ai bấm **"🔗 Mở trên Drive"** để tải 1 file thật, cột **⬇️ Lượt tải** trong bảng tự tăng thêm 1
  và được ghi ngược ngay vào Google Sheet Master-Index — tất cả kỹ sư dùng chung con số này (không phải đếm
  riêng theo từng máy/trình duyệt).
- Nếu việc ghi lên Sheet gặp sự cố mạng, file vẫn mở bình thường — chỉ có cảnh báo nhẹ trong console, không
  chặn thao tác của bạn.

**Tag phản hồi nhanh**
- Mở **"ℹ️ Chi tiết"** của 1 file để gắn nhanh 1 hoặc nhiều tag phản hồi:

  | Tag | Ý nghĩa |
  |---|---|
  | 🔴 Lỗi | File có vấn đề khi cài đặt/sử dụng |
  | ⚪ Cũ/Lỗi thời | Không còn khuyến nghị dùng, đã có bản mới hơn |
  | 🟠 Cần cập nhật | Cần kiểm tra lại/cập nhật thông tin |
  | 🟢 Đã xác nhận OK | Đã kiểm thử, dùng ổn định |

- Tick chọn tag phù hợp rồi bấm **"💾 Lưu tag phản hồi"**. Tag hiển thị ngay dưới dạng badge màu cạnh tên
  file trong bảng danh sách, giúp cả nhóm thấy trạng thái file mà không cần mở chi tiết.
- Bỏ tick rồi lưu lại = gỡ tag khỏi file.
- Lọc nhanh theo tag qua **Bộ lọc nâng cao** (mục 5).

---

## 8. Tải lên file (Upload Software)

1. Bấm **"⬆️ Upload Software"** ở góc trên (yêu cầu đã đăng nhập Google nếu hệ thống đã kết nối Drive thật).
2. Điền form:

   | Trường | Ghi chú |
   |---|---|
   | **Hãng (Vendor)** * | Chọn từ danh sách đã có, hoặc thêm hãng mới trước (xem mục 10) |
   | **Loại (Category)** * | Firmware / Application / OS / Patch OS |
   | **Sản phẩm/Model** * | Gõ hoặc chọn từ gợi ý có sẵn (xem mục 11) |
   | **Phiên bản (Version)** * | VD: `v2.78`, `9.4 ISO`, `KB5041160` |
   | **Ghi chú phát hành / Change log (URL)** | Không bắt buộc — link tài liệu release notes của hãng |
   | **Tệp tin** * | Chọn hoặc **kéo-thả nhiều file cùng lúc** vào khung upload |

3. Bấm **"Tải lên"**. Thanh tiến trình (%) hiện cho từng file.
4. Sau khi xong: dòng file mới xuất hiện ngay trong bảng, kèm nút "🔗 Mở trên Drive"; đồng thời hệ thống tự
   ghi 1 dòng nhật ký vào Google Sheet **Master-Index** (vendor, loại, model, version, ngày, người upload,
   checksum, kích thước...).

**Upload nhiều file cùng lúc:** khi bạn chọn/kéo-thả nhiều file (ví dụ `firmware.bin` + `release-notes.pdf`,
hoặc nhiều gói vá cùng đợt), tất cả dùng chung thông tin Hãng/Loại/Model/Version/Change log đã điền — mỗi
file được upload và ghi log riêng.

**Không cần đăng nhập (chế độ demo/dev):** nếu hệ thống chưa cấu hình Drive thật, upload chỉ hiển thị minh
hoạ trên giao diện (không có file thật trên Drive) và sẽ mất khi tải lại trang.

---

## 9. Quản lý phiên bản & xác thực file

- **Không ghi đè**: nếu bạn upload đúng version đã tồn tại cho cùng Hãng/Loại/Model, hệ thống cảnh báo
  (hiện hộp thoại xác nhận) nhưng **vẫn giữ lại cả 2 bản** để tra cứu lịch sử — không tự động xoá bản cũ.
- **🏆 Badge "Mới nhất"**: bản có ngày upload gần nhất (và trạng thái Active) trong từng nhóm Hãng+Loại+Model
  sẽ được gắn nhãn 🏆 để kỹ sư biết ngay nên dùng bản nào.
- **Trạng thái file**: `Active` (đang dùng), `Deprecated` (không khuyến nghị nhưng còn giữ), `Archived`
  (đã lưu trữ, ít dùng) — lọc nhanh bằng dropdown Trạng thái ở thanh bộ lọc.
- **Checksum SHA-256**: hệ thống tự tính checksum ngay trên trình duyệt khi upload (bỏ qua với file > 200MB
  để tránh treo trình duyệt). Bấm nút **"🔑 Checksum"** trên dòng file để copy checksum vào clipboard, dùng
  đối chiếu sau khi tải file về bằng lệnh:
  - Windows PowerShell: `Get-FileHash <đường-dẫn-file> -Algorithm SHA256`
  - Linux/macOS: `sha256sum <đường-dẫn-file>`
- **Release Notes / Change log**: nếu điền URL khi upload, biểu tượng 📝 cạnh tên file sẽ mở link đó.

---

## 10. Thêm Hãng công nghệ mới

1. Bấm **"+ Thêm hãng khác"** ở cuối sidebar trái.
2. Điền **Tên hãng** (VD: `Fortinet`) và **biểu tượng emoji** tuỳ chọn (VD: `🛡️`).
3. Bấm **"Thêm"**.
4. Hệ thống (yêu cầu đã đăng nhập):
   - Tự động tạo đầy đủ **5 thư mục con** trên Drive thật cho hãng mới:
     `01_Firmware`, `02_Application`, `03_OS`, `04_Patch_OS`, `99_Archive`.
   - Ghi thông tin hãng mới (kèm Folder ID) vào tab **Master-Data**, để **mọi kỹ sư khác/máy khác** cũng
     thấy ngay hãng này ở sidebar sau khi đăng nhập — không cần cấu hình lại thủ công.
5. Hãng mới xuất hiện ngay trong sidebar và trong dropdown "Hãng (Vendor)" ở form Upload.

---

## 11. Thêm Sản phẩm/Model mới

- Ở form Upload, trường **"Sản phẩm/Model"** là ô nhập liệu có **gợi ý (autocomplete)**:
  - Nếu Model đã từng upload trước đó cho đúng hãng đang chọn → gõ vài ký tự sẽ thấy gợi ý, chọn lại để
    dùng đúng thư mục cũ (không tạo trùng).
  - Nếu gõ tên Model **hoàn toàn mới** → hệ thống hiện chú thích "🆕 Model mới — hệ thống sẽ tự tạo thư mục
    tương ứng trên Drive" ngay dưới ô nhập.
- Khi bấm "Tải lên" với Model mới: hệ thống tự tạo 1 thư mục con mới đúng tên Model bên trong
  `{Hãng}/{Loại}`, đồng thời ghi thêm 1 dòng vào tab **Master-Data** để mọi kỹ sư khác cũng thấy Model này
  trong danh sách gợi ý ở lần upload sau.
- Danh sách gợi ý Model cũng được dùng lại ở **Bộ lọc nâng cao** (mục "Sản phẩm/Model"), tự thu hẹp theo
  Hãng đã chọn.

---

## 12. Chế độ sáng/tối

- Bấm biểu tượng **🌙 / ☀️** ở góc trên bên phải để chuyển đổi giao diện Sáng ↔ Tối.
- Lựa chọn được ghi nhớ (lưu trong trình duyệt) — lần sau mở lại portal sẽ giữ đúng chế độ đã chọn.

---

## 13. Câu hỏi thường gặp / Xử lý sự cố

| Tình huống | Giải thích / Cách xử lý |
|---|---|
| Bấm "Upload Software" nhưng không cho submit | Cần đăng nhập Google trước (xem mục 2) khi hệ thống đã kết nối Drive thật |
| Đăng nhập xong tự động bị đăng xuất, báo sai domain | Bạn đang dùng tài khoản Gmail cá nhân hoặc domain khác `@svtech.com.vn` — đăng nhập lại đúng email công ty |
| Không thấy hãng/model mới do đồng nghiệp vừa thêm | Đăng xuất rồi đăng nhập lại (hoặc tải lại trang) để đồng bộ lại danh mục Master-Data mới nhất |
| Bấm "🔑 Checksum" nhưng báo "chưa có checksum" | File đó là dữ liệu mẫu minh hoạ (chưa upload qua Drive thật), hoặc file quá 200MB nên hệ thống bỏ qua tính checksum |
| Upload trùng version báo cảnh báo | Đây là hành vi có chủ đích — hệ thống **không ghi đè**, bạn có thể chọn tiếp tục để lưu thêm 1 bản mới song song với bản cũ |
| Tìm kiếm không ra kết quả dù chắc chắn có file | Kiểm tra xem **Bộ lọc nâng cao** có đang áp dụng điều kiện thu hẹp (Hãng/Model/Ngày/Người upload) không — bấm "✕ Xoá bộ lọc nâng cao" để reset |
| Đăng xuất xong màn hình hiện gì? | Quay lại đúng **Landing Page đăng nhập** (Sign in with Google) |

---

*Cập nhật lần cuối theo phiên bản portal hiện tại. Với thắc mắc kỹ thuật/triển khai (OAuth, Folder ID,
Sheet ID...), liên hệ đội IT hoặc xem `SETUP-GOOGLE-DRIVE.md`.*
