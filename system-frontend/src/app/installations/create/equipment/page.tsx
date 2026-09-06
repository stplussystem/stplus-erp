"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PackageSearch, ArrowLeft, Search, Save, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";

interface ProductRow {
  id: number;
  name: string;
  sku: string;
  price: number;
}

type CategoryFilter = "install" | "service";

export default function SelectInstallationEquipmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project_id");
  const saleDocumentItemId = searchParams.get("sale_document_item_id");

  const [category, setCategory] = useState<CategoryFilter>("install");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // 🚀 productId -> จำนวนที่เลือก (ไม่มี key ในนี้ = ยังไม่ได้เลือกสินค้านั้น)
  const [selected, setSelected] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!projectId) {
      toast.error("ต้องเข้าหน้านี้จากหน้าโครงการเท่านั้น");
      router.push("/projects");
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const params = new URLSearchParams({ type: category, per_page: "50" });
      if (search) params.set("search", search);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.data || []);
      }
    } catch (error) {
      toast.error("โหลดรายการสินค้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    if (!projectId) return;
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [projectId, fetchProducts]);

  const toggleSelect = (productId: number) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[productId] !== undefined) {
        delete next[productId];
      } else {
        next[productId] = "1";
      }
      return next;
    });
  };

  const setQty = (productId: number, qty: string) => {
    setSelected((prev) => ({ ...prev, [productId]: qty }));
  };

  const selectedCount = Object.keys(selected).length;

  const handleSave = async () => {
    if (selectedCount === 0) {
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
          items: Object.entries(selected).map(([productId, quantity]) => ({
            product_id: Number(productId),
            quantity: Number(quantity),
          })),
        }),
      });
      if (res.ok) {
        toast.success("บันทึกรายการอุปกรณ์สำเร็จ", { id: toastId });
        router.push(`/installations/create?project_id=${projectId}`);
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

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm">
            <PackageSearch className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">เลือกอุปกรณ์ที่นำไปติดตั้ง</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              บันทึกเป็นข้อมูลอ้างอิงสำหรับสรุปต้นทุน ไม่ตัดสต็อกจริง
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/installations/create?project_id=${projectId}`)}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between bg-slate-50/50">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCategory("install")}
              className={cn(
                "h-9 px-4 rounded-full text-sm font-bold border transition-all cursor-pointer",
                category === "install"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
              )}
            >
              ติดตั้ง
            </button>
            <button
              type="button"
              onClick={() => setCategory("service")}
              className={cn(
                "h-9 px-4 rounded-full text-sm font-bold border transition-all cursor-pointer",
                category === "service"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
              )}
            >
              บริการ
            </button>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ/รหัสสินค้า..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 h-10 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          {loading ? (
            <AppLoading minHeight="min-h-[200px]" />
          ) : products.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">ไม่พบสินค้าในหมวดนี้</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 w-12"></th>
                  <th className="px-6 py-3 font-bold">สินค้า</th>
                  <th className="px-6 py-3 font-bold text-right">ราคา</th>
                  <th className="px-6 py-3 font-bold w-32">จำนวน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const isSelected = selected[p.id] !== undefined;
                  return (
                    <tr
                      key={p.id}
                      className={cn("hover:bg-slate-50/80 transition-colors cursor-pointer", isSelected && "bg-blue-50/40")}
                      onClick={() => toggleSelect(p.id)}
                    >
                      <td className="px-6 py-3">
                        <div
                          className={cn(
                            "w-5 h-5 rounded-md border flex items-center justify-center",
                            isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300",
                          )}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <div className="font-bold text-slate-800">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.sku}</div>
                      </td>
                      <td className="px-6 py-3 text-right text-slate-600">
                        {Number(p.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          disabled={!isSelected}
                          className="w-full h-9 px-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm disabled:opacity-40 disabled:bg-slate-50"
                          value={selected[p.id] ?? "1"}
                          onChange={(e) => setQty(p.id, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/30">
          <div className="text-sm text-slate-500 font-medium">เลือกแล้ว {selectedCount} รายการ</div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push(`/installations/create?project_id=${projectId}`)}
              className="h-10 px-5 rounded-full font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || selectedCount === 0}
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
