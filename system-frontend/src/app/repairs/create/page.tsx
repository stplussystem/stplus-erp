"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wrench,
  ArrowLeft,
  Save,
  Loader2,
  Search,
  CheckCircle2,
  AlertTriangle,
  ScanLine,
  FileSearch,
  PackageOpen,
  Camera,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import dayjs from "dayjs";
import { getToken } from "@/lib/auth-storage";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { ProductSearchDropdown } from "@/components/products/ProductSearchDropdown";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";

interface SerialCheckResult {
  exists: boolean;
  id?: number;
  status?: string;
  product_id?: number;
  sold_at?: string;
  sold_to_sale_document_id?: number;
  sold_document_number?: string;
  contact_id?: number;
  contact_name?: string;
  project_id?: number;
}

interface SaleDocLookupRow {
  id: number;
  document_number: string;
  document_type: string;
  contact_id: number;
  project_id: number | null;
  issue_date: string | null;
  contact?: { name?: string; business_name?: string };
}

interface SaleDocItem {
  id: number;
  product_id: number;
  quantity: string;
  product: { id: number; name: string; sku: string };
}

const MAX_PHOTOS = 4;
const MAX_PHOTO_SIZE = 1024 * 1024; // 1MB

export default function RepairCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillProjectId = searchParams.get("project_id");
  const [mode, setMode] = useState<"serial" | "document" | "external">(
    "serial",
  );
  const [saving, setSaving] = useState(false);

  // 🚀 เชื่อมกับโครงการอัตโนมัติเมื่อมาจากปุ่ม "สร้างใหม่" ในหน้า Project Hub (?project_id=) — ฟอร์มนี้ไม่มีช่องเลือกโครงการเอง
  // (ผูกผ่าน S/N หรือเอกสารขายอ้างอิงแทน) จึงแค่แนบ project_id ไปกับการบันทึกเงียบๆ พร้อมโชว์ชื่อโครงการให้เห็นว่าเชื่อมอยู่
  const [prefillProjectName, setPrefillProjectName] = useState("");

  // โหมดมี S/N
  const [snInput, setSnInput] = useState("");
  const [snChecking, setSnChecking] = useState(false);
  const [snResult, setSnResult] = useState<SerialCheckResult | null>(null);

  // โหมดไม่มี S/N — ค้นเอกสารขายเดิม
  const [docQuery, setDocQuery] = useState("");
  const [docSearching, setDocSearching] = useState(false);
  const [docSearchAttempted, setDocSearchAttempted] = useState(false); // แยก "ยังไม่ค้น" กับ "ค้นแล้วไม่เจอ"
  const [docResults, setDocResults] = useState<SaleDocLookupRow[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<SaleDocLookupRow | null>(null);
  const [docItems, setDocItems] = useState<SaleDocItem[]>([]);
  const [selectedItemProductId, setSelectedItemProductId] = useState("");

  // โหมดอุปกรณ์ลูกค้า (ไม่ได้ซื้อผ่านระบบ)
  const [externalProductId, setExternalProductId] = useState("");
  const [externalProductSku, setExternalProductSku] = useState("");
  const [externalProductName, setExternalProductName] = useState("");
  const [manualSerialNumber, setManualSerialNumber] = useState("");

  // ผู้ติดต่อ/ร้านที่ส่งซ่อม — แก้ไขได้ทุกโหมด
  const [contactId, setContactId] = useState("");
  const [selectedContactName, setSelectedContactName] = useState("");
  const [selectedContactCode, setSelectedContactCode] = useState("");

  // เพิ่มผู้ติดต่อใหม่แบบเร็ว (Quick Add) — สำหรับลูกค้า walk-in ที่ไม่เคยมีในระบบ
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [addingContactLoading, setAddingContactLoading] = useState(false);

  // วันที่รับเครื่อง — ค่าเริ่มต้นวันนี้ แก้ไขได้ (เผื่อบันทึกย้อนหลัง)
  const [receivedAt, setReceivedAt] = useState(() =>
    dayjs().format("YYYY-MM-DD"),
  );

  // ข้อความ error รายฟิลด์ — ตาม convention กรอบแดง + ข้อความใต้ช่องของระบบ
  const [errors, setErrors] = useState<Record<string, string>>({});

  // รูปภาพประกอบ (ไม่บังคับ สูงสุด 4 รูป ไม่เกิน 1MB/รูป)
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [reportedIssue, setReportedIssue] = useState("");
  const [isUnderWarranty, setIsUnderWarranty] = useState(false);

  // auto-derive ผู้ติดต่อจากผลเช็ค S/N — ผู้ใช้แก้ไขทับได้ภายหลัง
  useEffect(() => {
    if (snResult?.exists) {
      setContactId(snResult.contact_id ? String(snResult.contact_id) : "");
      setSelectedContactName(snResult.contact_name || "");
      setSelectedContactCode("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snResult]);

  // auto-derive ผู้ติดต่อจากเอกสารขายที่เลือก — ผู้ใช้แก้ไขทับได้ภายหลัง
  useEffect(() => {
    if (selectedDoc) {
      setContactId(String(selectedDoc.contact_id));
      setSelectedContactName(
        selectedDoc.contact?.business_name || selectedDoc.contact?.name || "",
      );
      setSelectedContactCode("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoc]);

  // รีเซ็ตสถานะ "ค้นเอกสารแล้ว" ทุกครั้งที่สลับโหมด (มีความหมายเฉพาะตอนอยู่โหมดเอกสารเท่านั้น)
  useEffect(() => {
    setDocSearchAttempted(false);
  }, [mode]);

  // โหลดชื่อโครงการมาโชว์เฉยๆ เมื่อมาจากปุ่ม "สร้างใหม่" ในหน้า Project Hub
  useEffect(() => {
    if (!prefillProjectId) return;
    const token = getToken();
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${prefillProjectId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
      .then((r) => r.json())
      .then((d) => setPrefillProjectName((d.data || d)?.name || ""))
      .catch(() => {});
  }, [prefillProjectId]);

  // สลับเข้าโหมด "อุปกรณ์ลูกค้า" เมื่อเช็ค S/N หรือค้นเอกสารไม่พบข้อมูลในระบบ — โอนค่า S/N ที่พิมพ์ไว้ (ถ้ามี) ไปด้วย
  const useAsExternal = (carrySerial?: string) => {
    setMode("external");
    if (carrySerial) setManualSerialNumber(carrySerial);
  };

  const checkSerial = async () => {
    if (!snInput.trim()) return;
    setSnChecking(true);
    setSnResult(null);
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/product-serials/check?sn=${encodeURIComponent(snInput.trim())}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setSnResult(data);
        if (!data.exists) toast.error("ไม่พบ S/N นี้ในระบบ");
      }
    } catch (error) {
      toast.error("เช็ค S/N ไม่สำเร็จ");
    } finally {
      setSnChecking(false);
    }
  };

  const searchDocuments = async () => {
    if (!docQuery.trim()) return;
    setDocSearching(true);
    setDocSearchAttempted(false);
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/sale-documents/lookup?q=${encodeURIComponent(docQuery.trim())}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setDocResults(data.data || []);
      }
      setDocSearchAttempted(true);
    } catch (error) {
      toast.error("ค้นหาเอกสารไม่สำเร็จ");
    } finally {
      setDocSearching(false);
    }
  };

  const selectDocument = async (doc: SaleDocLookupRow) => {
    setSelectedDoc(doc);
    setDocResults([]);
    setSelectedItemProductId("");
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/sale-documents/${doc.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setDocItems((data.data || data).items || []);
      }
    } catch (error) {
      toast.error("โหลดรายการสินค้าในเอกสารไม่สำเร็จ");
    }
  };

  const handleAddContact = async () => {
    const name = newContactName.trim();
    if (!name) return;
    setAddingContactLoading(true);
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contacts/quick-create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ business_name: name }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "เพิ่มผู้ติดต่อไม่สำเร็จ");
      setContactId(String(data.data.id));
      setSelectedContactName(data.data.business_name || "");
      setSelectedContactCode(data.data.contact_code || "");
      setErrors((prev) => ({ ...prev, contact_id: "" }));
      setNewContactName("");
      setIsAddingContact(false);
      toast.success("เพิ่มผู้ติดต่อสำเร็จ");
    } catch (error: any) {
      toast.error(error.message || "เพิ่มผู้ติดต่อไม่สำเร็จ");
    } finally {
      setAddingContactLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const accepted: File[] = [];
    for (const file of files) {
      if (photoFiles.length + accepted.length >= MAX_PHOTOS) {
        toast.error(`แนบรูปได้สูงสุด ${MAX_PHOTOS} รูป`);
        break;
      }
      if (file.size > MAX_PHOTO_SIZE) {
        toast.error(`ไฟล์ "${file.name}" มีขนาดใหญ่เกินไป`, {
          description: "กรุณาอัปโหลดไฟล์ขนาดไม่เกิน 1MB ครับ",
        });
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length > 0) {
      setPhotoFiles((prev) => [...prev, ...accepted]);
      setPhotoPreviews((prev) => [
        ...prev,
        ...accepted.map((f) => URL.createObjectURL(f)),
      ]);
    }
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (mode === "document" && selectedDoc && !selectedItemProductId) {
      newErrors.selectedItemProductId =
        "กรุณาเลือกสินค้าที่ต้องการแจ้งซ่อมจากเอกสาร";
    }
    if (mode === "external" && !externalProductId) {
      newErrors.externalProductId = "กรุณาเลือกสินค้าจากแคตตาล็อกก่อน";
    }
    if (!contactId) {
      newErrors.contact_id = "กรุณาเลือกผู้ติดต่อ/ร้านที่ส่งซ่อม";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    // เช็คเงื่อนไขที่ไม่มี input เดี่ยวให้ผูกกรอบแดง (compound state) ก่อน — คง toast-only ตามเดิม
    if (
      mode === "serial" &&
      (!snResult?.exists || !snResult.product_id || !snResult.id)
    ) {
      toast.error("กรุณาเช็ค S/N ที่ถูกต้องก่อน");
      return;
    }
    if (mode === "document" && !selectedDoc) {
      toast.error("กรุณาเลือกเอกสารขายอ้างอิงก่อน");
      return;
    }

    if (!validateForm()) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    const formData = new FormData();

    if (mode === "serial") {
      formData.append("product_id", String(snResult!.product_id));
      formData.append("product_serial_id", String(snResult!.id));
    } else if (mode === "document") {
      formData.append("product_id", selectedItemProductId);
      formData.append("reference_sale_document_id", String(selectedDoc!.id));
    } else {
      formData.append("product_id", externalProductId);
      formData.append("is_external", "1");
      if (manualSerialNumber.trim()) {
        formData.append("manual_serial_number", manualSerialNumber.trim());
      }
    }

    formData.append("contact_id", contactId);
    if (prefillProjectId) formData.append("project_id", prefillProjectId);
    formData.append("reported_issue", reportedIssue || "");
    formData.append("is_under_warranty", isUnderWarranty ? "1" : "0");
    formData.append("received_at", receivedAt);
    photoFiles.forEach((file) => formData.append("photos[]", file));

    setSaving(true);
    const toastId = toast.loading("กำลังบันทึกรับแจ้งซ่อม...");
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/repairs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("บันทึกรับแจ้งซ่อมสำเร็จ", { id: toastId });
        router.push(`/repairs/${data.data.id}`);
      } else {
        const err = await res.json();
        toast.error("บันทึกไม่สำเร็จ", {
          id: toastId,
          description: err.message,
        });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รับแจ้งซ่อม</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              ระบุสินค้าที่ลูกค้าส่งมาซ่อม เพื่อผูกกับประวัติการขายเดิม
              {prefillProjectId && (
                <span className="ml-2 text-blue-500 font-medium">
                  • เชื่อมกับโครงการ: {prefillProjectName || `#${prefillProjectId}`}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/repairs")}
          className="h-10 px-5 rounded-full font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-300 flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all hover:border-slate-400"
        >
          <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setMode("serial")}
            className={`h-11 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mode === "serial"
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <ScanLine className="w-4 h-4" /> สินค้ามี S/N
          </button>
          <button
            type="button"
            onClick={() => setMode("document")}
            className={`h-11 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mode === "document"
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <FileSearch className="w-4 h-4" /> สินค้าไม่มี S/N
          </button>
          <button
            type="button"
            onClick={() => setMode("external")}
            className={`h-11 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mode === "external"
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <PackageOpen className="w-4 h-4" /> ไม่มีในระบบที่จำหน่าย
          </button>
        </div>

        {mode === "serial" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Serial Number ที่ลูกค้าส่งมาซ่อม
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-mono"
                placeholder="พิมพ์หรือสแกน S/N..."
                value={snInput}
                onChange={(e) => setSnInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && checkSerial()}
              />
              <button
                type="button"
                onClick={checkSerial}
                disabled={snChecking}
                className="h-10 px-4 rounded-xl bg-slate-800 text-white text-sm font-bold flex items-center gap-2 cursor-pointer hover:bg-slate-900 transition-all disabled:opacity-50"
              >
                {snChecking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                เช็ค
              </button>
            </div>

            {snResult && snResult.exists && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-sm space-y-1">
                <div className="flex items-center gap-2 text-green-700 font-bold">
                  <CheckCircle2 className="w-4 h-4" /> พบ S/N ในระบบ
                </div>
                <div className="text-slate-600">สถานะ: {snResult.status}</div>
                {snResult.sold_document_number && (
                  <div className="text-slate-600">
                    ขายไปตามเอกสาร: <b>{snResult.sold_document_number}</b> เมื่อ{" "}
                    {snResult.sold_at
                      ? new Date(snResult.sold_at).toLocaleDateString("th-TH")
                      : "-"}
                  </div>
                )}
                {!snResult.sold_to_sale_document_id && (
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="w-3.5 h-3.5" /> ไม่พบประวัติการขาย
                    — เลือกผู้ติดต่อเองด้านล่าง
                  </div>
                )}
              </div>
            )}
            {snResult && !snResult.exists && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> ไม่พบ S/N นี้ในระบบ
                </div>
                <button
                  type="button"
                  onClick={() => useAsExternal(snInput.trim())}
                  className="text-xs font-bold text-red-700 underline hover:text-red-900 cursor-pointer"
                >
                  ใช้ข้อมูลนี้แบบอุปกรณ์ลูกค้า (ไม่ผูกประวัติการขาย)
                </button>
              </div>
            )}
          </div>
        )}

        {mode === "document" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              ค้นหาเอกสารขายเดิม (เลขที่เอกสาร หรือ ชื่อลูกค้า)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                placeholder="เช่น INV-2608-0001 หรือ ชื่อลูกค้า..."
                value={docQuery}
                onChange={(e) => {
                  setDocQuery(e.target.value);
                  setDocSearchAttempted(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && searchDocuments()}
              />
              <button
                type="button"
                onClick={searchDocuments}
                disabled={docSearching}
                className="h-10 px-4 rounded-xl bg-slate-800 text-white text-sm font-bold flex items-center gap-2 cursor-pointer hover:bg-slate-900 transition-all disabled:opacity-50"
              >
                {docSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                ค้นหา
              </button>
            </div>

            {docResults.length > 0 && (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {docResults.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => selectDocument(doc)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-all cursor-pointer flex justify-between items-center text-sm"
                  >
                    <span className="font-bold text-slate-800">
                      {doc.document_number}
                    </span>
                    <span className="text-slate-500">
                      {doc.contact?.business_name || doc.contact?.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {docSearchAttempted && docResults.length === 0 && !selectedDoc && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> ไม่พบเอกสารที่ตรงกัน
                </div>
                <button
                  type="button"
                  onClick={() => useAsExternal()}
                  className="text-xs font-bold text-red-700 underline hover:text-red-900 cursor-pointer"
                >
                  บันทึกแบบอุปกรณ์ลูกค้าแทน
                </button>
              </div>
            )}

            {selectedDoc && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-3">
                <div className="text-sm font-bold text-blue-700">
                  เอกสารอ้างอิง: {selectedDoc.document_number}
                </div>
                <label className="block text-xs font-medium text-slate-600">
                  เลือกสินค้าที่ต้องการแจ้งซ่อม
                </label>
                <AppSelect
                  value={selectedItemProductId}
                  onValueChange={(v) => {
                    setSelectedItemProductId(v);
                    setErrors((prev) => ({
                      ...prev,
                      selectedItemProductId: "",
                    }));
                  }}
                  options={docItems.map((item) => ({
                    value: String(item.product_id),
                    label: `${item.product?.name} (${item.product?.sku}) x${item.quantity}`,
                  }))}
                  placeholder="-- เลือกสินค้า --"
                  error={!!errors.selectedItemProductId}
                />
                {errors.selectedItemProductId && (
                  <p className="text-red-500 text-xs font-medium mt-1">
                    {errors.selectedItemProductId}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {mode === "external" && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />

              <div className="flex flex-wrap items-center gap-1">
                <span>
                  สำหรับสินค้าที่ไม่ได้ซื้อ หรือไม่มีในระบบล่าสุด —
                  กรุณาเลือกสินค้า หากยังไม่มีสินค้าในระบบให้เพิ่ม
                </span>

                <Link
                  href="/products/create"
                  className="inline-flex items-center font-bold text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 transition-colors"
                >
                  + เพิ่มสินค้า
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  เลือกสินค้าในระบบ
                </label>
                <ProductSearchDropdown
                  value={externalProductId}
                  selectedSku={externalProductSku}
                  selectedName={externalProductName}
                  hasError={!!errors.externalProductId}
                  onChange={(productId, productData) => {
                    setExternalProductId(productId);
                    setExternalProductSku(productData?.sku || "");
                    setExternalProductName(productData?.name || "");
                    setErrors((prev) => ({ ...prev, externalProductId: "" }));
                  }}
                />
                {errors.externalProductId && (
                  <p className="text-red-500 text-xs font-medium mt-1">
                    {errors.externalProductId}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Serial Number (ถ้ามี)
                </label>
                <input
                  type="text"
                  className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-mono"
                  placeholder="พิมพ์ S/N ที่ระบุบนตัวเครื่อง (ถ้ามี)..."
                  value={manualSerialNumber}
                  onChange={(e) => setManualSerialNumber(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  ผู้ติดต่อ/ร้านที่ส่งซ่อม
                </label>
                {!isAddingContact && (
                  <button
                    type="button"
                    onClick={() => setIsAddingContact(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    + ลูกค้าใหม่ (เพิ่มด่วน)
                  </button>
                )}
              </div>

              {isAddingContact ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="ชื่อลูกค้า/ร้านค้าใหม่..."
                    className="flex-1 h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddContact();
                      }
                      if (e.key === "Escape") {
                        setIsAddingContact(false);
                        setNewContactName("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddContact}
                    disabled={addingContactLoading}
                    className="h-10 px-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {addingContactLoading ? "กำลังเพิ่ม..." : "เพิ่ม"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingContact(false);
                      setNewContactName("");
                    }}
                    className="h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <>
                  <ContactSearchDropdown
                    value={contactId}
                    selectedName={selectedContactName}
                    selectedCode={selectedContactCode}
                    hasError={!!errors.contact_id}
                    onChange={(id, contactData) => {
                      setContactId(id);
                      setSelectedContactName(
                        contactData?.business_name ||
                          contactData?.contact_person_name ||
                          "",
                      );
                      setSelectedContactCode(contactData?.contact_code || "");
                      setErrors((prev) => ({ ...prev, contact_id: "" }));
                    }}
                  />
                  {errors.contact_id && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.contact_id}
                    </p>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                วันที่รับเครื่อง
              </label>
              <AppDatePicker value={receivedAt} onChange={setReceivedAt} />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isUnderWarranty}
                onChange={(e) => setIsUnderWarranty(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer"
              />
              อยู่ในประกัน
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              อาการที่ลูกค้าแจ้ง
            </label>
            <textarea
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-none"
              rows={3}
              value={reportedIssue}
              onChange={(e) => setReportedIssue(e.target.value)}
              placeholder="เช่น เปิดไม่ติด, มีเสียงดังผิดปกติ..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              รูปภาพประกอบ (ไม่บังคับ สูงสุด {MAX_PHOTOS} รูป ไม่เกิน 1MB/รูป)
            </label>
            <div className="flex flex-wrap gap-3">
              {photoPreviews.map((src, i) => (
                <div
                  key={i}
                  className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`รูปที่ ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer hover:bg-black/80"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photoFiles.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-blue-500 transition-all cursor-pointer"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-[10px]">เพิ่มรูป</span>
                </button>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              multiple
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => router.push("/repairs")}
            className="h-10 px-5 rounded-full font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-300 flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all hover:border-slate-400"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 rounded-full h-10 px-6 gap-2 shadow-lg shadow-blue-600/20 text-white flex items-center justify-center font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            บันทึกรับแจ้งซ่อม
          </button>
        </div>
      </div>
    </div>
  );
}
