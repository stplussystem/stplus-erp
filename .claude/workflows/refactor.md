# Workflow: Refactor

## ขั้นตอน
1. Architect วิเคราะห์ว่าควร refactor หรือไม่
2. Developer ทำ refactor โดยรักษาพฤติกรรมเดิม
3. QA ตรวจ regression
4. Run lint/test/build ตามความเหมาะสม

## กฎ
ห้ามเปลี่ยน behavior ของระบบโดยไม่มี requirement รองรับ
