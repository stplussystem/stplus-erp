"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Layers,
  FileCheck,
  ScanLine,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import dayjs from "dayjs";
import { toast } from "sonner";
import { SerialManager } from "@/components/stock/SerialManager";
import { cn } from "@/lib/utils";

export default function CreateGoodsReceiptPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const searchParams = useSearchParams();
  const autoLoadPoId = searchParams.get("po_id");
  const [poList, setPoList] = useState<any[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string>("");
  const [grData, setGrData] = useState<any>(null);
  const [loadingPo, setLoadingPo] = useState(false);
  const [isSaving, setIsReceiving] = useState(false);

  // Form States
  const [refNumber, setRefNumber] = useState("");
  const [receivedDate, setReceivedDate] = useState(
    dayjs().format("YYYY-MM-DD"),
  );
  const [note, setNote] = useState("");
  const [itemForms, setItemForms] = useState<Record<number, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchApprovedPOs();
  }, []);

  // เพิ่ม useEffect ตัวใหม่ เพื่อดักจับว่าถ้ามี po_id ส่งมา ให้รันฟังก์ชันโหลดข้อมูลทันที!
  useEffect(() => {
    if (autoLoadPoId && poList.length > 0) {
      setSelectedPoId(autoLoadPoId);
      handlePoChange(autoLoadPoId);
    }
  }, [autoLoadPoId, poList]); // รอให้โหลด poList เสร็จก่อน ค่อยจับคู่

  // โหลดรายการ PO ทั้งหมดที่สามารถนำมารับของได้ (Approved หรือ Partial)
  const fetchApprovedPOs = async () => {
    try {
      const token =
        localStorage.getItem("system_token") ||
        sessionStorage.getItem("system_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/purchase-orders`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        const availablePOs = data.filter(
          (p: any) => p.status === "Approved" || p.status === "Partial",
        );
        setPoList(availablePOs);
      }
    } catch (error) {
      toast.error("ดึงข้อมูลใบสั่งซื้อไม่สำเร็จ");
    }
  };

  // พอยูสเซอร์เลือกเลขที่ PO ระบบจะวิ่งไปโหลดสินค้าค้างรับมาปั่นเป็นฟอร์มทันที
  const handlePoChange = async (poId: string) => {
    setSelectedPoId(poId);
    if (!poId) {
      setGrData(null);
      return;
    }

    setLoadingPo(true);
    try {
      const token =
        localStorage.getItem("system_token") ||
        sessionStorage.getItem("system_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/purchase-orders/${poId}/pending-items`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (res.ok) {
        const data = await res.json();
        setGrData(data);

        // เซ็ตฟอร์มเริ่มต้นของสินค้าแต่ละตัว
        const initialForms: Record<number, any> = {};
        data.items.forEach((item: any) => {
          initialForms[item.po_item_id] = {
            selected: true,
            qty: item.remaining_qty,
            serials: [],
            isSnOpen: false,
          };
        });
        setItemForms(initialForms);
      } else {
        const err = await res.json();
        toast.error(err.message || "โหลดข้อมูลสินค้าค้างรับไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoadingPo(false);
    }
  };

  const handleItemFormChange = (
    poItemId: number,
    field: string,
    value: any,
  ) => {
    setItemForms((prev) => ({
      ...prev,
      [poItemId]: { ...prev[poItemId], [field]: value },
    }));
  };

  const handleSubmitGR = async () => {
    if (!selectedPoId) {
      setErrors({ selectedPoId: "กรุณาเลือกใบสั่งซื้อที่ต้องการอ้างอิง" });
      return toast.error("กรุณาเลือกใบสั่งซื้อที่ต้องการอ้างอิง");
    }
    setErrors({});

    try {
      const filteredItems = grData.items
        .filter(
          (item: any) =>
            itemForms[item.po_item_id]?.selected &&
            itemForms[item.po_item_id]?.qty > 0,
        )
        .map((item: any) => {
          const form = itemForms[item.po_item_id];
          const qty = Number(form.qty);
          let serials: string[] = [];

          if (item.has_serial_number) {
            const rawSerials = form.serials || [];
            serials = rawSerials
              .filter((s: string) => s.trim() !== "")
              .slice(0, qty);

            if (serials.length !== qty) {
              throw new Error(
                `สินค้า "${item.product_name}" ระบุ S/N มาไม่ครบตามจำนวนรับเข้า (${qty} ชิ้น)`,
              );
            }
          }

          return { po_item_id: item.po_item_id, receive_qty: qty, serials };
        });

      if (filteredItems.length === 0) {
        setErrors((prev) => ({
          ...prev,
          items: "กรุณาเลือกสินค้าและระบุจำนวนอย่างน้อย 1 รายการ",
        }));
        return toast.error("กรุณาเลือกสินค้าและระบุจำนวนอย่างน้อย 1 รายการ");
      }

      setIsReceiving(true);
      const toastId = toast.loading("กำลังบันทึกใบรับสินค้าเข้าคลัง...");
      const token =
        localStorage.getItem("system_token") ||
        sessionStorage.getItem("system_token");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/purchase-orders/${selectedPoId}/goods-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify({
            reference_number: refNumber,
            received_date: receivedDate,
            note: note,
            items: filteredItems,
          }),
        },
      );

      if (!res.ok)
        throw new Error((await res.json()).message || "บันทึกเอกสารไม่สำเร็จ");

      const resJson = await res.json();
      toast.success(
        `สร้างใบรับสินค้าเลขที่ ${resJson.gr_number} เรียบร้อยแล้ว!`,
        { id: toastId },
      );
      router.push("/goods-receipts"); // หรือเปลี่ยนเส้นทางไปหน้ารายการใบ GR ของพี่ได้เลย
    } catch (error: any) {
      toast.error("บันทึกไม่สำเร็จ", { description: error.message });
    } finally {
      setIsReceiving(false);
    }
  };

  // เพิ่ม useEffect ตัวนี้ เพื่อดักเตะคนไม่มีสิทธิ์ออกไป
  useEffect(() => {
    const storedUser =
      localStorage.getItem("system_user") ||
      sessionStorage.getItem("system_user");

    if (storedUser) {
      const parsedData = JSON.parse(storedUser);
      const user = parsedData.user;

      if (!user) {
        router.replace("/");
        return;
      }

      // 🚀 เช็ค Super Admin แบบไร้รอยต่อ
      const isSuperAdmin =
        Array.isArray(user.roles) &&
        user.roles.some((r: any) =>
          typeof r === "string"
            ? r.includes("Super Admin")
            : r?.name?.includes("Super Admin"),
        );

      // 🚀 เช็คสิทธิ์รวม
      const hasPermission =
        user.is_platform_admin ||
        isSuperAdmin ||
        (Array.isArray(user.permissions) &&
          user.permissions.some((p: any) =>
            typeof p === "string"
              ? p === "create_goods_receipt"
              : p?.name === "create_goods_receipt",
          ));

      if (!hasPermission) {
        toast.error("คุณไม่มีสิทธิ์เข้าถึงหน้าสร้างใบรับสินค้าครับ");
        router.replace("/goods-receipts");
      } else {
        setIsAuthorized(true);
      }
    } else {
      router.replace("/");
    }
  }, [router]);
  // ถ้ายังเช็คสิทธิ์ไม่เสร็จ หรือไม่มีสิทธิ์ ให้โชว์หน้าจอขาวๆ ไปก่อน (กันคนแอบเห็นฟอร์ม)
  if (!isAuthorized) {
    return <div className="min-h-screen bg-muted/50"></div>;
  }

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 text-green-600 rounded-xl border border-green-100 dark:border-green-800/50 shadow-sm">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              สร้างใบรับสินค้า (Goods Receipt)
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              ออกเอกสารรับของเข้าโกดังสรุปยอดอ้างอิงจากใบสั่งซื้อหลัก
            </p>
          </div>
        </div>
        <Link href="/goods-receipts">
          <button className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform">
            <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
          </button>
        </Link>
      </div>

      {/* 🎯 ส่วนที่ 1: กล่องรับข้อมูลสไตล์เดียวกับรูปที่แนบมา */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ช่องเลือกเลขที่ PO หลัก */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              อ้างอิงใบสั่งซื้อ (PO)*
            </label>
            <AppSelect
              value={selectedPoId || "none"}
              onValueChange={(value) => {
                const poId = value === "none" ? "" : value;
                handlePoChange(poId);
                setErrors((prev) => ({
                  ...prev,
                  selectedPoId: "",
                }));
              }}
              error={!!errors.selectedPoId}
              placeholder="-- เลือกใบสั่งซื้ออนุมัติแล้ว --"
              options={[
                { value: "none", label: "-- เลือกใบสั่งซื้ออนุมัติแล้ว --" },
                ...poList.map((po) => ({
                  value: String(po.id),
                  label: `${po.po_number} (${po.contact?.business_name || po.contact?.name})`,
                })),
              ]}
            />
            {errors.selectedPoId && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.selectedPoId}
              </p>
            )}
          </div>

          {/* ช่องกรอก เลขที่ใบส่งของอ้างอิง */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              เลขที่ใบส่งของ / อ้างอิงภายนอก
            </label>
            <div className="relative">
              <Layers className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="เช่น DO-690024, INV-9912"
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
              />
            </div>
          </div>

          {/* ช่องเลือกวันที่บันทึกรับของ */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              วันที่รับสินค้าจริง*
            </label>
            <div className="relative">
              <AppDatePicker value={receivedDate} onChange={setReceivedDate} />
            </div>
          </div>
        </div>

        {/* บรรทัดสรุปข้อมูล Metadata ของฝั่งจัดซื้อ (จะเด้งขึ้นมาเมื่อโหลดข้อมูล PO เสร็จ) */}
        {grData && (
          <div className="mt-6 pt-5 border-t border-dashed border-border grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/50 p-4 rounded-xl">
            <div>
              <div className="text-xs text-muted-foreground">
                ผู้จำหน่าย (Supplier)
              </div>
              <div className="text-sm font-bold text-foreground mt-0.5">
                {grData.supplier_name}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">โครงการ (Project)</div>
              <div className="text-sm font-medium text-muted-foreground mt-0.5">
                {grData.project_name}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">คลังสินค้าปลายทาง</div>
              <div className="text-sm font-bold text-blue-600 mt-0.5">
                {grData.warehouse_name}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">เอกสารต้นทาง</div>
              <div className="text-sm font-medium text-muted-foreground mt-0.5">
                Purchase Order ({grData.po_number})
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🎯 ส่วนที่ 2: ตารางแสดงสินค้าค้างรับ และกรอกข้อมูลสต๊อก/Serial */}
      {loadingPo ? (
        <AppLoading />
      ) : grData ? (
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden animate-in fade-in duration-200">
          <div className="p-4 border-b border-border bg-muted/50 font-bold text-foreground">
            รายการสินค้าคงค้างคอยตรวจรับเข้าคลัง
          </div>
          {errors.items && (
            <p className="text-red-500 text-xs font-medium px-4 pt-3">
              {errors.items}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                <tr>
                  <th className="px-5 py-3.5 text-center w-12">เลือก</th>
                  <th className="px-5 py-3.5">รายละเอียดสินค้า</th>
                  <th className="px-5 py-3.5 text-center w-24">ยอดสั่งเดิม</th>
                  <th className="px-5 py-3.5 text-center w-24">รับแล้ว</th>
                  <th className="px-5 py-3.5 text-center w-24 text-amber-600 font-bold">
                    ค้างรับ
                  </th>
                  <th className="px-5 py-3.5 w-32 text-center bg-blue-50/30 text-blue-700 font-bold">
                    จำนวนรับรอบนี้
                  </th>
                  <th className="px-5 py-3.5 w-60 text-center bg-blue-50/30 text-blue-700 font-bold">
                    จัดการ S/N
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {grData.items.map((item: any) => {
                  const form = itemForms[item.po_item_id] || {};
                  return (
                    <tr
                      key={item.po_item_id}
                      className={`hover:bg-muted/50 transition-colors ${!form.selected ? "opacity-40 bg-muted/30" : ""}`}
                    >
                      <td className="px-5 py-4 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 cursor-pointer accent-blue-600"
                          checked={form.selected || false}
                          onChange={(e) =>
                            handleItemFormChange(
                              item.po_item_id,
                              "selected",
                              e.target.checked,
                            )
                          }
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-foreground">
                          {item.product_name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          SKU: {item.sku || "-"}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center font-medium text-muted-foreground">
                        {item.ordered_qty}
                      </td>
                      <td className="px-5 py-4 text-center text-green-600 font-medium">
                        {item.received_qty}
                      </td>
                      <td className="px-5 py-4 text-center text-amber-600 font-bold bg-amber-50/20">
                        {item.running_qty || item.remaining_qty}
                      </td>

                      {/* ช่องใส่จำนวนตัวเลขที่จะรับเข้า */}
                      <td className="px-5 py-4 bg-blue-50/10">
                        <input
                          type="number"
                          min="1"
                          max={item.remaining_qty}
                          disabled={!form.selected}
                          className="w-full h-10 px-2 border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-center font-bold disabled:bg-muted outline-none"
                          value={form.qty || ""}
                          onChange={(e) =>
                            handleItemFormChange(
                              item.po_item_id,
                              "qty",
                              e.target.value,
                            )
                          }
                        />
                      </td>

                      {/* กล่อง S/N ระดับตำนานที่เราย้ายมาประจำตำแหน่งนี้ */}
                      <td className="px-5 py-4 bg-blue-50/10">
                        {item.has_serial_number ? (
                          <div className="flex flex-col items-center">
                            <button
                              type="button"
                              disabled={!form.selected || !form.qty}
                              onClick={() =>
                                handleItemFormChange(
                                  item.po_item_id,
                                  "isSnOpen",
                                  true,
                                )
                              }
                              className="h-10 px-4 bg-background border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center justify-center gap-2 text-xs font-bold w-full"
                            >
                              <ScanLine className="w-4 h-4" /> ระบุ S/N (
                              {form.serials?.filter((s: string) => s !== "")
                                .length || 0}
                              /{form.qty || 0})
                            </button>
                            <SerialManager
                              isOpen={form.isSnOpen || false}
                              onClose={() =>
                                handleItemFormChange(
                                  item.po_item_id,
                                  "isSnOpen",
                                  false,
                                )
                              }
                              qty={Number(form.qty) || 0}
                              serials={
                                form.serials ||
                                Array(Number(form.qty) || 0).fill("")
                              }
                              mode="in"
                              productId={item.product_id}
                              onSerialsChange={(newSerials: string[]) =>
                                handleItemFormChange(
                                  item.po_item_id,
                                  "serials",
                                  newSerials,
                                )
                              }
                            />
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground text-xs bg-muted py-2.5 rounded-lg border border-border">
                            ไม่ต้องคุม Serial Number
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ส่วนหมายเหตุท้ายเอกสารใบรับของ */}
          <div className="p-4 bg-muted/30 border-t border-border">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              หมายเหตุท้ายเอกสารใบรับสินค้า
            </label>
            <textarea
              rows={2}
              placeholder="กรอกรายละเอียดเพิ่มเติมเกี่ยวกับการรับสินค้าในรอบนี้..."
              className="w-full p-3 border border-border rounded-xl outline-none focus:border-blue-500 text-sm bg-background"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* แถบปุ่มบันทึกใหญ่ด้านล่าง */}
          <div className="p-4 bg-muted/50 border-t border-border flex justify-end">
            <button
              onClick={handleSubmitGR}
              disabled={isSaving}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-green-600 hover:bg-green-700 shadow-sm shadow-green-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
            >
              <FileCheck className="w-5 h-5" />{" "}
              {isSaving
                ? "กำลังบันทึกเอกสาร..."
                : "บันทึกและออกใบรับของเข้าคลัง"}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-16 border-2 border-dashed border-border rounded-2xl text-center text-muted-foreground bg-muted/50">
          <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
          กรุณาเลือกเลขที่ใบสั่งซื้อ (PO) ด้านบน
          เพื่อดึงรายการข้อมูลสำหรับออกเอกสารรับของ
        </div>
      )}
    </div>
  );
}
