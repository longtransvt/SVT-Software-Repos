# Kiến trúc lưu trữ Firmware / Application / OS / Patch trên Google Drive nội bộ

## 1. Mục tiêu
- Chuẩn hoá nơi lưu trữ firmware, application, OS, patch OS của các hãng lớn.
- Kỹ sư dễ dàng tìm, tải lên phiên bản mới, tải xuống phiên bản cần dùng.
- Kiểm soát phiên bản, quyền truy cập, có nhật ký thay đổi (audit trail).

## 2. Cấu trúc thư mục đề xuất trên Shared Drive

```
📁 IT-Software-Repository (Shared Drive)
│
├── 📁 00_INDEX_METADATA
│   ├── 📄 Master-Index.gsheet          # Google Sheet: danh mục tất cả file (version, ngày, checksum, người upload)
│   ├── 📄 Naming-Convention.pdf
│   └── 📄 Upload-Guideline.pdf
│
├── 📁 01_Firmware
│   ├── 📁 Hitachi
│   │   ├── 📁 Storage-VSP-Series
│   │   ├── 📁 Storage-HUS-Series
│   │   └── 📁 _Archive
│   ├── 📁 HPE
│   │   ├── 📁 ProLiant-Servers
│   │   ├── 📁 Storage-3PAR-Primera
│   │   ├── 📁 Aruba-Networking
│   │   └── 📁 _Archive
│   ├── 📁 Dell
│   │   ├── 📁 PowerEdge-Servers
│   │   ├── 📁 PowerVault-Storage
│   │   └── 📁 _Archive
│   ├── 📁 Cisco
│   │   ├── 📁 Switches-Nexus-Catalyst
│   │   ├── 📁 UCS-Servers
│   │   └── 📁 _Archive
│   ├── 📁 NetApp
│   │   ├── 📁 ONTAP-Firmware
│   │   └── 📁 _Archive
│   └── 📁 Others (Fortinet, Juniper, IBM, Lenovo...)
│
├── 📁 02_Application
│   ├── 📁 Oracle (Database, WebLogic, Java)
│   ├── 📁 Microsoft (SQL Server, Exchange, SharePoint)
│   ├── 📁 VMware (vSphere, vCenter, NSX)
│   └── 📁 Others
│
├── 📁 03_OS
│   ├── 📁 Microsoft-Windows-Server
│   ├── 📁 RedHat-Linux (RHEL, ISO, Subscription)
│   ├── 📁 VMware-ESXi
│   └── 📁 Others (Ubuntu, SUSE, CentOS/Rocky)
│
├── 📁 04_Patch_OS
│   ├── 📁 Windows-Updates (Cumulative, Security-Only)
│   ├── 📁 RedHat-Errata (RHSA/RHBA/RHEA)
│   ├── 📁 VMware-ESXi-Patches
│   └── 📁 Others
│
└── 📁 99_Archive (phiên bản end-of-life, chờ huỷ theo retention policy)
```

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
- Nút "Tải lên phiên bản mới" mở modal nhập metadata + chọn file → gọi Google Drive API (Google Identity Services + Drive API v3, scope `drive.file`) để upload thực tế lên đúng folder.
- Thanh tìm kiếm/lọc theo hãng, loại, từ khoá, khoảng ngày.
- Khu vực này chỉ là **front-end demo**: các hàm gọi Google Drive API được đánh dấu `TODO` để đội kỹ thuật cắm OAuth Client ID + Folder ID thật vào khi triển khai.

Xem file `index.html`, `assets/styles.css`, `assets/script.js`.
