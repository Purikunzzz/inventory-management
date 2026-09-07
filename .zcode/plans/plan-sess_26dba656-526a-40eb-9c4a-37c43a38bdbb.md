## สาเหตุที่ระบบ Report Generate ใช้งานไม่ได้

ฟีเจอร์นี้**ยังไม่เคยถูก implement เลย** เป็นแค่ UI ปลอม:
- `src/pages/Reports.jsx` ฟังก์ชัน `handleGenerate` (บรรทัด 322–335) แค่ `setTimeout` 1.5 วินาทีแล้วโชว์ toast ปลอม ปุ่ม Download ทุกปุ่ม (รวมถึง Download All และปุ่มในรายการ Recent Reports) ไม่มี onClick จริง ไม่มีไฟล์เกิดขึ้นเลย
- Backend (`app/`) ไม่มี endpoint สำหรับรายงานเลย (มีแค่ auth, users, items, locations, borrow, stats) และ `requirements.txt` ไม่มี library สร้าง PDF/Excel
- หน้าเว็บยังใช้ mock data (`stats.borrowedItems`/`stats.maintenanceItems` ชี้ key ผิด ทำให้การ์ด Active Borrows/Overdue โชว์ 0 ตลอด)
- ปัจจุบัน `node_modules` ยังไม่มีในเครื่อง ต้อง `npm install` ก่อนรัน frontend ได้

## แผนการแก้ไข

### 1. Backend — เพิ่ม endpoint สร้างไฟล์รายงานจริง
- **เพิ่ม dependencies** ใน `requirements.txt`: `openpyxl` (Excel), `fpdf2` (PDF)
- **เพิ่มฟอนต์ไทย** `app/assets/fonts/Sarabun-Regular.ttf` (OFL license) — fpdf2 ต้องมี TTF ไทย ไม่งั้นข้อความไทยใน PDF พัง (CSV/Excel ไม่ต้องใช้, CSV ใส่ BOM ให้ Excel เปิดไทยได้)
- **สร้าง `app/services/report_service.py`** — ธุรกิจลอจิก + สร้างไฟล์ (แยก helper ให้แต่ละฟังก์ชันสั้นตาม code rules ใน CLAUDE.md):
  - Data builders (query จริงจาก DB):
    - **Inventory** → snapshot รายการอุปกรณ์: name, category, location, total/available, สถานะ low stock
    - **Borrowing** → รายการยืม-คืนในช่วงวันที่ที่เลือก: ผู้ยืม, อุปกรณ์, จำนวน, สถานะ, วันยืม/กำหนดคืน/คืนจริง, ธง overdue
    - **Usage** → aggregate จำนวนครั้ง/ชิ้นที่ถูกยืมต่ออุปกรณ์ในช่วงวันที่ (ต่อยอดจาก query ใน `stats_service.py`)
    - **Maintenance** (map) → รายการอุปกรณ์ที่ต้องเฝ้าระวัง: สต็อกต่ำ + รายการค้างคืนเกินกำหนด
    - **Damage** (map) → การวิเคราะห์การคืนล่าช้า (returned_at > due_date ในช่วงวันที่)
    - **Financial** (map) → สรุปองค์ประกอบสต็อกต่อหมวดหมู่: จำนวนรายการ/หน่วย, available vs borrowed, utilization % (ระบุในหัวไฟล์ว่าเป็นข้อมูลโดยประมาณ เพราะไม่มีฟิลด์ราคาใน DB)
  - Renderers: `render_csv` (stdlib csv + BOM), `render_excel` (openpyxl → BytesIO), `render_pdf` (fpdf2 + Sarabun, มี title/meta/ตาราง) — คืน (filename, media_type, bytes)
- **สร้าง `app/api/reports.py`** — router `prefix="/reports"` (guard `get_current_user` เหมือน routes อื่น):
  - `GET /api/reports/{report_type}?format=pdf|excel|csv&start_date=&end_date=` → คืน `Response` พร้อม `Content-Disposition: attachment` (ชื่อไฟล์ภาษาอังกฤษ เช่น `inventory-report-2026-09-06.pdf`)
  - report_type/format ไม่ถูกต้อง → 400 แบบ `{"detail": ...}`; default ช่วงวันที่ = 30 วันล่าสุด (report แบบ snapshot ไม่สนวันที่)
- **ลงทะเบียน router** ใน `app/main.py` + อัปเดตตาราง API ใน `CLAUDE.md`
- **เขียน `tests/test_reports.py`** — ทดสอบทุก report_type × format (200, content-type, ไฟล์ไม่ว่าง), 401 เมื่อไม่มี token, 400 เมื่อ type/format ผิด (ใช้ fixtures ที่มีใน `tests/conftest.py`)

### 2. Frontend — ต่อปุ่ม Generate เข้ากับ API จริง
- **สร้าง `src/services/reportService.js`** — `downloadReport(reportType, format, {startDate, endDate})`: fetch แบบ blob พร้อม Bearer token (pattern เดียวกับ `apiClient.js`) แล้วสร้าง object URL กดดาวน์โหลดผ่าน `<a download>`
- **แก้ `src/pages/Reports.jsx`**:
  - `handleGenerate` → เรียก `downloadReport` ตาม format/ช่วงวันที่ที่เลือก, สำเร็จ → toast พร้อมชื่อไฟล์ + บันทึกประวัติลง state/localStorage, ล้มเหลว → toast.error
  - การ์ดสถิติบน → ใช้ข้อมูลจริงจาก `statsService.getSummary()` ผ่าน TanStack Query (ตาม pattern หน้าอื่น) เอา mock import ออก — การ์ด 4 ใบเปลี่ยนเป็น Total Items / Active Borrows / Low Stock / Total Users
  - หมวด Recent Reports → เปลี่ยนจาก `MOCK_RECENT_REPORTS` เป็นประวัติที่ generate จริงในเบราว์เซอร์นี้ (localStorage), ปุ่ม Download/Download All รายการเก่าที่ไม่มีไฟล์จริงจะถูกเอาออก
  - แก้คำอธิบายการ์ด Maintenance/Damage/Financial ให้ตรงกับข้อมูลที่ map จริง + ลบ error block ที่ unreachable (`!stats`)

### 3. การรัน/ตรวจสอบ
- `npm install` (node_modules หาย) → `npm run build` ตรวจ build ผ่าน
- รัน `pytest tests/test_reports.py` ผ่าน
- `docker compose up -d --build` (build image ใหม่หลังเพิ่ม dependencies) แล้วทดสอบกด Generate ทั้ง 6 รายงาน × 3 ฟอร์แมตในเบราว์เซอร์ว่าได้ไฟล์จริงและภาษาไทยไม่เพี้ยน

### หมายเหตุ
- ไฟล์รายงานไม่ถูกเก็บบน server (generate แล้วส่งกลับทันที) — Recent Reports จึงเป็นประวัติต่อเบราว์เซอร์ ไม่มี re-download ของเดิม
- ข้อมูล Damage/Financial เป็นการ map จากข้อมูลที่มีตามที่ตกลงกัน (ไม่มีฟิลด์ราคา/สถานะซ่อมใน DB)