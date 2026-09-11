"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PackageSearch, ArrowLeft, Plus, Save, Loader2, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { ProductSearchDropdown } from "@/components/products/ProductSearchDropdown";

// 🚀 แถวที่ยังไม่บันทึก (state ในหน้านี้เท่านั้น) — เปลี่ยนจากเดิมที่เป็น checklist ผูก state ด้วย productId
// เป็น key เดียว (เลือกสินค้าเดียวกันซ้ำไม่ได้) มาเป็น array ของแถวอิสระแทน เพื่อให้สินค้าตัวเดียวกันแยกเป็น
// หลายแถวคนละห้อง/ตำแหน่งได้ในหน้าเดียว (เช่น สินค้า 5 ชุด แบ่งติด 3 ห้องประชุม A กับ 2 ห้องประชุม B)
interface EquipmentRow {
  key: number; // ใช้ผูก key ของ React เท่านั้น ไม่ส่งไป backend
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: string;
  location: string; // ห้อง/ตำแหน่งติดตั้ง — เว้นว่างได้
}

// รายการที่บันทึกไปแล้วของโครงการนี้ (ดึงจาก GET /projects/{id}/installation-equipment-items)
interface SavedEquipmentItem {
  id: number;
  product_id: number;
  quantity: string;
  location: string | null;
  unit_cost_snapshot: string | null;
  product: { id: number; name: string; sku: string } | null;
}

let rowKeySeq = 0;
const emptyRow = (): EquipmentRow => ({
  key: ++rowKeySeq,
  product_id: "",
  product_name: "",
  product_sku: "",
  quantity: "1",
  location: "",
});

export default function SelectInstallationEquipmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project_id");
  const saleDocumentItemId = searchParams.get("sale_document_item_id");

  const [rows, setRows] = useState<EquipmentRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);

  const [savedItems, setSavedItems] = useState<SavedEquipmentItem[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  useEffect(() => {
    if (!projectId) {
      toast.error("ต้องเข้าหน้านี้จากหน้าโครงการเท่านั้น");
      router.push("/projects");
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchSavedItems = useCallback(async () => {
    if (!projectId) return;
    setLoadingSaved(true);
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/installation-equipment-items`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
      );
      if (res.ok) {
        const data = await res.json();
        setSavedItems(data.data || []);
      }
    } catch (error) {
      toast.error("โหลดรายการที่บันทึกไว้แล้วไม่สำเร็จ");
    } finally {
      setLoadingSaved(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSavedItems();
  }, [fetchSavedItems]);

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (key: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));

  const updateRow = (key: number, patch: Partial<EquipmentRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const validRows = rows.filter((r) => r.product_id && Number(r.quantity) > 0);

  const handleSave = async () => {
    if (validRows.length === 0) {
      toast.error("กรุณาเลือกอุปกรณ์อย่างน้อย 1 รายการ");
      return;
    }
    setSaving(true);
    const toastId = toast.loading("กำลังบันทึกรายการอุปกรณ์...");
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/installation-equipment-items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          project_id: projectId,
          sale_document_item_id: saleDocumentItemId,
          items: validRows.map((r) => ({
            product_id: Number(r.product_id),
            quantity: Number(r.quantity),
            location: r.location.trim() || null,
          })),
        }),
      });
      if (res.ok) {
        toast.success("บันทึกรายการอุปกรณ์สำเร็จ", { id: toastId });
        setRows([emptyRow()]);
        fetchSavedItems();
      } else {
        const err = await res.json();
        toast.error("บันทึกไม่สำเร็จ", { id: toastId, description: err.message });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSaved = async (id: number) => {
    const toastId = toast.loading("กำลังลบรายการ...");
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/installation-equipment-items/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        toast.success("ลบรายการสำเร็จ", { id: toastId });
        setSavedItems((prev) => prev.filter((it) => it.id !== id));
      } else {
        toast.error("ลบไม่สำเร็จ", { id: toastId });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    }
  };

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm">
            <PackageSearch className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">เลือกอุปกรณ์ที่นำไปติดตั้ง</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              บันทึกเป็นข้อมูลอ้างอิงสำหรับสรุปต้นทุน ไม่ตัดสต็อกจริง — สินค้าชิ้นเดียวกันติดตั้งคนละห้องได้
              โดยเพิ่มหลายแถว
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/installations/create?project_id=${projectId}`)}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* รายการที่บันทึกไปแล้วของโครงการนี้ */}
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-6">
        <div className="p-4 border-b border-border bg-muted/50">
          <h2 className="font-bold text-sm text-foreground">รายการที่บันทึกไปแล้ว</h2>
        </div>
        {loadingSaved ? (
          <AppLoading minHeight="min-h-[100px]" />
        ) : savedItems.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">ยังไม่มีรายการอุปกรณ์ที่บันทึกไว้</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
              <tr>
                <th className="px-6 py-2.5 font-bold">สินค้า</th>
                <th className="px-6 py-2.5 font-bold w-28 text-right">จำนวน</th>
                <th className="px-6 py-2.5 font-bold w-56">ห้อง/ตำแหน่งติดตั้ง</th>
                <th className="px-6 py-2.5 font-bold w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {savedItems.map((it) => (
                <tr key={it.id}>
                  <td className="px-6 py-2.5">
                    <div className="font-bold text-foreground">{it.product?.name || "-"}</div>
                    <div className="text-xs text-muted-foreground">{it.product?.sku}</div>
                  </td>
                  <td className="px-6 py-2.5 text-right text-muted-foreground">{it.quantity}</td>
                  <td className="px-6 py-2.5 text-muted-foreground">
                    {it.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-violet-500" /> {it.location}
                      </span>
                    ) : (
                      <span className="italic">ไม่ระบุ</span>
                    )}
                  </td>
                  <td className="px-6 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteSaved(it.id)}
                      className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* เพิ่มรายการใหม่ */}
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50">
          <h2 className="font-bold text-sm text-foreground">เพิ่มรายการอุปกรณ์</h2>
        </div>

        <div className="divide-y divide-border">
          {rows.map((row) => (
            <div key={row.key} className="p-4 flex flex-col md:flex-row gap-3 items-start md:items-center">
              <div className="w-full md:flex-1">
                <ProductSearchDropdown
                  value={row.product_id}
                  selectedSku={row.product_sku}
                  selectedName={row.product_name}
                  typeFilter="install,service"
                  onChange={(productId, productData) =>
                    updateRow(row.key, {
                      product_id: productId,
                      product_name: productData.name,
                      product_sku: productData.sku,
                    })
                  }
                />
              </div>
              <input
                type="number"
                min="0.01"
                step="any"
                placeholder="จำนวน"
                className="w-full md:w-28 h-10 px-3 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                value={row.quantity}
                onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
              />
              <input
                type="text"
                placeholder="ห้อง/ตำแหน่งติดตั้ง (ถ้ามี)"
                className="w-full md:w-56 h-10 px-3 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                value={row.location}
                onChange={(e) => updateRow(row.key, { location: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length === 1}
                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-border">
          <button
            type="button"
            onClick={addRow}
            className="text-blue-600 text-sm font-bold flex items-center gap-1.5 hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> เพิ่มแถว
          </button>
        </div>

        <div className="p-4 border-t border-border flex justify-between items-center bg-muted/30">
          <div className="text-sm text-muted-foreground font-medium">เลือกแล้ว {validRows.length} รายการ</div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push(`/installations/create?project_id=${projectId}`)}
              className="h-10 px-5 rounded-full font-bold text-foreground bg-background border border-border hover:bg-muted/50 hover:border-border flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
            >
              เสร็จสิ้น
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || validRows.length === 0}
              className="bg-blue-600 hover:bg-blue-700 rounded-full h-10 px-6 gap-2 shadow-lg shadow-blue-600/20 text-white flex items-center justify-center font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
