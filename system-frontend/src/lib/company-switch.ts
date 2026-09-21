// เรียก POST /switch-company แล้วคืนค่า payload รูปแบบเดียวกับ /login, /me (มี user.companies,
// user.active_company_id ล่าสุดหลังสลับ) ใช้ร่วมกันทั้ง popup เลือกบริษัทหลัง login และปุ่มสลับบริษัทที่ topbar
export async function switchCompany(token: string, companyId: number): Promise<any> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

  const res = await fetch(`${apiUrl}/switch-company`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ company_id: companyId }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "ไม่สามารถสลับบริษัทได้");
  }

  return data;
}
