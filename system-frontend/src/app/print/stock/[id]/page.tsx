"use client";
import { useEffect, useState } from "react";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/auth-storage";

export default function StockPrintPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    // 💡 1. หักดิบ: ดึง ID จาก URL โดยตรง (ไม่รอ Next.js ที่ชอบเอ๋อ)
    const pathParts = window.location.pathname.split('/');
    const idFromUrl = pathParts[pathParts.length - 1];

    if (!idFromUrl || idFromUrl === "undefined" || idFromUrl === "[id]") {
      setErrorMsg("ไม่พบรหัสเอกสารใน URL");
      setLoading(false);
      return;
    }

    // 💡 2. ตั้งเวลาตัดจบ (Hard Timeout) บังคับเลิกหมุนใน 5 วินาที
    const timeoutId = setTimeout(() => {
      setErrorMsg("เซิร์ฟเวอร์ไม่ตอบสนอง (Timeout 5 วิ) กรุณาเช็ค Backend");
      setLoading(false);
    }, 5000);

    const fetchData = async () => {
      try {
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

        const res = await fetch(`${apiUrl}/stock-movements/${idFromUrl}`, {
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });

        clearTimeout(timeoutId); // ปิดตัวนับเวลาถ้าตอบกลับทัน

        if (!res.ok) {
          setErrorMsg(`API Error: ${res.status} (เช็ค Route api.php ว่าใส่หรือยัง)`);
          setLoading(false);
          return;
        }

        const json = await res.json();
        
        if (json && json.data) {
          setData(json.data);
        } else {
          setErrorMsg("ดึงข้อมูลสำเร็จ แต่ Backend ไม่ได้ส่ง 'data' กลับมา");
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.error("Fetch error:", err);
        setErrorMsg(err.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      } finally {
        setLoading(false); // บังคับปิดตัวหมุน 100%
      }
    };

    fetchData();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
      <p className="text-slate-600 font-bold text-lg">กำลังดึงข้อมูลใบเสร็จ...</p>
      <p className="text-sm text-slate-400 mt-2">หากรอเกิน 5 วินาที ระบบจะตัดการทำงานอัตโนมัติ</p>
    </div>
  );

  // 💡 ถ้ามี Error จะโชว์กรอบแดง พร้อมสาเหตุชัดเจนทันที
  if (errorMsg || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 p-8 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-200 max-w-lg w-full">
        <p className="text-red-600 font-black text-2xl mb-2">เกิดข้อผิดพลาด!</p>
        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-medium mt-4 text-left border border-red-100">
          <b>สาเหตุที่พบ:</b> {errorMsg || "ไม่พบข้อมูลจากเซิร์ฟเวอร์"}
        </div>
        <Button variant="outline" className="mt-6 w-full font-bold cursor-pointer h-12 rounded-xl" onClick={() => window.close()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> ปิดหน้าต่างนี้
        </Button>
      </div>
    </div>
  );

  const isStockIn = data.type === "in";

  return (
    <div className="min-h-screen bg-slate-200 py-8 print:py-0 print:bg-white text-black">
      {/* แถบปุ่มกด (ซ่อนเวลาสั่งปริ้น) */}
      <div className="max-w-[210mm] mx-auto mb-6 flex justify-between print:hidden">
        <Button variant="outline" onClick={() => window.close()} className="bg-white shadow-sm rounded-xl font-bold cursor-pointer">
          <ArrowLeft className="w-4 h-4 mr-2" /> ปิดหน้าต่าง
        </Button>
        <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm rounded-xl font-bold cursor-pointer">
          <Printer className="w-4 h-4 mr-2" /> สั่งพิมพ์เอกสาร
        </Button>
      </div>

      {/* หน้ากระดาษ A4 */}
      <div className="max-w-[210mm] min-h-[297mm] mx-auto bg-white shadow-xl print:shadow-none p-12 relative overflow-hidden">
        
        {/* หัวเอกสาร */}
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-slate-900">ST PLUS</h1>
            <h2 className="text-lg font-bold text-slate-600 uppercase tracking-widest mt-1">ERP System</h2>
            <p className="text-sm text-slate-500 mt-2">123/45 ถนนตัวอย่าง แขวงทดสอบ</p>
            <p className="text-sm text-slate-500">เขตระบบ กรุงเทพมหานคร 10000</p>
          </div>
          <div className="text-right">
            <h2 className={`text-2xl font-black px-4 py-2 inline-block rounded-lg mb-3 ${isStockIn ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {isStockIn ? "ใบรับสินค้าเข้าคลัง" : "ใบเบิกสินค้าออก"}
            </h2>
            <p className="text-slate-800 font-bold mt-2">
              เลขที่อ้างอิง: <span className="font-normal">{data.reference_number || `REF-${String(data.id).padStart(5, '0')}`}</span>
            </p>
            <p className="text-slate-800 font-bold mt-1">
              วันที่ทำรายการ: <span className="font-normal">{new Date(data.created_at).toLocaleString("th-TH")}</span>
            </p>
          </div>
        </div>

        {/* ตารางสินค้า */}
        <table className="w-full text-left mb-8 border-collapse">
          <thead>
            <tr className="border-y-2 border-slate-300 bg-slate-50/50">
              <th className="py-4 px-3 font-bold text-slate-800 w-16 text-center">ลำดับ</th>
              <th className="py-4 px-3 font-bold text-slate-800 w-40">รหัสสินค้า (SKU)</th>
              <th className="py-4 px-3 font-bold text-slate-800">รายละเอียดสินค้า</th>
              <th className="py-4 px-3 font-bold text-slate-800 w-32 text-center">จำนวน</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="py-5 px-3 text-center align-top">1</td>
              <td className="py-5 px-3 font-medium align-top">{data.product?.sku}</td>
              <td className="py-5 px-3 align-top">
                <p className="font-bold text-lg">{data.product?.name}</p>
                {data.product?.has_serial_number && data.serials && data.serials.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Serial Numbers:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.serials.map((sn: string, idx: number) => (
                        <span key={idx} className="text-xs border border-slate-300 px-2 py-0.5 rounded text-slate-700 bg-slate-50">{sn}</span>
                      ))}
                    </div>
                  </div>
                )}
              </td>
              <td className="py-5 px-3 text-center align-top font-black text-xl">{data.quantity}</td>
            </tr>
          </tbody>
        </table>

        {/* หมายเหตุ */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-20 min-h-[100px]">
          <p className="font-bold text-slate-800 mb-1">หมายเหตุ:</p>
          <p className="text-slate-600">{data.note || "-"}</p>
        </div>

        {/* ลายเซ็น (เกาะอยู่ด้านล่างกระดาษเสมอ) */}
        <div className="grid grid-cols-2 gap-20 absolute bottom-16 left-12 right-12">
          <div className="text-center">
            <div className="border-b border-slate-400 w-56 mx-auto mb-3"></div>
            <p className="text-slate-800">( ........................................................ )</p>
            <p className="font-bold text-slate-700 mt-2">ผู้{isStockIn ? "ทำรายการรับเข้า" : "ทำรายการเบิกออก"}</p>
            <p className="text-sm text-slate-500 mt-1">วันที่: _______/_______/_______</p>
          </div>
          <div className="text-center">
            <div className="border-b border-slate-400 w-56 mx-auto mb-3"></div>
            <p className="text-slate-800">( ........................................................ )</p>
            <p className="font-bold text-slate-700 mt-2">ผู้อนุมัติ / หัวหน้างาน</p>
            <p className="text-sm text-slate-500 mt-1">วันที่: _______/_______/_______</p>
          </div>
        </div>
        
      </div>
    </div>
  );
}