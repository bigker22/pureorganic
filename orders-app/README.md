# Pure Organic Orders (Vercel)

หน้าจัดการออเดอร์ ยอดเข้าชม และใบเสนอราคา อ่าน/เขียน Google Sheet "Pure Organic - Orders"
เข้าได้เฉพาะบัญชี Google ที่อยู่ใน `ALLOWED_EMAILS` (ข้อมูลลูกค้าไม่ถูกส่งออกถ้ายังไม่ล็อกอิน)

## ตั้งค่า (ทำครั้งเดียว)

### 1. Google Cloud (console.cloud.google.com)
1. สร้างโปรเจกต์ใหม่ (หรือใช้ที่มีอยู่)
2. APIs & Services → Library → เปิด **Google Sheets API**
3. **Service account** (ไว้ให้เซิร์ฟเวอร์อ่าน/เขียนชีต)
   - IAM & Admin → Service Accounts → Create → ตั้งชื่อ เช่น `pureorganic-orders`
   - เข้า service account → Keys → Add key → JSON → ไฟล์ .json จะดาวน์โหลดลงเครื่อง (เก็บเป็นความลับ)
   - เปิด Google Sheet "Pure Organic - Orders" → Share → ใส่อีเมล service account (…@….iam.gserviceaccount.com) สิทธิ์ **Editor**
4. **OAuth Client ID** (ไว้ปุ่ม "เข้าสู่ระบบด้วย Google")
   - APIs & Services → OAuth consent screen → External → กรอกชื่อแอป/อีเมล → เพิ่มอีเมลของคุณใน Test users
   - Credentials → Create credentials → OAuth client ID → Web application
   - Authorized JavaScript origins: ใส่ URL ของ Vercel เช่น `https://pureorganic-orders.vercel.app`

### 2. Vercel
1. Add New → Project → Import repo `bigker22/pureorganic`
2. **Root Directory: `orders-app`** · Framework Preset: Other
3. Environment Variables:

| ชื่อ | ค่า |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID จากข้อ 1.4 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` ในไฟล์ JSON |
| `GOOGLE_PRIVATE_KEY` | `private_key` ในไฟล์ JSON (คัดลอกทั้งก้อน รวม BEGIN/END) |
| `ALLOWED_EMAILS` | อีเมลที่เข้าได้ คั่นด้วยจุลภาค เช่น `bigker22@gmail.com,pureorganic.sales01@gmail.com` |
| `SHEET_ID` | (ไม่บังคับ) ค่าเริ่มต้นคือชีต Pure Organic - Orders |

4. Deploy แล้วนำ URL ที่ได้ไปใส่ใน Authorized JavaScript origins (ข้อ 1.4) ถ้ายังไม่ได้ใส่

## ใช้งาน
- **Done** → สถานะในแท็บ "ออเดอร์" = `เสร็จ` · **Not Done** → เลือกสาเหตุ บันทึกลง "หมายเหตุแอดมิน" และสถานะ = `ใหม่`
- **บันทึกใบเสนอราคา** → ออกเลขที่ใหม่ (QT-YYMM-NNN) ทุกครั้ง บันทึกในแท็บ "ใบเสนอราคา"
- **พิมพ์ / PDF** → เปิดหน้าต่างพิมพ์ของเบราว์เซอร์ (เลือก "บันทึกเป็น PDF" ได้)
- **เขียนอีเมลใน Gmail** → เปิดหน้าเขียนอีเมลของ pureorganic.sales01@gmail.com พร้อมข้อความใบเสนอราคา (ยังไม่ส่ง กดส่งเอง)
