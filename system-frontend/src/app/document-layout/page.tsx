"use client";

import Link from "next/link";
import { LayoutTemplate, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

// 🚀 หน้าใหม่: ย้ายมาจากแท็บ "การจัดวางเอกสาร" ในหน้า /company (เดิมปนอยู่กับข้อมูลบริษัท/แผนก/เลขรันเอกสาร)
// ให้ขึ้นเป็นเมนูแยกในกลุ่ม "ตั้งค่าระบบ" พร้อม permission แยกอิสระของตัวเอง (manage_document_layout — ดู
// RolesAndPermissionsSeeder.php) ไม่ผูกกับ manage_company อีกต่อไปตามที่ผู้ใช้ขอ
export default function DocumentLayoutPage() {
  return (
    <RoleRouteGuard permission="manage_document_layout">
      <div className="w-full max-w-full px-4 py-4 overflow-x-hidden text-foreground mx-auto space-y-6 antialiased">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <LayoutTemplate className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              การจัดวางเอกสาร
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              ปรับรูปแบบและตำแหน่งการจัดวางเอกสารขายทุกประเภท ทั้งขนาด Letter และ A4
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="rounded-xl border-none shadow-sm overflow-hidden p-0">
            <div className="bg-muted text-foreground p-4 flex items-center gap-3">
              <LayoutTemplate className="w-5 h-5 text-foreground" />
              <h3 className="text-md font-bold leading-none">
                การจัดวางเอกสารขนาด Letter
              </h3>
            </div>
            <CardContent className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground max-w-xl">
                ปรับตำแหน่งและขนาดของแต่ละส่วนในเอกสาร (ชื่อเอกสาร,
                ข้อมูลลูกค้า, ตารางรายการ, สรุปยอด, ลายเซ็น ฯลฯ)
                แบบลาก-วางได้เอง สำหรับพิมพ์ทับกระดาษหัวจดหมายที่มีอยู่แล้ว —
                มี 2 แท็บแยกอิสระ: &quot;เอกสารทั่วไป&quot; (ใบเสนอราคา, ใบวางบิล,
                เงินสด, ใบลดหนี้, ใบเพิ่มหนี้) และ &quot;ใบส่งสินค้าชั่วคราว&quot;
                (ใบกำกับภาษี/ใบเสร็จ ตั้งค่าแยกที่การ์ดด้านล่าง)
              </p>
              <Link
                href="/company/letter-layout"
                className="w-full md:w-auto shrink-0"
              >
                <button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform">
                  จัดวางเอกสาร Letter <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-none shadow-sm overflow-hidden p-0">
            <div className="bg-muted text-foreground p-4 flex items-center gap-3">
              <LayoutTemplate className="w-5 h-5 text-foreground" />
              <h3 className="text-md font-bold leading-none">
                ตั้งค่ากระดาษเอกสาร (ใบกำกับภาษี / ใบเสร็จ / ใบแจ้งหนี้)
              </h3>
            </div>
            <CardContent className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground max-w-xl">
                ปรับตำแหน่งและขนาดของแต่ละส่วนแยกอิสระต่อประเภทเอกสาร —
                ใบกำกับภาษี/ใบส่งสินค้า, ใบเสร็จรับเงิน และใบแจ้งหนี้
                พิมพ์เฉพาะข้อความลงกระดาษหัวจดหมายที่มีอยู่แล้ว (ใบส่งสินค้าชั่วคราว
                ย้ายไปตั้งค่าที่การ์ด &quot;การจัดวางเอกสารขนาด Letter&quot; ด้านบนแล้ว)
              </p>
              <Link
                href="/company/print-layouts"
                className="w-full md:w-auto shrink-0"
              >
                <button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform">
                  ตั้งค่ากระดาษเอกสาร <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-none shadow-sm overflow-hidden p-0">
            <div className="bg-muted text-foreground p-4 flex items-center gap-3">
              <LayoutTemplate className="w-5 h-5 text-foreground" />
              <h3 className="text-md font-bold leading-none">
                การจัดวางเอกสารขนาด A4
              </h3>
            </div>
            <CardContent className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground max-w-xl">
                ตั้งค่าการจัดวางเอกสารขาย A4 ทั้งหมดแยกต่างหากจาก Letter/Half
                Letter รวมถึงพื้นหลังหัวกระดาษใบเสนอราคาและพื้นหลังจางเต็มหน้า
              </p>
              <Link
                href="/company/print-layouts-a4"
                className="w-full md:w-auto shrink-0"
              >
                <button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform">
                  จัดวางเอกสาร A4 <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleRouteGuard>
  );
}
