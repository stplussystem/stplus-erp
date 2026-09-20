"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MapPin,
  ArrowLeft,
  Loader2,
  Wrench,
  PackageSearch,
  FileText,
  Building2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { Badge } from "@/components/ui/badge";

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
    contact?: { id: number; business_name?: string; contact_person_name?: string; address?: string };
  };
  available_serials: SerialOption[] | null;
  remaining_quantity: number | null;
}

// 🆕 [2026-09-17] เดิมมี 1 แถวต่อ 1 sale_document_item (เลือก S/N ได้ทีละตัว กดบันทึกทีละครั้ง) — เปลี่ยนเป็น
// array ของแถวย่อย เพื่อรองรับสินค้าคุม S/N ที่มีหลายชิ้น ขยาย/ย่อดูรายการ S/N แล้วเลือก S/N + ชั้น/ห้องอิสระต่อชิ้น
// (ยืนยันกับผู้ใช้แล้ว) ส่วนสินค้าไม่คุม S/N (นับจำนวนรวม) ยังคงมีแถวเดียวเหมือนเดิม ไม่มีการขยาย/ย่อ
interface UnitRowState {
  serialId: string;
  quantity: string;
  floor: string;
  room: string;
  warrantyMonths: string;
  notes: string;
  saving: boolean;
  error: boolean;
  errorMessage?: string;
}

const defaultUnitRow = (): UnitRowState => ({
  serialId: "",
  quantity: "1",
  floor: "",
  room: "",
  warrantyMonths: "",
  notes: "",
  saving: false,
  error: false,
});

export default function InstallationCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project_id");

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InstallableItem[]>([]);
  const [rows, setRows] = useState<Record<number, UnitRowState[]>>({});
  const [installationIssueCount, setInstallationIssueCount] = useState(0);
  // 🆕 [2026-09-18] สินค้าคุม S/N หลายชิ้น ย่อ/ขยายดูรายการ S/N ทีละชิ้น (ตามแพทเทิร์นเดียวกับหน้า stock-on-hand)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // 🚀 ข้อมูลสถานที่ กรอกครั้งเดียวใช้ร่วมกันทุกแถวตอนกด "บันทึก" (ต่างจากชั้น/ห้องที่กรอกแยกต่อแถว/ต่อชิ้น)
  const [siteName, setSiteName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");

  useEffect(() => {
    if (!projectId) {
      toast.error("ต้องเข้าหน้านี้จากหน้าโครงการเท่านั้น");
      router.push("/projects");
      return;
    }
    fetchInstallableItems();
    fetchInstallationIssueCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // จำนวนแถวย่อยต่อรายการ = จำนวนหน่วยที่ยังไม่ติดตั้ง (คุม S/N: 1 แถวต่อ 1 S/N ที่ยังว่าง, ไม่คุม S/N: 1 แถวคุมจำนวนรวม)
  const buildRowsForItem = (item: InstallableItem): UnitRowState[] => {
    const hasSerial = !!item.product.has_serial_number;
    const count = hasSerial ? item.available_serials?.length || 0 : 1;
    return Array.from({ length: count }, () => defaultUnitRow());
  };

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
            if (!next[item.id]) next[item.id] = buildRowsForItem(item);
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

  // 🚀 นับจำนวนใบเบิกวัสดุติดตั้งที่สร้างไว้แล้วของโครงการนี้ — แสดง badge รวมทั้งโครงการ (ใบเบิกวัสดุติดตั้งเป็น
  // เอกสารตัดสต๊อกจริงระดับโครงการ ไม่ผูกกับรายการค่าติดตั้งรายแถวเหมือนของเดิมอีกต่อไป)
  const fetchInstallationIssueCount = async () => {
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/sale-documents?type=installation_issue&project_id=${projectId}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
      );
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || [];
        setInstallationIssueCount(list.length);
      }
    } catch (error) {}
  };

  // 🆕 ลูกค้า/เลขที่ใบกำกับภาษีที่เกี่ยวข้องทั้งหมดของโครงการนี้ — แสดงไว้เป็นข้อมูลอ้างอิงเท่านั้น (ไม่ใช่ตัวกรอง
  // สินค้า) เผื่อโครงการมีหลายใบกำกับภาษี/เงินสด/ใบเสร็จที่อนุมัติแล้วปนกันอยู่ ให้เห็นชัดว่าดึงมาจากใบใดบ้าง
  const referencedDocs = useMemo(() => {
    const map = new Map<number, { document_number: string; contact_name: string }>();
    items.forEach((item) => {
      const doc = item.sale_document;
      if (doc?.id && !map.has(doc.id)) {
        map.set(doc.id, {
          document_number: doc.document_number,
          contact_name: doc.contact?.business_name || doc.contact?.contact_person_name || "-",
        });
      }
    });
    return Array.from(map.values());
  }, [items]);

  const toggleExpand = (itemId: number) => {
    setExpanded((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const updateUnitRow = (itemId: number, index: number, patch: Partial<UnitRowState>) => {
    setRows((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || []).map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));
  };

  const removeUnitRow = (itemId: number, index: number) => {
    setRows((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || []).filter((_, i) => i !== index),
    }));
  };

  const handleInstall = async (item: InstallableItem, rowIndex: number) => {
    const row = (rows[item.id] || [])[rowIndex];
    if (!row) return;
    const hasSerial = !!item.product.has_serial_number;

    if (hasSerial && !row.serialId) {
      updateUnitRow(item.id, rowIndex, { error: true, errorMessage: "กรุณาเลือก S/N ก่อนบันทึก" });
      return;
    }

    updateUnitRow(item.id, rowIndex, { saving: true, error: false, errorMessage: undefined });
    const toastId = toast.loading("กำลังบันทึกการติดตั้ง...");
    try {
      const token = getToken();
      const payload: Record<string, unknown> = {
        project_id: projectId,
        sale_document_item_id: item.id,
        site_name: siteName || null,
        site_address: siteAddress || null,
        floor: row.floor || null,
        room: row.room || null,
        install_notes: row.notes || null,
        warranty_months: row.warrantyMonths ? Number(row.warrantyMonths) : null,
        // 🚀 ปุ่ม "บันทึก" หมายถึงติดตั้งจริง ณ ตอนกด — ส่งวันนี้ไปเสมอให้ backend mark สถานะ 'installed' ทันที
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
        if (hasSerial) {
          // 🆕 ตัด S/N ที่เพิ่งติดตั้งออกจาก state ทันที + ลบเฉพาะแถวนี้ (ไม่ refetch ทั้งหน้า) เพื่อไม่ให้ค่าที่
          // กรอกไว้ในแถวอื่นที่ยังไม่กดบันทึกหายไปโดยไม่ตั้งใจ
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    available_serials: (it.available_serials || []).filter(
                      (s) => String(s.id) !== row.serialId,
                    ),
                  }
                : it,
            ),
          );
          removeUnitRow(item.id, rowIndex);
        } else {
          await fetchInstallableItems();
        }
      } else {
        const err = await res.json();
        updateUnitRow(item.id, rowIndex, {
          saving: false,
          error: true,
          errorMessage: err.message || "บันทึกไม่สำเร็จ",
        });
        toast.error("บันทึกไม่สำเร็จ", { id: toastId, description: err.message });
      }
    } catch (error) {
      updateUnitRow(item.id, rowIndex, {
        saving: false,
        error: true,
        errorMessage: "เกิดข้อผิดพลาดในการเชื่อมต่อ",
      });
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    }
  };

  const goCreateInstallationIssue = () => {
    router.push(`/sales/installation-issues/create?project_id=${projectId}`);
  };

  if (loading) {
    return <AppLoading minHeight="min-h-screen" />;
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
            <p className="text-muted-foreground text-[11px] mt-0.5">
              กดบันทึกทีละรายการ ระบุห้อง/จุดติดตั้งของแต่ละชิ้นได้อิสระ
            </p>
          </div>
        </div>
        <button
          onClick={() => router.back()}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-sm border border-border p-10 text-center text-muted-foreground">
          ไม่พบรายการที่ยังบันทึกการติดตั้งได้ในโครงการนี้
          <br />
          <span className="text-xs">(ต้องเป็นสินค้าที่ขายผ่านเอกสารที่อนุมัติแล้วเท่านั้น)</span>
        </div>
      ) : (
        <>
          {referencedDocs.length > 0 && (
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5 mb-5">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                อ้างอิงจากเอกสาร
              </h3>
              <div className="flex flex-wrap gap-3">
                {referencedDocs.map((d) => (
                  <div
                    key={d.document_number}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm"
                  >
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-bold text-foreground">{d.document_number}</span>
                    <span className="text-muted-foreground">•</span>
                    <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{d.contact_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card rounded-2xl shadow-sm border border-border p-5 mb-5">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              ข้อมูลสถานที่ (ใช้ร่วมกันทุกรายการ)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">ชื่อสถานที่</label>
                <input
                  type="text"
                  className="w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="เช่น สาขาสีลม, บ้านคุณสมชาย"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">ที่อยู่ติดตั้ง</label>
                <input
                  type="text"
                  className="w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                />
              </div>
            </div>
          </div>

          {equipmentItems.length > 0 && (
            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-5">
              <div className="p-4 border-b border-border bg-muted/50 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-foreground">อุปกรณ์ที่ต้องติดตั้ง</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                    <tr>
                      <th className="px-4 py-3 font-bold min-w-[200px]">สินค้า</th>
                      <th className="px-4 py-3 font-bold w-56">จำนวน / S-N</th>
                      <th className="px-4 py-3 font-bold w-24">ชั้น</th>
                      <th className="px-4 py-3 font-bold w-28">ห้อง</th>
                      <th className="px-4 py-3 font-bold w-28">ประกัน (เดือน)</th>
                      <th className="px-4 py-3 font-bold min-w-[160px]">หมายเหตุ</th>
                      <th className="px-4 py-3 font-bold w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {equipmentItems.map((item) => {
                      const hasSerial = !!item.product.has_serial_number;
                      const rowList = rows[item.id] || [];
                      if (rowList.length === 0) return null;

                      // 🚀 สินค้าไม่คุม S/N — แถวเดียวคุมจำนวนรวม ไม่มีการย่อ/ขยาย เหมือนเดิม
                      if (!hasSerial) {
                        const row = rowList[0];
                        return (
                          <tr key={item.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3 align-top">
                              <div className="font-bold text-foreground">{item.product.name}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {item.product.sku} • {item.sale_document.document_number}
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <input
                                type="number"
                                min="0.01"
                                max={item.remaining_quantity ?? undefined}
                                step="any"
                                className={`w-full h-10 px-3 rounded-xl border outline-none text-sm focus:ring-2 ${
                                  row.error
                                    ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                                    : "border-border focus:border-blue-500 focus:ring-blue-100"
                                }`}
                                value={row.quantity}
                                onChange={(e) =>
                                  updateUnitRow(item.id, 0, { quantity: e.target.value, error: false })
                                }
                              />
                              <div className="text-[10px] text-muted-foreground mt-1">
                                เหลือ {item.remaining_quantity}
                              </div>
                              {row.error && (
                                <p className="text-red-500 text-[10px] font-medium mt-1">
                                  {row.errorMessage || "บันทึกไม่สำเร็จ"}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <input
                                type="text"
                                className="w-full h-10 px-3 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                                value={row.floor}
                                onChange={(e) => updateUnitRow(item.id, 0, { floor: e.target.value })}
                                placeholder="เช่น 3"
                              />
                            </td>
                            <td className="px-4 py-3 align-top">
                              <input
                                type="text"
                                className="w-full h-10 px-3 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                                value={row.room}
                                onChange={(e) => updateUnitRow(item.id, 0, { room: e.target.value })}
                                placeholder="เช่น ห้องเซิร์ฟเวอร์"
                              />
                            </td>
                            <td className="px-4 py-3 align-top">
                              <input
                                type="number"
                                min="0"
                                className="w-full h-10 px-3 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                                value={row.warrantyMonths}
                                onChange={(e) => updateUnitRow(item.id, 0, { warrantyMonths: e.target.value })}
                              />
                            </td>
                            <td className="px-4 py-3 align-top">
                              <input
                                type="text"
                                className="w-full h-10 px-3 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                                value={row.notes}
                                onChange={(e) => updateUnitRow(item.id, 0, { notes: e.target.value })}
                              />
                            </td>
                            <td className="px-4 py-3 text-center align-top">
                              <button
                                type="button"
                                onClick={() => handleInstall(item, 0)}
                                disabled={row.saving}
                                className="h-9 px-4 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-all inline-flex items-center gap-1.5"
                              >
                                {row.saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                บันทึก
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      // 🆕 สินค้าคุม S/N — ย่อเป็นแถวสรุปเดียว กดเพื่อขยายดูรายการ S/N แต่ละชิ้นด้านล่าง
                      // (ตามแพทเทิร์นเดียวกับหน้า stock-on-hand) แต่ละแถว S/N มีปุ่ม "บันทึก" ของตัวเอง
                      const isOpen = !!expanded[item.id];
                      return (
                        <React.Fragment key={item.id}>
                          <tr
                            className="hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => toggleExpand(item.id)}
                          >
                            <td className="px-4 py-3 align-top">
                              <div className="flex items-start gap-2">
                                {isOpen ? (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                )}
                                <div>
                                  <div className="font-bold text-foreground">{item.product.name}</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {item.product.sku} • {item.sale_document.document_number}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-blue-600 hover:bg-blue-600 text-[10px]">คุม S/N</Badge>
                                <span className="text-sm text-foreground">เหลือ {rowList.length} ชิ้น</span>
                              </div>
                            </td>
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3" />
                          </tr>
                          {isOpen && (
                            <tr className="bg-muted/30">
                              <td colSpan={7} className="p-0">
                                <div className="px-4 py-3">
                                  <table className="w-full text-xs text-left">
                                    <thead className="text-muted-foreground">
                                      <tr>
                                        <th className="px-4 py-2 font-semibold w-56">S/N</th>
                                        <th className="px-4 py-2 font-semibold w-24">ชั้น</th>
                                        <th className="px-4 py-2 font-semibold w-28">ห้อง</th>
                                        <th className="px-4 py-2 font-semibold w-28">ประกัน (เดือน)</th>
                                        <th className="px-4 py-2 font-semibold min-w-[160px]">หมายเหตุ</th>
                                        <th className="px-4 py-2 font-semibold w-24"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                      {rowList.map((row, idx) => (
                                        <tr key={idx}>
                                          <td className="px-4 py-2 align-top">
                                            <AppSelect
                                              value={row.serialId}
                                              onValueChange={(v) =>
                                                updateUnitRow(item.id, idx, { serialId: v, error: false })
                                              }
                                              placeholder="-- เลือก S/N --"
                                              error={row.error}
                                              options={(item.available_serials || [])
                                                .filter(
                                                  (s) =>
                                                    String(s.id) === row.serialId ||
                                                    !rowList.some(
                                                      (r, i) => i !== idx && r.serialId === String(s.id),
                                                    ),
                                                )
                                                .map((s) => ({ value: String(s.id), label: s.serial_number }))}
                                            />
                                            {row.error && (
                                              <p className="text-red-500 text-[10px] font-medium mt-1">
                                                {row.errorMessage || "กรุณาเลือก S/N ก่อนบันทึก"}
                                              </p>
                                            )}
                                          </td>
                                          <td className="px-4 py-2 align-top">
                                            <input
                                              type="text"
                                              className="w-full h-9 px-3 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-xs bg-background"
                                              value={row.floor}
                                              onChange={(e) =>
                                                updateUnitRow(item.id, idx, { floor: e.target.value })
                                              }
                                              placeholder="เช่น 3"
                                            />
                                          </td>
                                          <td className="px-4 py-2 align-top">
                                            <input
                                              type="text"
                                              className="w-full h-9 px-3 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-xs bg-background"
                                              value={row.room}
                                              onChange={(e) =>
                                                updateUnitRow(item.id, idx, { room: e.target.value })
                                              }
                                              placeholder="เช่น ห้องเซิร์ฟเวอร์"
                                            />
                                          </td>
                                          <td className="px-4 py-2 align-top">
                                            <input
                                              type="number"
                                              min="0"
                                              className="w-full h-9 px-3 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-xs bg-background"
                                              value={row.warrantyMonths}
                                              onChange={(e) =>
                                                updateUnitRow(item.id, idx, { warrantyMonths: e.target.value })
                                              }
                                            />
                                          </td>
                                          <td className="px-4 py-2 align-top">
                                            <input
                                              type="text"
                                              className="w-full h-9 px-3 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-xs bg-background"
                                              value={row.notes}
                                              onChange={(e) =>
                                                updateUnitRow(item.id, idx, { notes: e.target.value })
                                              }
                                            />
                                          </td>
                                          <td className="px-4 py-2 text-center align-top">
                                            <button
                                              type="button"
                                              onClick={() => handleInstall(item, idx)}
                                              disabled={row.saving}
                                              className="h-8 px-4 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-all inline-flex items-center gap-1.5"
                                            >
                                              {row.saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                              บันทึก
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {serviceItems.length > 0 && (
            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PackageSearch className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-foreground">ค่าติดตั้ง (บริการ)</h3>
                </div>
                <button
                  type="button"
                  onClick={goCreateInstallationIssue}
                  className="h-9 px-4 rounded-full text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <PackageSearch className="w-3.5 h-3.5" />
                  บันทึกวัสดุ/บริการที่เบิกไปติดตั้ง
                  {installationIssueCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px]">
                      {installationIssueCount}
                    </span>
                  )}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                    <tr>
                      <th className="px-4 py-3 font-bold">รายการ</th>
                      <th className="px-4 py-3 font-bold text-right w-40">ยอดเงิน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {serviceItems.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-foreground">{item.product.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {item.sale_document.document_number}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600">
                          {Number(item.total_price || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
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
