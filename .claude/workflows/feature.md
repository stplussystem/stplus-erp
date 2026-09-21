# Workflow: Feature ใหม่

ใช้เมื่อผู้ใช้ต้องการสร้าง feature ใหม่ที่มีผลต่อหลายส่วนของระบบ

## ขั้นตอน
1. Architect วิเคราะห์ requirement และ architecture
2. Researcher ค้นข้อมูลเฉพาะส่วนที่จำเป็น
3. Developer implement
4. Debugger ตรวจและแก้ error ที่เกิดขึ้น
5. QA ตรวจ feature และ regression

## กฎ
- งานเล็กไม่จำเป็นต้องเรียกทุก Agent
- อย่าทำ research ถ้าไม่จำเป็น
- ก่อนเปลี่ยน architecture ใหญ่ต้องสรุปเหตุผล
- ก่อนจบต้องมีผล test/build ที่เหมาะสม
