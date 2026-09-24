"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  PackageCheck,
  Save,
  ArrowLeft,
  Loader2,
  ListOrdered,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import dayjs from "dayjs";
import { toast } from "sonner";
import { SerialPickerDialog } from "@/components/repairs/SerialPickerDialog";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";
import { usePermission } from "@/hooks/usePermission";

interface ReturnItem {
  product_id?: string;
  item_name?: string;
  product_name: string;
  sku: string;
  quantity: number;
  maxQuantity: number;
  unit_name: string;
  unit_price: number;
  has_serial_number: boolean;
  serials: string[];
}

export default function LoanReturnEditPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id;

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // ปุ่มอนุมัติสีเขียว — แสดงเฉพาะผู้ที่มีสิทธิ์ approve_loan_return และเอกสารยังเป็น Pending (หน้านี้ไม่ redirect ออกเมื่อสถานะไม่ใช่ Pending จึงต้องเก็บ docStatus)
  // ถ้ามีการแก้ไขที่ยังไม่บันทึก ปุ่มอนุมัติจะอัปเดตเอกสารให้ก่อน (บันทึกไม่สำเร็จ = ไม่อนุมัติ) — pattern เดียวกับ sales/receipts/[id]/edit
  const canApprove = usePermission("approve_loan_return");
  const [docStatus, setDocStatus] = useState("");
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");

  const [formData, setFormData] = useState({
    document_number: "",
    document_type: "loan_return",
    contact_id: "",
    reference_document_id: "",
    reference_document_number: "",
    issue_date: dayjs().format("YYYY-MM-DD"),
    note: "",
  });

  const [items, setItems] = useState<ReturnItem[]>([]);
  const [serialPickerIndex, setSerialPickerIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const userStr = getUserRaw();
    if (!userStr) {
      router.push("/");
      return;
    }
    try {
      const parsedData = JSON.parse(userStr);
      const actualUser = parsedData?.user || parsedData;
      const isPlatformAdmin =
        actualUser?.is_platform_admin === 1 || actualUser?.is_platform_admin === true;
      const roles = Array.isArray(actualUser?.roles) ? actualUser.roles : [];
      const perms = Array.isArray(actualUser?.permissions) ? actualUser.permissions : [];
      const isSuper = roles.some((role: any) =>
        typeof role === "string" ? role.includes("Super Admin") : role?.name?.includes("Super Admin"),
      );
      const hasPermission = perms.some((p: any) =>
        typeof p === "string" ? p === "edit_loan_return" : p?.name === "edit_loan_return",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        fetchDocumentData();
      } else {
        toast.error("คุณไม่มีสิทธิ์แก้ไขเอกสาร");
        router.push("/loans/returns");
      }
    } catch (e) {
      router.push("/");
    }
  }, [router, documentId]);

  const fetchDocumentData = async () => {
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/sale-documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });

      if (!res.ok) {
        toast.error("ไม่พบข้อมูลเอกสาร");
        router.push("/loans/returns");
        return;
      }
      const doc = (await res.json()).data;
      setDocStatus(doc.status || "");

      // 🎪 ดึงใบยืมสินค้าต้นทางมาด้วย เพื่อรู้จำนวนสูงสุดที่คืนได้ต่อสินค้า (กันคืนเกินจำนวนที่ยืมไป)
      let maxByProduct: Record<string, number> = {};
      if (doc.reference_document_id) {
        const refRes = await fetch(`${apiUrl}/sale-documents/${doc.reference_document_id}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (refRes.ok) {
          const refDoc = (await refRes.json()).data;
          (refDoc.items || []).forEach((it: any) => {
            maxByProduct[String(it.product_id)] = Number(it.quantity);
          });
        }
      }

      setFormData({
        document_number: doc.document_number,
        document_type: doc.document_type,
        contact_id: doc.contact_id?.toString() || "",
        reference_document_id: doc.reference_document_id ? String(doc.reference_document_id) : "",
        reference_document_number: doc.referenced_document?.document_number || "",
        issue_date: doc.issue_date ? dayjs(doc.issue_date).format("YYYY-MM-DD") : "",
        note: doc.note || "",
      });

      setItems(
        (doc.items || []).map((item: any) => ({
          product_id: item.product_id ? item.product_id.toString() : undefined,
          item_name: item.item_name || undefined,
          product_name: item.product?.name || item.item_name || "",
          sku: item.product?.sku || "",
          quantity: Number(item.quantity) || 1,
          maxQuantity: maxByProduct[String(item.product_id)] || Number(item.quantity) || 1,
          unit_name: item.unit_name || "ชิ้น",
          unit_price: 0,
          has_serial_number: !!item.product?.has_serial_number,
          serials: (item.serials || []).map((s: any) => s.serial_number),
        })),
      );
    } catch (error) {
      toast.error("ข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setFetching(false);
    }
  };

  const handleQuantityChange = (index: number, value: string) => {
    const newItems = [...items];
    let qty = Number(value) || 0;
    if (qty > newItems[index].maxQuantity) qty = newItems[index].maxQuantity;
    newItems[index] = { ...newItems[index], quantity: qty, serials: [] };
    setItems(newItems);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (items.some((i) => i.quantity <= 0)) newErrors.items = "จำนวนที่คืนต้องมากกว่า 0";
    if (items.some((i) => i.has_serial_number && i.serials.length !== i.quantity))
      newErrors.items = "กรุณาเลือก S/N ให้ครบตามจำนวนของสินค้าที่คุม S/N ทุกแถว";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // snapshot เฉพาะค่าที่ผู้ใช้แก้จริง (ไม่รวม maxQuantity/ชื่อสินค้า ที่เป็นค่าอ้างอิงตอนโหลด)
  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        formData,
        items: items.map((i) => [i.product_id ?? null, i.item_name ?? null, i.quantity, i.serials]),
      }),
    [formData, items],
  );
  const hasUnsavedChanges = savedSnapshot !== "" && savedSnapshot !== currentSnapshot;

  // เก็บสแนปช็อตตั้งต้นหลังโหลดเอกสารเสร็จ (รอให้ state ของฟอร์ม/รายการอัปเดตครบก่อน)
  useEffect(() => {
    if (!fetching && savedSnapshot === "") setSavedSnapshot(currentSnapshot);
  }, [fetching, savedSnapshot, currentSnapshot]);

  // บันทึกลง backend (validate + PUT) — คืน true เมื่อสำเร็จ ไม่ redirect (ผู้เรียกตัดสินใจเองว่าจะทำอะไรต่อ)
  const persist = async (): Promise<boolean> => {
    if (!validate()) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return false;
    }
    setLoading(true);
    const toastId = toast.loading("กำลังอัปเดตเอกสาร...");
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const payload = {
        contact_id: formData.contact_id || null,
        reference_document_id: formData.reference_document_id,
        issue_date: formData.issue_date,
        note: formData.note,
        tax_type: "none",
        grand_total: 0,
        items: items.map((item) => ({
          product_id: item.product_id || null,
          item_name: item.item_name || null,
          quantity: item.quantity,
          unit_name: item.unit_name,
          unit_price: item.unit_price,
          serials: item.serials,
        })),
      };
      const res = await fetch(`${apiUrl}/sale-documents/${documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error("อัปเดตไม่สำเร็จ", { id: toastId, description: (await res.json()).message });
        return false;
      }
      toast.success("อัปเดตเอกสารสำเร็จ!", { id: toastId });
      setSavedSnapshot(currentSnapshot);
      return true;
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (await persist()) router.push("/loans/returns");
  };

  const executeApprove = async () => {
    setIsApproving(true);
    try {
      if (hasUnsavedChanges && !(await persist())) {
        setIsApproveOpen(false);
        return;
      }
      const toastId = toast.loading("กำลังดำเนินการ...");
      try {
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
        const res = await fetch(`${apiUrl}/sale-documents/${documentId}/approve`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (!res.ok) {
          toast.error((await res.json()).message || "ไม่สามารถดำเนินการได้", { id: toastId });
          return;
        }
        toast.success("อนุมัติสำเร็จ", { id: toastId });
        setIsApproveOpen(false);
        router.push("/loans/returns");
      } catch (error) {
        toast.error("ข้อผิดพลาดระบบ", { id: toastId });
      }
    } finally {
      setIsApproving(false);
    }
  };

  if (!isAuthorized) return <AppLoading text="กำลังตรวจสอบสิทธิ์การเข้าใช้งาน..." variant="bar" minHeight="min-h-screen" className="bg-muted/50" />;
  if (fetching) return <AppLoading text="กำลังโหลดข้อมูลเอกสาร..." minHeight="min-h-screen" />;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 dark:border-amber-800/50 shadow-sm">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight flex items-center gap-2">
              แก้ไข <span className="text-amber-600">{formData.document_number}</span>
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">แก้ไขรายละเอียดใบคืนสินค้ายืม</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" /> ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={loading}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-amber-600 hover:bg-amber-800 shadow-sm shadow-amber-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} อัปเดตเอกสาร
          </button>
          {canApprove && docStatus === "Pending" && (
            <button
              type="button"
              onClick={() => setIsApproveOpen(true)}
              disabled={loading || isApproving}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-green-600 hover:bg-green-700 shadow-sm shadow-green-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" /> อนุมัติเอกสาร
            </button>
          )}
        </div>
      </div>

      <div className="bg-card p-6 rounded-2xl shadow-sm border border-border min-h-[500px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8 p-5 border border-border rounded-xl bg-muted/50">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">อ้างอิงใบยืมสินค้า</label>
            <div className="h-10 px-4 flex items-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
              {formData.reference_document_number || "-"}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่คืน</label>
            <AppDatePicker
              value={formData.issue_date}
              onChange={(v) => setFormData({ ...formData, issue_date: v })}
            />
          </div>
        </div>

        {errors.items && <p className="text-red-500 text-xs font-medium mb-2">{errors.items}</p>}
        <div className="border border-border rounded-2xl overflow-hidden mb-6 z-10 relative">
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-bold min-w-[280px]">ชื่อสินค้า</th>
                  <th className="px-4 py-3 w-32 text-center font-bold">จำนวนที่คืน</th>
                  <th className="px-4 py-3 w-24 text-center font-bold">หน่วย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, index) => (
                  <tr key={index} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{item.product_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {item.sku} · ยืมไป {item.maxQuantity} {item.unit_name}
                      </div>
                      {item.has_serial_number && (
                        <button
                          type="button"
                          onClick={() => setSerialPickerIndex(index)}
                          className={cn(
                            "mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all",
                            item.serials.length === item.quantity
                              ? "bg-green-50 text-green-600 hover:bg-green-100"
                              : "bg-amber-50 text-amber-600 hover:bg-amber-100",
                          )}
                        >
                          {item.serials.length === item.quantity ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          <ListOrdered className="w-3 h-3" /> S/N: {item.serials.length}/{item.quantity}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0.1"
                        max={item.maxQuantity}
                        step="1"
                        className="w-full h-10 text-center border border-border rounded-xl text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{item.unit_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-foreground mb-2">หมายเหตุ</label>
          <textarea
            rows={3}
            className="w-full p-4 rounded-2xl border border-border outline-none text-sm resize-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all bg-muted/50 focus:bg-background"
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          />
        </div>
      </div>

      <AppConfirmDialog
        open={isApproveOpen}
        onOpenChange={setIsApproveOpen}
        icon={CheckCircle2}
        iconColorClass="bg-amber-50 text-amber-600 border-amber-100/50"
        title="อนุมัติใบคืนสินค้ายืม?"
        description={
          <>
            ระบบจะปลดล็อกสินค้าให้ใช้งานได้ตามปกติทันทีเมื่ออนุมัติ ยืนยันการอนุมัติใบคืนสินค้ายืมฉบับนี้ใช่หรือไม่?
            {hasUnsavedChanges && (
              <span className="block mt-2 text-amber-600 font-medium">
                มีการแก้ไขที่ยังไม่ได้บันทึก — ระบบจะอัปเดตเอกสารให้ก่อนอนุมัติ
              </span>
            )}
          </>
        }
        confirmLabel={
          isApproving
            ? "กำลังดำเนินการ..."
            : hasUnsavedChanges
              ? "อัปเดตและอนุมัติ"
              : "อนุมัติเอกสาร"
        }
        confirmColorClass="bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
        onConfirm={executeApprove}
        loading={isApproving}
      />

      {serialPickerIndex !== null && (
        <SerialPickerDialog
          isOpen={serialPickerIndex !== null}
          onClose={() => setSerialPickerIndex(null)}
          productId={items[serialPickerIndex].product_id || ""}
          productName={items[serialPickerIndex].product_name}
          quantity={items[serialPickerIndex].quantity}
          value={items[serialPickerIndex].serials}
          fetchUrl={`${apiUrl}/sale-documents/${formData.reference_document_id}/rented-serials?product_id=${items[serialPickerIndex].product_id}`}
          onConfirm={(serials) => {
            const newItems = [...items];
            newItems[serialPickerIndex] = { ...newItems[serialPickerIndex], serials };
            setItems(newItems);
          }}
        />
      )}
    </div>
  );
}
