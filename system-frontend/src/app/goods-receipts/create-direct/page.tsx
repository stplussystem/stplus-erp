"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  PackagePlus,
  ArrowLeft,
  Calendar,
  Layers,
  FileCheck,
  ScanLine,
  Loader2,
  Trash2,
  Plus,
} from "lucide-react";
import { AppSelect } from "@/components/ui/app-select";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { SerialManager } from "@/components/stock/SerialManager";
import { ProductSearchDropdown } from "@/components/products/ProductSearchDropdown";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";
import { cn } from "@/lib/utils";

export default function CreateDirectGoodsReceiptPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ข้อมูลจาก Database
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  // Form หัวเอกสาร
  const [formData, setFormData] = useState({
    warehouse_id: "",
    contact_id: "",
    reference_number: "",
    received_date: dayjs().format("YYYY-MM-DD"),
    note: "",
  });

  // รายการสินค้ารับเข้า
  const [items, setItems] = useState<any[]>([
    {
      product_id: "",
      product_name: "",
      sku: "",
      has_serial_number: false,
      quantity: 1,
      unit_price: 0,
      serials: [],
      isSnOpen: false,
    },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    checkPermissionAndLoadData();
  }, []);

  const checkPermissionAndLoadData = async () => {
    const storedUser = sessionStorage.getItem("system_user");
    if (!storedUser) {
      router.replace("/");
      return;
    }

    const parsedData = JSON.parse(storedUser);
    const user = parsedData.user;

    const isSuperAdmin =
      Array.isArray(user?.roles) &&
      user.roles.some((r: any) =>
        typeof r === "string"
          ? r.includes("Super Admin")
          : r?.name?.includes("Super Admin"),
      );

    const hasPermission =
      user?.is_platform_admin ||
      isSuperAdmin ||
      (Array.isArray(user?.permissions) &&
        user.permissions.some((p: any) =>
          typeof p === "string"
            ? p === "create_goods_receipt"
            : p?.name === "create_goods_receipt",
        ));

    if (!hasPermission) {
      toast.error("คุณไม่มีสิทธิ์เข้าถึงหน้ารับสินค้าเข้าคลังครับ");
      router.replace("/dashboard");
      return;
    }

    setIsAuthorized(true);

    try {
      const token = sessionStorage.getItem("system_token");
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };

      // 🚀 ยิง API โหลด Master Data ตัวหลักที่คลังใช้
      const [warehousesRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/warehouses`, { headers }),
      ]);

      // ดึงค่ามาแปลงเป็น JSON ทีละตัว ป้องกัน Error: body stream already read
      const warehousesJson = await warehousesRes.json();

      // 🚀 แกะกล่องข้อมูลแบบปลอดภัย (ดักจับทั้งกรณีมี .data และไม่มี)
      if (warehousesRes.ok) {
        setWarehouses(
          warehousesJson.data?.data ||
            warehousesJson.data ||
            warehousesJson ||
            [],
        );
      }
    } catch (error) {
      toast.error("ดึงข้อมูลคลังสินค้าจาก Database ไม่สำเร็จ");
      console.error(error); // เพื่อให้ดูใน Console ได้ด้วยว่าพังเพราะอะไร
    } finally {
      setLoadingMaster(false);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;

    if (field === "quantity") {
      const targetQty = Number(value) || 1;
      newItems[index].serials = (newItems[index].serials || []).slice(
        0,
        targetQty,
      );
    }
    setItems(newItems);
  };

  const handleSubmitDirectGR = async () => {
    // 1. ดักจับ Check SessionStorage ลื่นไหลปลอดภัย
    const token = sessionStorage.getItem("system_token");
    if (!token)
      return toast.error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง");

    const newErrors: Record<string, string> = {};
    if (!formData.warehouse_id)
      newErrors.warehouse_id = "กรุณาเลือกคลังสินค้าปลายทาง";
    if (!formData.contact_id)
      newErrors.contact_id = "กรุณาเลือกผู้จำหน่าย / ร้านค้าที่ซื้อสินค้า";
    if (items.some((i) => !i.product_id))
      newErrors.items = "กรุณาระบุสินค้าให้ครบถ้วนทุกแถว";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
    }
    setErrors({});

    try {
      // 2. วนลูปตรวจสอบ S/N และประกอบร่าง Payload ส่งไปหลังบ้าน
      const payloadItems = items.map((item, idx) => {
        const qty = Number(item.quantity) || 0;

        // 🚀 อ่านค่าความต้องการ S/N จากตัว item ในแถวตัวเองได้เลย ไม่ต้องพึ่งอาเรย์ products หลักแล้ว
        if (item.has_serial_number) {
          const serials = (item.serials || []).filter(
            (s: string) => s.trim() !== "",
          );

          if (serials.length !== qty) {
            throw new Error(
              `แถวที่ ${idx + 1}: สินค้า "${item.product_name}" ต้องกรอก S/N ให้ครบถ้วนตามจำนวน ${qty} ชิ้นครับ`,
            );
          }
          return {
            product_id: item.product_id,
            quantity: qty,
            unit_price: Number(item.unit_price) || 0,
            serials,
          };
        }

        return {
          product_id: item.product_id,
          quantity: qty,
          unit_price: Number(item.unit_price) || 0,
          serials: [],
        };
      });

      setIsSaving(true);
      const toastId = toast.loading("กำลังบันทึกนำสินค้าเข้าคลังด่วน...");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/direct-goods-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify({ ...formData, items: payloadItems }),
        },
      );

      if (!res.ok)
        throw new Error(
          (await res.json()).message || "บันทึกเอกสารสต๊อกไม่สำเร็จ",
        );

      const resJson = await res.json();
      toast.success(
        `สำเร็จ! ออกใบรับของด่วนเลขที่ ${resJson.gr_number} เรียบร้อยแล้ว`,
        { id: toastId },
      );
      router.push("/goods-receipts");
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการบันทึก", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthorized) return <div className="min-h-screen bg-slate-50"></div>;
  if (loadingMaster) {
    return (
      <div className="h-[60vh] flex flex-col text-sm items-center justify-center text-slate-500">
        <AppLoading />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 text-green-600 rounded-xl border border-green-100 dark:border-green-800/50 shadow-sm">
            <PackagePlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              รับสินค้าด่วนไม่มี PO (Direct Stock In)
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              ใช้สำหรับบันทึกรับของเร่งด่วน ซื้อเงินสดหน้าร้าน
              หรือสินค้าได้เปล่าเข้าคลังโดยตรง
            </p>
          </div>
        </div>
        <Link href="/goods-receipts">
          <button className="flex justify-center h-10 px-4 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform">
            <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
          </button>
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              คลังสินค้าที่จะนำเข้าเป้าหมาย *
            </label>
            <AppSelect
              value={formData.warehouse_id}
              onValueChange={(value) => {
                setFormData({
                  ...formData,
                  warehouse_id: value,
                });
                setErrors((prev) => ({
                  ...prev,
                  warehouse_id: "",
                }));
              }}
              error={!!errors.warehouse_id}
              placeholder="-- กรุณาระบุเลือกคลังสินค้า --"
              options={warehouses.map((w) => ({
                value: String(w.id),
                label: w.name,
              }))}
            />
            {errors.warehouse_id && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.warehouse_id}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              เลขอ้างอิง / บิลหน้าร้าน / ใบเสร็จด่วน
            </label>
            <div className="relative">
              <Layers className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="เช่น บิลเงินสดเล่มที่ 3, CASH-BUY-01"
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                value={formData.reference_number}
                onChange={(e) =>
                  setFormData({ ...formData, reference_number: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              วันที่รับสินค้าเข้าคลังจริง *
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <AppDatePicker
                value={formData.received_date}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    received_date: value,
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              เลือกผู้จำหน่าย / ร้านค้าที่ซื้อของด่วน *
            </label>
            <ContactSearchDropdown
              value={formData.contact_id}
              selectedName={
                selectedContact?.business_name || selectedContact?.contact_name
              }
              selectedCode={selectedContact?.contact_code}
              hasError={!!errors.contact_id}
              onChange={(contactId, contactData) => {
                setFormData({ ...formData, contact_id: contactId });
                setSelectedContact(contactData);
                setErrors((prev) => ({ ...prev, contact_id: "" }));
              }}
            />
            {errors.contact_id && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.contact_id}
              </p>
            )}
          </div>
          <div className="flex items-center text-xs text-slate-500 bg-slate-50 px-4 rounded-xl border border-slate-100 mt-5 md:mt-0">
            {selectedContact ? (
              <span>
                ที่อยู่ร้านค้า: {selectedContact.address} | เลขผู้เสียภาษี:{" "}
                {selectedContact.tax_id || "-"}
              </span>
            ) : (
              <span>
                ข้อมูลประวัติผู้ขายจะผูกแนบไปกับใบรับของชิ้นนี้เพื่อเก็บสถิติประวัติต้นทุนย้อนหลัง
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/60 font-bold text-slate-800">
          รายการสินค้าที่เปิดรับตรงเข้าสู่สต๊อกคลัง
        </div>
        {errors.items && (
          <p className="text-red-500 text-xs font-medium px-4 pt-3">
            {errors.items}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-white text-slate-500 text-xs uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5 text-center w-10">#</th>
                <th className="px-4 py-3.5">ชื่อสินค้า / รายละเอียดโมเดล</th>
                <th className="px-4 py-3.5 text-center w-28">จำนวนที่รับ</th>
                <th className="px-4 py-3.5 text-right w-36">
                  ราคาต้นทุนซื้อจริง/หน่วย
                </th>
                <th className="px-4 py-3.5 text-center w-60 bg-blue-50/20 text-blue-800 font-bold">
                  คุมชุด S/N สินค้า
                </th>
                <th className="px-4 py-3.5 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => {
                return (
                  <tr
                    key={index}
                    className="hover:bg-slate-50/40 transition-colors"
                  >
                    <td className="px-4 py-4 text-center text-slate-400">
                      {index + 1}
                    </td>

                    <td className="px-4 py-4">
                      <ProductSearchDropdown
                        value={item.product_id}
                        selectedSku={item.sku}
                        selectedName={item.product_name}
                        hasError={!!errors.items && !item.product_id}
                        onChange={(val, productData) => {
                          const newItems = [...items];
                          newItems[index] = {
                            ...newItems[index],
                            product_id: val,
                            product_name: productData.name,
                            sku: productData.sku,
                            has_serial_number: productData.has_serial_number,
                            serials: [], // เคลียร์ S/N ทิ้งถ้าเปลี่ยนสินค้า
                          };
                          setItems(newItems);
                          setErrors((prev) => ({ ...prev, items: "" }));
                        }}
                      />
                    </td>

                    <td className="px-4 py-4">
                      <input
                        type="number"
                        min="1"
                        className="w-full h-10 px-2 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-center font-bold outline-none"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(index, "quantity", e.target.value)
                        }
                      />
                    </td>

                    <td className="px-4 py-4">
                      <input
                        type="number"
                        min="0"
                        placeholder="0.00"
                        className="w-full h-10 px-3 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-right font-bold text-blue-600 bg-blue-50/10 outline-none"
                        value={item.unit_price || ""}
                        onChange={(e) =>
                          handleItemChange(index, "unit_price", e.target.value)
                        }
                      />
                    </td>

                    <td className="px-4 py-4 bg-blue-50/5">
                      {/* 🚀 เช็คจาก item.has_serial_number แทน productInfo */}
                      {item.has_serial_number ? (
                        <div className="flex flex-col items-center">
                          <button
                            type="button"
                            disabled={!item.product_id || !item.quantity}
                            onClick={() =>
                              handleItemChange(index, "isSnOpen", true)
                            }
                            className="h-9 px-4 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center justify-center gap-2 text-xs font-bold w-full shadow-sm"
                          >
                            <ScanLine className="w-4 h-4" /> สแกนระบุ S/N (
                            {item.serials?.filter((s: string) => s !== "")
                              .length || 0}
                            /{item.quantity || 0})
                          </button>
                          <SerialManager
                            isOpen={item.isSnOpen || false}
                            onClose={() =>
                              handleItemChange(index, "isSnOpen", false)
                            }
                            qty={Number(item.quantity) || 0}
                            serials={
                              item.serials ||
                              Array(Number(item.quantity) || 0).fill("")
                            }
                            mode="in"
                            productId={item.product_id}
                            onSerialsChange={(newSerials: string[]) =>
                              handleItemChange(index, "serials", newSerials)
                            }
                          />
                        </div>
                      ) : (
                        <div className="text-center text-slate-400 text-xs bg-slate-100/70 py-2 rounded-lg border border-slate-200">
                          สินค้าทั่วไป ไม่ต้องคุม Serial Number
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() =>
                          setItems(items.filter((_, i) => i !== index))
                        }
                        disabled={items.length === 1}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-40 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-2 border-t border-slate-100 bg-slate-50/60">
          <button
            onClick={() =>
              setItems([
                ...items,
                {
                  product_id: "",
                  quantity: 1,
                  unit_price: 0,
                  serials: [],
                  isSnOpen: false,
                },
              ])
            }
            className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:bg-blue-100 px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> เพิ่มบรรทัดรายการสินค้าเข้าคลัง
          </button>
        </div>

        <div className="p-4 bg-slate-50/40 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            บันทึกรายละเอียดเพิ่มเติมท้ายเอกสารด่วน
          </label>
          <textarea
            rows={2}
            placeholder="กรอกเหตุผลการจัดซื้อด่วน หรือระบุรายละเอียดบิลเงินสดเพิ่มเติม..."
            className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm bg-white resize-none"
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          />
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleSubmitDirectGR}
            disabled={isSaving}
            className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-green-600 hover:bg-green-700 shadow-sm shadow-green-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            <FileCheck className="w-5 h-5" />{" "}
            {isSaving
              ? "กำลังบันทึกข้อมูลเข้าคลัง..."
              : "ยืนยันนำสินค้าเข้าสต๊อก"}
          </button>
        </div>
      </div>
    </div>
  );
}
