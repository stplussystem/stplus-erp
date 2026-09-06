"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wallet,
  Save,
  ArrowLeft,
  Loader2,
  Calculator,
  FileText,
  XCircle,
  Upload,
  X,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { QuickAddContactDialog } from "@/components/contacts/QuickAddContactDialog";
import { SerialPickerDialog } from "@/components/repairs/SerialPickerDialog";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { SaleDocumentItemsTable } from "@/components/sales/SaleDocumentItemsTable";
import { useSaleDocumentItems } from "@/hooks/useSaleDocumentItems";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

export default function CustomCashSaleCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillProjectId = searchParams.get("project_id");
  const prefillRentalJobId = searchParams.get("rental_job_id");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showQuickAddContact, setShowQuickAddContact] = useState(false);

  // 🎨 บิลเงินสดแบบกำหนดเอง — โลโก้/ชื่อ-ที่อยู่ผู้ขาย/ผู้ออกบิล แยกเฉพาะเอกสารนี้ ไม่กระทบบิลเงินสดหลัก
  const [customLogoPath, setCustomLogoPath] = useState("");
  const [customLogoUrl, setCustomLogoUrl] = useState("");

  // 💰 Subtotal/VAT พิมพ์ทับได้อิสระ — null = ยังใช้ค่าคำนวณอัตโนมัติจากรายการสินค้าอยู่
  const [manualSubtotal, setManualSubtotal] = useState<number | null>(null);
  const [manualVatAmount, setManualVatAmount] = useState<number | null>(null);

  // 🚀 ล็อก document_type ของหน้านี้ไว้
  const [formData, setFormData] = useState({
    document_type: "custom_cash",
    contact_id: "",
    project_id: "",
    rental_job_id: prefillRentalJobId || "",
    warehouse_id: "",
    issue_date: dayjs().format("YYYY-MM-DD"),
    credit_days: 0,
    currency: "THB",
    tax_type: "exclude",
    discount_amount: 0,
    note: "",
    custom_company_name: "",
    custom_company_address: "",
    custom_quoter_name: "",
  });

  const { items, selectProduct, updateItem, updateItemSerials, addItem, removeItem, buildPayload } =
    useSaleDocumentItems();

  const [serialPickerIndex, setSerialPickerIndex] = useState<number | null>(null);

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
        actualUser?.is_platform_admin === 1 ||
        actualUser?.is_platform_admin === true;
      const roles = Array.isArray(actualUser?.roles) ? actualUser.roles : [];
      const perms = Array.isArray(actualUser?.permissions)
        ? actualUser.permissions
        : [];
      const isSuper = roles.some((role: any) =>
        typeof role === "string"
          ? role.includes("Super Admin")
          : role?.name?.includes("Super Admin"),
      );

      const hasPermission = perms.some((p: any) =>
        typeof p === "string"
          ? p === "create_custom_cash"
          : p?.name === "create_custom_cash",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        fetchMasterData();
      } else {
        toast.error("คุณไม่มีสิทธิ์สร้างเอกสาร");
        router.push("/sales/custom-cash-sales");
      }
    } catch (e) {
      router.push("/");
    }
  }, [router]);

  const fetchMasterData = async () => {
    try {
      const token = getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const [warehousesRes, projectsRes, companyRes] = await Promise.all([
        fetch(`${apiUrl}/warehouses`, { headers }),
        fetch(`${apiUrl}/projects`, { headers }).catch(() => null),
        fetch(`${apiUrl}/company`, { headers }),
      ]);
      if (warehousesRes.ok) {
        const wData = await warehousesRes.json();
        setWarehouses(Array.isArray(wData) ? wData : wData?.data || []);
      }
      if (projectsRes && projectsRes.ok) {
        const pData = await projectsRes.json();
        setProjects(Array.isArray(pData) ? pData : pData?.data || []);
      }
      if (companyRes.ok) {
        const compData = await companyRes.json();
        setCompanySettings(
          Array.isArray(compData) ? compData[0] : compData.data || compData,
        );
      }
    } catch (error) {}
  };

  // 🚀 เติมโครงการอัตโนมัติเมื่อมาจากปุ่ม "สร้างใหม่" ในหน้า Project Hub (?project_id=)
  useEffect(() => {
    if (prefillProjectId && projects.length > 0 && !formData.project_id) {
      setFormData((prev) => ({ ...prev, project_id: prefillProjectId }));
      const proj = projects.find((p) => String(p.id) === prefillProjectId);
      if (proj?.contact_id && !formData.contact_id) {
        const token = getToken();
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
        fetch(`${apiUrl}/contacts/${proj.contact_id}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        })
          .then((r) => r.json())
          .then((d) => {
            const contact = d.data || d;
            setFormData((prev) => ({ ...prev, contact_id: String(contact.id) }));
            setSelectedContact(contact);
          })
          .catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillProjectId, projects]);

  const handleLogoSelect = async (file: File | null) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const body = new FormData();
      body.append("logo", file);
      const res = await fetch(
        `${apiUrl}/sale-documents/custom-cash-sales/upload-logo`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body,
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.message || "อัปโหลดโลโก้ไม่สำเร็จ");
        return;
      }
      const result = await res.json();
      setCustomLogoPath(result.path);
      setCustomLogoUrl(result.url);
      toast.success("อัปโหลดโลโก้สำเร็จ");
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบขณะอัปโหลดโลโก้");
    } finally {
      setUploadingLogo(false);
    }
  };

  const finance = useMemo(() => {
    let computedSubtotal = 0;
    let wht_amount = 0;
    items.forEach((item) => {
      computedSubtotal += item.total_price;
      if (item.wht_rate > 0)
        wht_amount += item.total_price * (item.wht_rate / 100);
    });
    // 💰 เอกสารกำหนดเอง — ถ้าผู้ใช้พิมพ์ทับ Subtotal/VAT เอง ใช้ค่านั้นแทนค่าคำนวณจากรายการสินค้า
    const subtotal = manualSubtotal ?? computedSubtotal;
    let discount = Number(formData.discount_amount) || 0;
    let after_discount = Math.max(0, subtotal - discount);
    let computedVat = 0;
    if (formData.tax_type === "exclude") {
      computedVat = after_discount * 0.07;
    } else if (formData.tax_type === "include") {
      computedVat = after_discount - after_discount / 1.07;
    }
    const vat_amount = manualVatAmount ?? computedVat;
    const grand_total =
      formData.tax_type === "exclude" ? after_discount + vat_amount : after_discount;
    return {
      subtotal,
      discount,
      after_discount,
      vat_amount,
      wht_amount,
      grand_total,
      net_payable: grand_total - wht_amount,
    };
  }, [
    items,
    formData.tax_type,
    formData.discount_amount,
    manualSubtotal,
    manualVatAmount,
  ]);

  const handlePreviewPDF = async () => {
    if (!formData.contact_id) {
      toast.error("กรุณาเลือกลูกค้า");
      return;
    }
    const toastId = toast.loading("กำลังสร้างตัวอย่างเอกสาร...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: SalesPdfTemplate } =
        await import("@/components/documents/SalesPdfTemplate");
      const { paperSize, letterLayout } = getPaperSizeConfig(companySettings, "custom_cash");
      const blob = await pdf(
        <SalesPdfTemplate
          data={{
            companySettings,
            formData,
            selectedContact,
            items,
            finance,
            documentNumber: "ตัวอย่าง-XXXX",
            customLogoUrl,
            paperSize,
            letterLayout,
          }}
        />,
      ).toBlob();
      setPreviewUrl(URL.createObjectURL(blob));
      toast.dismiss(toastId);
    } catch (e) {
      toast.error("สร้างตัวอย่าง PDF ไม่สำเร็จ", { id: toastId });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.contact_id) newErrors.contact_id = "กรุณาเลือกลูกค้า";
    if (items.some((i) => !i.product_id))
      newErrors.items = "กรุณาเลือกสินค้าให้ครบทุกแถว";
    if (items.some((i) => i.has_serial_number && (i.serials?.length || 0) !== i.quantity))
      newErrors.items = "กรุณาเลือก S/N ให้ครบตามจำนวนของสินค้าที่คุม S/N ทุกแถว";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    setLoading(true);
    const toastId = toast.loading("กำลังบันทึกเอกสาร...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const payload = {
        ...formData,
        project_id: formData.project_id || null,
        warehouse_id: formData.warehouse_id || null,
        vat_amount: finance.vat_amount,
        wht_amount: finance.wht_amount,
        grand_total: finance.grand_total,
        subtotal_override: manualSubtotal ?? null,
        custom_logo_path: customLogoPath || null,
        custom_company_name: formData.custom_company_name || null,
        custom_company_address: formData.custom_company_address || null,
        custom_quoter_name: formData.custom_quoter_name || null,
        items: buildPayload(),
      };
      const res = await fetch(`${apiUrl}/sale-documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error("บันทึกไม่สำเร็จ", {
          id: toastId,
          description: (await res.json()).message,
        });
        return;
      }
      toast.success("บันทึกสำเร็จ!", { id: toastId });
      router.push("/sales/custom-cash-sales");
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) return <div className="min-h-screen bg-slate-50"></div>;

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-100 dark:border-teal-800/50 shadow-sm">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              สร้างบิลเงินสด (กำหนดเอง)
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              ปรับโลโก้ ชื่อ-ที่อยู่ผู้ขาย และผู้ออกบิลได้เฉพาะเอกสารนี้
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={handlePreviewPDF}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileText className="w-4 h-4 text-teal-600" /> ตัวอย่าง PDF
          </button>
          <Link href="/sales/custom-cash-sales" className="w-full md:w-auto">
            <button
              type="button"
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              <ArrowLeft className="w-4 h-4" /> ยกเลิก
            </button>
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-teal-600 hover:bg-teal-700 shadow-sm shadow-teal-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}{" "}
            บันทึก
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[500px]">
        {/* 🎨 ส่วนปรับแต่งเฉพาะเอกสารนี้ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 p-5 border border-teal-100 rounded-xl bg-teal-50/40">
          <div>
            <label className="block text-xs font-bold text-teal-600 uppercase tracking-wider mb-1">
              โลโก้ (เฉพาะเอกสารนี้)
            </label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => handleLogoSelect(e.target.files?.[0] || null)}
            />
            {customLogoUrl ? (
              <div className="flex items-center gap-2">
                <img
                  src={customLogoUrl}
                  alt="โลโก้ที่กำหนดเอง"
                  className="w-10 h-10 object-contain rounded-lg border border-slate-200 bg-white"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  เปลี่ยนรูป
                </button>
                <AppTooltip label="ล้างโลโก้ (ใช้โลโก้บริษัทเดิม)">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomLogoPath("");
                      setCustomLogoUrl("");
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </AppTooltip>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="w-full h-10 px-4 rounded-xl border border-dashed border-teal-300 bg-white text-xs font-bold text-teal-600 hover:bg-teal-50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {uploadingLogo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                อัปโหลดโลโก้
              </button>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-teal-600 uppercase tracking-wider mb-1">
              ชื่อผู้ขายที่แสดงในเอกสาร
            </label>
            <input
              type="text"
              className="w-full h-10 px-4 text-sm rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none"
              placeholder={companySettings?.name || "ใช้ชื่อบริษัทเดิม"}
              value={formData.custom_company_name}
              onChange={(e) =>
                setFormData({ ...formData, custom_company_name: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-teal-600 uppercase tracking-wider mb-1">
              ผู้ออกบิล
            </label>
            <input
              type="text"
              className="w-full h-10 px-4 text-sm rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none"
              placeholder="พิมพ์ชื่อผู้ออกบิล"
              value={formData.custom_quoter_name}
              onChange={(e) =>
                setFormData({ ...formData, custom_quoter_name: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-teal-600 uppercase tracking-wider mb-1">
              ที่อยู่ผู้ขาย (เฉพาะเอกสารนี้)
            </label>
            <textarea
              rows={2}
              className="w-full p-3 text-sm rounded-xl border border-slate-200 outline-none resize-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder={companySettings?.address || "ใช้ที่อยู่บริษัทเดิม"}
              value={formData.custom_company_address}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  custom_company_address: e.target.value,
                })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8 p-5 border border-slate-100 rounded-xl bg-slate-50/50">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              ประเภทเอกสาร
            </label>
            <input
              type="text"
              className="w-full h-10 px-4 text-sm rounded-xl border border-blue-200 bg-slate-100 text-slate-500 font-bold outline-none cursor-not-allowed"
              value="บิลเงินสด (กำหนดเอง)"
              disabled
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              วันที่ออกเอกสาร
            </label>
            <AppDatePicker
              value={formData.issue_date}
              onChange={(v) => setFormData({ ...formData, issue_date: v })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              ยืนราคา (วัน)
            </label>
            <input
              type="number"
              min="0"
              className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={formData.credit_days}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  credit_days: Number(e.target.value),
                })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="relative z-20">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              เลือกลูกค้า <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ContactSearchDropdown
                  value={formData.contact_id}
                  selectedName={
                    selectedContact?.business_name || selectedContact?.name
                  }
                  selectedCode={selectedContact?.contact_code}
                  hasError={!!errors.contact_id}
                  onChange={(contactId, contactData) => {
                    setFormData({ ...formData, contact_id: contactId });
                    setSelectedContact(contactData);
                    setErrors((prev) => ({ ...prev, contact_id: "" }));
                  }}
                />
              </div>
              <AppTooltip label="เพิ่มลูกค้าใหม่แบบด่วน">
                <button
                  type="button"
                  onClick={() => setShowQuickAddContact(true)}
                  className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-teal-600 hover:border-teal-300 hover:bg-teal-50 cursor-pointer transition-all shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </AppTooltip>
            </div>
            {errors.contact_id && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.contact_id}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                คลังสินค้า (ถ้ามี)
              </label>
              <AppSelect
                value={formData.warehouse_id || "__none__"}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    warehouse_id: v === "__none__" ? "" : v,
                  })
                }
                options={[
                  { value: "__none__", label: "-- ไม่ระบุ --" },
                  ...warehouses.map((w) => ({
                    value: String(w.id),
                    label: w.name,
                  })),
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                โปรเจค (Project)
              </label>
              <AppSelect
                value={formData.project_id || "__none__"}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    project_id: v === "__none__" ? "" : v,
                  })
                }
                options={[
                  { value: "__none__", label: "-- ไม่มีโปรเจค --" },
                  ...projects.map((pj) => ({
                    value: String(pj.id),
                    label: pj.name,
                  })),
                ]}
              />
            </div>
          </div>
        </div>

        {errors.items && (
          <p className="text-red-500 text-xs font-medium mb-2">
            {errors.items}
          </p>
        )}
        <SaleDocumentItemsTable
          items={items}
          hasError={!!errors.items}
          onSelectProduct={(index, productData) => {
            selectProduct(index, productData);
            setErrors((prev) => ({ ...prev, items: "" }));
          }}
          onChangeField={updateItem}
          onAdd={addItem}
          onRemove={removeItem}
          showSerialPicker
          onOpenSerialPicker={(index) => setSerialPickerIndex(index)}
        />

        <div className="flex flex-col lg:flex-row justify-between gap-8">
          <div className="w-full lg:w-1/2">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              เงื่อนไขแนบท้าย (แสดงในเอกสาร)
            </label>
            <textarea
              rows={5}
              className="w-full p-4 rounded-2xl border border-slate-200 outline-none text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50 focus:bg-white"
              placeholder="ระบุเงื่อนไข เช่น การชำระเงินมัดจำ, การรับประกัน..."
              value={formData.note}
              onChange={(e) =>
                setFormData({ ...formData, note: e.target.value })
              }
            ></textarea>
          </div>
          <div className="w-full lg:w-96 space-y-3 bg-slate-50 p-6 rounded-3xl border border-slate-100 text-sm text-slate-600 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-500" /> รูปแบบภาษี
              </span>
              <AppSelect
                value={formData.tax_type}
                onValueChange={(v) =>
                  setFormData({ ...formData, tax_type: v })
                }
                triggerClassName="h-8 w-auto px-2 rounded-lg border-blue-500 text-blue-700 bg-blue-100 font-bold text-xs"
                options={[
                  { value: "exclude", label: "Vat นอก (แยกภาษี)" },
                  { value: "include", label: "Vat ใน (รวมภาษี)" },
                  { value: "none", label: "ไม่มีภาษี (Non-Vat)" },
                ]}
              />
            </div>
            <div className="flex justify-between items-center font-medium pt-2">
              <span>รวมเป็นเงิน (Subtotal)</span>
              <input
                type="number"
                min="0"
                className="w-32 h-10 text-right px-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
                value={finance.subtotal}
                onChange={(e) => setManualSubtotal(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-between items-center">
              <span>ส่วนลดท้ายบิล</span>
              <input
                type="number"
                min="0"
                className="w-28 h-10 text-right px-2 rounded-xl border border-slate-200 text-red-500 font-bold outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 bg-white"
                value={formData.discount_amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    discount_amount: Number(e.target.value),
                  })
                }
              />
            </div>
            {finance.discount > 0 && (
              <div className="flex justify-between text-slate-700 font-medium">
                <span>ยอดหลังหักส่วนลด</span>
                <span>
                  {finance.after_discount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            {formData.tax_type !== "none" && (
              <div className="flex justify-between items-center font-medium">
                <span>
                  ภาษีมูลค่าเพิ่ม{" "}
                  {formData.tax_type === "include" ? "(รวมในยอด)" : "(7%)"}
                </span>
                <input
                  type="number"
                  min="0"
                  className="w-32 h-10 text-right px-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
                  value={finance.vat_amount}
                  onChange={(e) => setManualVatAmount(Number(e.target.value))}
                />
              </div>
            )}
            <div className="flex justify-between text-lg font-black text-slate-800 border-t border-slate-200 pt-3 mt-2">
              <span>จำนวนเงินรวมทั้งสิ้น</span>
              <span className="text-teal-600">
                {finance.grand_total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-500" />{" "}
                พรีวิวตัวอย่างเอกสาร
              </h3>
              <button
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 p-2">
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-xl border border-slate-200"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      {serialPickerIndex !== null && (
        <SerialPickerDialog
          isOpen={serialPickerIndex !== null}
          onClose={() => setSerialPickerIndex(null)}
          productId={items[serialPickerIndex].product_id}
          productName={items[serialPickerIndex].product_name}
          quantity={items[serialPickerIndex].quantity}
          value={items[serialPickerIndex].serials || []}
          onConfirm={(serials) => updateItemSerials(serialPickerIndex, serials)}
        />
      )}

      <QuickAddContactDialog
        open={showQuickAddContact}
        onOpenChange={setShowQuickAddContact}
        onCreated={(contactId, contactData) => {
          setFormData((prev) => ({ ...prev, contact_id: contactId }));
          setSelectedContact(contactData);
          setErrors((prev) => ({ ...prev, contact_id: "" }));
        }}
      />
    </div>
  );
}
