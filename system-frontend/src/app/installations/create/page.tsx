"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, ArrowLeft, CheckCircle2, Loader2, Wrench, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { AppTooltip } from "@/components/ui/app-tooltip";

interface SerialOption {
  id: number;
  serial_number: string;
  status: string;
}

interface InstallableItem {
  id: number;
  item_type: "equipment" | "service";
  quantity: string;
  total_price?: string;
  product: {
    id: number;
    name: string;
    sku: string;
    has_serial_number: number | boolean;
  };
  sale_document: {
    id: number;
    document_number: string;
    contact?: { id: number; business_name?: string; address?: string };
  };
  available_serials: SerialOption[] | null;
  remaining_quantity: number | null;
}

interface RowState {
  serialId: string;
  quantity: string;
  roomLocation: string;
  warrantyMonths: string;
  notes: string;
  saving: boolean;
}

const defaultRowState = (): RowState => ({
  serialId: "",
  quantity: "1",
  roomLocation: "",
  warrantyMonths: "",
  notes: "",
  saving: false,
});

export default function InstallationCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project_id");

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InstallableItem[]>([]);
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [equipmentCounts, setEquipmentCounts] = useState<Record<number, number>>({});

  // 🚀 ข้อมูลสถานที่ กรอกครั้งเดียวใช้ร่วมกันทุกแถวตอนกด "ติดตั้ง" (ต่างจาก room_location ที่กรอกแยกต่อแถว)
  const [siteName, setSiteName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");

  useEffect(() => {
    if (!projectId) {
      toast.error("ต้องเข้าหน้านี้จากหน้าโครงการเท่านั้น");
      router.push("/projects");
      return;
    }
    fetchInstallableItems();
    fetchEquipmentCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchInstallableItems = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/installable-items`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
      );
      if (res.ok) {
        const data = await res.json();
        const list: InstallableItem[] = data.data || [];
        setItems(list);
        setRows((prev) => {
          const next = { ...prev };
          list.forEach((item) => {
            if (!next[item.id]) next[item.id] = defaultRowState();
          });
          return next;
        });
        if (list.length > 0 && siteAddress === "") {
          const firstWithAddress = list.find((i) => i.sale_document?.contact?.address);
          if (firstWithAddress) setSiteAddress(firstWithAddress.sale_document.contact!.address || "");
        }
      }
    } catch (error) {
      toast.error("โหลดรายการสินค้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  // 🚀 นับจำนวนอุปกรณ์ที่เลือกไว้แล้วต่อแถว "ค่าติดตั้ง" — แสดง badge ให้เห็นว่าเลือกไปแล้วกี่รายการ
  const fetchEquipmentCounts = async () => {
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/installation-equipment-items`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
      );
      if (res.ok) {
        const data = await res.json();
        const counts: Record<number, number> = {};
        (data.data || []).forEach((eq: any) => {
          if (eq.sale_document_item_id) {
            counts[eq.sale_document_item_id] = (counts[eq.sale_document_item_id] || 0) + 1;
          }
        });
        setEquipmentCounts(counts);
      }
    } catch (error) {}
  };

  const updateRow = (itemId: number, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  };

  const handleInstall = async (item: InstallableItem) => {
    const row = rows[item.id] || defaultRowState();
    const hasSerial = !!item.product.has_serial_number;

    if (hasSerial && !row.serialId) {
      toast.error("กรุณาเลือก Serial Number ที่ติดตั้ง");
      return;
    }

    setRows((prev) => ({ ...prev, [item.id]: { ...prev[item.id], saving: true } }));
    const toastId = toast.loading("กำลังบันทึกการติดตั้ง...");
    try {
      const token = getToken();
      const payload: Record<string, unknown> = {
        project_id: projectId,
        sale_document_item_id: item.id,
        site_name: siteName || null,
        site_address: siteAddress || null,
        room_location: row.roomLocation || null,
        install_notes: row.notes || null,
        warranty_months: row.warrantyMonths ? Number(row.warrantyMonths) : null,
        // 🚀 ปุ่ม "ติดตั้ง" หมายถึงติดตั้งจริง ณ ตอนกด — ส่งวันนี้ไปเสมอให้ backend mark สถานะ 'installed' ทันที
        installed_at: new Date().toISOString().slice(0, 10),
      };
      if (hasSerial) {
        payload.product_serial_id = row.serialId;
      } else {
        payload.quantity = Number(row.quantity);
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/installations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(`บันทึกการติดตั้ง "${item.product.name}" สำเร็จ`, { id: toastId });
        await fetchInstallableItems();
      } else {
        const err = await res.json();
        toast.error("บันทึกไม่สำเร็จ", { id: toastId, description: err.message });
        setRows((prev) => ({ ...prev, [item.id]: { ...prev[item.id], saving: false } }));
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
      setRows((prev) => ({ ...prev, [item.id]: { ...prev[item.id], saving: false } }));
    }
  };

  const goSelectEquipment = (item: InstallableItem) => {
    router.push(
      `/installations/create/equipment?project_id=${projectId}&sale_document_item_id=${item.id}`,
    );
  };

  if (loading) {
    return <AppLoading />;
  }

  const equipmentItems = items.filter((i) => i.item_type === "equipment");
  const serviceItems = items.filter((i) => i.item_type === "service");

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">บันทึกการติดตั้ง</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              กดติดตั้งทีละรายการ ระบุห้อง/จุดติดตั้งของแต่ละชิ้นได้อิสระ
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 text-center text-slate-400">
          ไม่พบรายการที่ยังบันทึกการติดตั้งได้ในโครงการนี้
          <br />
          <span className="text-xs">
            (ต้องเป็นสินค้าที่ตั้งค่า "งานติดตั้ง" หรือ "บริการ" และขายผ่านเอกสารที่อนุมัติแล้ว)
          </span>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              ข้อมูลสถานที่ (ใช้ร่วมกันทุกรายการ)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">ชื่อสถานที่</label>
                <input
                  type="text"
                  className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="เช่น สาขาสีลม, บ้านคุณสมชาย"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">ที่อยู่ติดตั้ง</label>
                <input
                  type="text"
                  className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                />
              </div>
            </div>
          </div>

          {equipmentItems.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-5">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-800">อุปกรณ์ที่ต้องติดตั้ง</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-bold min-w-[200px]">สินค้า</th>
                      <th className="px-4 py-3 font-bold w-56">จำนวน / S-N</th>
                      <th className="px-4 py-3 font-bold w-48">ห้อง/จุดติดตั้ง</th>
                      <th className="px-4 py-3 font-bold w-28">ประกัน (เดือน)</th>
                      <th className="px-4 py-3 font-bold min-w-[160px]">หมายเหตุ</th>
                      <th className="px-4 py-3 font-bold w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {equipmentItems.map((item) => {
                      const row = rows[item.id] || defaultRowState();
                      const hasSerial = !!item.product.has_serial_number;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-800">{item.product.name}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {item.product.sku} • {item.sale_document.document_number}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {hasSerial ? (
                              <AppSelect
                                value={row.serialId}
                                onValueChange={(v) => updateRow(item.id, { serialId: v })}
                                placeholder="-- เลือก S/N --"
                                options={(item.available_serials || []).map((s) => ({
                                  value: String(s.id),
                                  label: s.serial_number,
                                }))}
                              />
                            ) : (
                              <input
                                type="number"
                                min="0.01"
                                max={item.remaining_quantity ?? undefined}
                                step="any"
                                className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                                value={row.quantity}
                                onChange={(e) => updateRow(item.id, { quantity: e.target.value })}
                              />
                            )}
                            {!hasSerial && (
                              <div className="text-[10px] text-slate-400 mt-1">
                                เหลือ {item.remaining_quantity}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                              value={row.roomLocation}
                              onChange={(e) => updateRow(item.id, { roomLocation: e.target.value })}
                              placeholder="เช่น ชั้น 3 ห้องเซิร์ฟเวอร์"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                              value={row.warrantyMonths}
                              onChange={(e) => updateRow(item.id, { warrantyMonths: e.target.value })}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                              value={row.notes}
                              onChange={(e) => updateRow(item.id, { notes: e.target.value })}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <AppTooltip label="ติดตั้ง">
                              <button
                                type="button"
                                onClick={() => handleInstall(item)}
                                disabled={row.saving}
                                className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {row.saving ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                              </button>
                            </AppTooltip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {serviceItems.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <PackageSearch className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-800">ค่าติดตั้ง (บริการ)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-bold">รายการ</th>
                      <th className="px-4 py-3 font-bold text-right w-40">ยอดเงิน</th>
                      <th className="px-4 py-3 font-bold text-center w-64">อุปกรณ์ที่นำไปติดตั้ง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {serviceItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{item.product.name}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {item.sale_document.document_number}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600">
                          {Number(item.total_price || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => goSelectEquipment(item)}
                            className="h-9 px-4 rounded-full text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer transition-all mx-auto"
                          >
                            <PackageSearch className="w-3.5 h-3.5" />
                            เลือกอุปกรณ์ที่นำไปติดตั้ง
                            {equipmentCounts[item.id] > 0 && (
                              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px]">
                                {equipmentCounts[item.id]}
                              </span>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
