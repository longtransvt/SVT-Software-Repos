# Kiến trúc lưu trữ Firmware / Application / OS / Patch trên Google Drive nội bộ

🌐 **Truy cập trực tiếp (GitHub Pages):** https://longtransvt.github.io/SVT-Software-Repos/

> ⚠️ Lưu ý: Trang được host qua GitHub Pages nên có thể truy cập public trên Internet. Chỉ tài khoản Google
> thuộc domain công ty và có quyền truy cập Shared Drive `FW-REPO` mới đăng nhập/tải lên/tải xuống được —
> tuy nhiên nên cân nhắc chuyển repo sang **private** + **GitHub Pages nội bộ** (hoặc host trên hạ tầng nội bộ)
> nếu không muốn giao diện/cấu hình (Client ID, Sheet ID...) bị lộ công khai.

## 1. Mục tiêu
- Chuẩn hoá nơi lưu trữ firmware, application, OS, patch OS của các hãng lớn.
- Kỹ sư dễ dàng tìm, tải lên phiên bản mới, tải xuống phiên bản cần dùng.
- Kiểm soát phiên bản, quyền truy cập, có nhật ký thay đổi (audit trail).

## 2. Cấu trúc thư mục thực tế trên Shared Drive (theo Hãng trước)

```
📁 FW-REPO (Shared Drive: [BẢO MẬT]_SYSTEM HCM)
│
├── 📁 00_INDEX_METADATA
│   ├── 📄 Master-Index      # Google Sheet: danh mục tất cả file (version, ngày, checksum, người upload)
│   └── 📄 Master-Data       # tab riêng trong Master-Index: danh mục Hãng + Sản phẩm/Model dùng chung
│
├── 📁 Hitachi
│   ├── 📁 01_Firmware  (Storage-VSP-Series, Storage-HUS-Series, _Archive, ...)
│   ├── 📁 02_Application
│   ├── 📁 03_OS
│   ├── 📁 04_Patch_OS
│   └── 📁 99_Archive
│
├── 📁 HPE
│   ├── 📁 01_Firmware  (ProLiant-Servers, Storage-3PAR-Primera, Aruba-Networking, _Archive, ...)
│   ├── 📁 02_Application
│   ├── 📁 03_OS
│   ├── 📁 04_Patch_OS
│   └── 📁 99_Archive
│
├── 📁 Dell        (01_Firmware: PowerEdge-Servers, PowerVault-Storage, _Archive | 02_Application | 03_OS | 04_Patch_OS | 99_Archive)
├── 📁 Cisco       (01_Firmware: Switches-Nexus-Catalyst, UCS-Servers, _Archive | 02_Application | 03_OS | 04_Patch_OS | 99_Archive)
├── 📁 NetApp      (01_Firmware: ONTAP-Firmware, _Archive | 02_Application | 03_OS | 04_Patch_OS | 99_Archive)
├── 📁 Oracle      (01_Firmware | 02_Application | 03_OS | 04_Patch_OS | 99_Archive)
├── 📁 Microsoft   (01_Firmware | 02_Application | 03_OS: Microsoft-Windows-Server | 04_Patch_OS: Windows-Updates | 99_Archive)
├── 📁 RedHat      (01_Firmware | 02_Application | 03_OS: RedHat-Linux | 04_Patch_OS: RedHat-Errata | 99_Archive)
├── 📁 VMware      (01_Firmware | 02_Application | 03_OS: VMware-ESXi | 04_Patch_OS: VMware-ESXi-Patches | 99_Archive)
└── 📁 Others      (Fortinet, Juniper, IBM, Lenovo, Ubuntu, SUSE... — mỗi hãng cũng có đủ 5 thư mục con như trên)
```

**Quy tắc:** mỗi hãng luôn có đúng 5 thư mục con cố định: `01_Firmware`, `02_Application`, `03_OS`, `04_Patch_OS`, `99_Archive`.
Khi upload, app chọn đúng thư mục con theo loại file (Firmware/Application/OS/Patch) nằm bên trong đúng thư mục hãng — dùng Folder ID cố định đã cấu hình sẵn (xem `assets/script.js` → `VENDOR_CATEGORY_FOLDER_IDS`) nên không tạo trùng thư mục. Hãng mới thêm qua "+ Thêm hãng" sẽ được tự động tạo đủ cấu trúc 5 thư mục con này.

### Quy ước đặt tên file
```
<Hãng>_<Dòng-sản-phẩm>_<Loại>_<Phiên-bản>_<YYYYMMDD>.<ext>
Ví dụ:
HPE_ProLiant-DL380-Gen10_iLO5-Firmware_v2.78_20260915.bin
RedHat_RHEL9_OS-Patch_RHSA-2026-1234_20260910.rpm
```

### Metadata bắt buộc (lưu trong Master-Index.gsheet hoặc Drive file description)
| Trường | Mô tả |
|---|---|
| Vendor | Hitachi, HPE, Dell, Cisco, NetApp, Oracle, Microsoft, RedHat... |
| Category | Firmware / Application / OS / Patch OS |
| Product/Model | Dòng sản phẩm cụ thể |
| Version | Số phiên bản |
| Release Date | Ngày phát hành của hãng |
| Upload Date | Ngày tải lên |
| Uploaded By | Kỹ sư thực hiện |
| Checksum (SHA-256) | Để xác thực toàn vẹn file |
| Change Log / Release Notes | Link tài liệu hãng |
| Status | Active / Deprecated / Archived |

## 3. Phân quyền (Google Workspace Shared Drive)
- **Admin (IT Manager)**: Full quyền, quản lý cấu trúc, xoá/di chuyển.
- **Engineer (Content Manager)**: Upload, chỉnh sửa metadata, không xoá thư mục gốc.
- **Viewer (toàn công ty/nhóm vận hành)**: Chỉ xem & tải xuống.
- Dùng **Google Groups** ánh xạ theo từng hãng/nhóm để cấp quyền theo thư mục con, tránh cấp quyền lẻ theo từng người.

## 4. Vòng đời phiên bản
1. Kỹ sư upload file mới vào đúng thư mục hãng/loại + điền metadata vào Master-Index.
2. Phiên bản cũ được đánh dấu "Deprecated" (không xoá ngay) và sau 1 chu kỳ (vd 6 tháng) chuyển vào `_Archive`.
3. Google Apps Script (Trigger onFormSubmit / onChange) tự động cập nhật Master-Index khi có file mới, gửi email thông báo nhóm liên quan.

## 5. Giao diện Web Portal (trong thư mục này)
Portal tĩnh (HTML/CSS/JS) đóng vai trò lớp UI thân thiện phía trên Google Drive:
- Sidebar chọn hãng (Vendor).
- Tab chọn loại: Firmware / Application / OS / Patch OS.
- Bảng danh sách file: tên, version, ngày, người upload, trạng thái, nút Tải xuống.
- Nút "Upload Software" mở modal nhập metadata + chọn file → gọi Google Drive API (Google Identity Services + Drive API v3, scope `drive.file`) để upload thực tế lên đúng folder.
- Thanh tìm kiếm/lọc theo hãng, loại, từ khoá, khoảng ngày.
- Khu vực này chỉ là **front-end demo**: các hàm gọi Google Drive API được đánh dấu `TODO` để đội kỹ thuật cắm OAuth Client ID + Folder ID thật vào khi triển khai.

Xem file `index.html`, `assets/styles.css`, `assets/script.js`.
