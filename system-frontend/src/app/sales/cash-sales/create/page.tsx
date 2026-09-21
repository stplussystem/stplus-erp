"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileBox,
  Save,
  ArrowLeft,
  Loader2,
  Calculator,
  FileText,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";
import { SaleDocumentItemsTable } from "@/components/sales/SaleDocumentItemsTable";
import { useSaleDocumentItems } from "@/hooks/useSaleDocumentItems";
import { useApprovedDocuments } from "@/hooks/useApprovedDocuments";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

export default function CashSaleCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillProjectId = searchParams.get("project_id");
  const prefillRentalJobId = searchParams.get("rental_job_id");

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // 🚀 ล็อก document_type ของหน้านี้ไว้
  const [formData, setFormData] = useState({
    document_type: "cash",
    contact_id: "",
    project_id: "",
    rental_job_id: prefillRentalJobId || "",
    warehouse_id: "",
    reference_document_id: "",
    issue_date: dayjs().format("YYYY-MM-DD"),
    credit_days: 0,
    currency: "THB",
    tax_type: "exclude",
    discount_amount: 0,
    note: "",
  });

  const { items, selectProduct, updateItem, addItem, removeItem, buildPayload, loadFromDocument } =
    useSaleDocumentItems();

  const { docs: materialIssueDocs } = useApprovedDocuments(["material_issue"], formData.project_id);
  const [loadingMaterialIssue, setLoadingMaterialIssue] = useState(false);

  // 🎗️ เลือกใบเบิกสินค้า (material_issue) ที่อนุมัติแล้วมาโหลดลูกค้า/รายการสินค้า/S-N — เป็นทางเดียวที่สร้างเอกสารนี้ได้แล้ว
  // (เดิมบิลเงินสดเป็นเอกสารอิสระ เลือกสินค้า/S-N เองได้ทั้งหมด เปลี่ยนให้ล็อกตามใบเบิกสินค้าต้นทางแทน เหมือนใบกำกับภาษี/
  // ใบส่งสินค้า) รายการ/ราคา/S-N ที่โหลดมาล็อกห้ามแก้ไขทั้งหมด (สต๊อกจะถูกตัดจริงตอนอนุมัติเอกสารนี้ — ดู backend
  // SaleDocumentController::approve())
  const handleSelectMaterialIssue = async (materialIssueId: string) => {
    if (!materialIssueId) {
      setFormData((prev) => ({ ...prev, reference_document_id: "" }));
      return;
    }
    setLoadingMaterialIssue(true);
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      const res = await fetch(`${apiUrl}/sale-documents/${materialIssueId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const doc = data.data;

        setFormData((prev) => ({
          ...prev,
          reference_document_id: materialIssueId,
          contact_id: doc.contact_id ? String(doc.contact_id) : "",
          project_id: doc.project_id ? String(doc.project_id) : "",
          // 🔒 คลังสินค้าล็อกตามใบเบิก แก้ไม่ได้ (ดู UI ด้านล่างที่ disable ช่องนี้)
          warehouse_id: doc.warehouse_id ? String(doc.warehouse_id) : "",
          rental_job_id: prev.rental_job_id || (doc.rental_job_id ? String(doc.rental_job_id) : ""),
          note: doc.note || "",
        }));
        setErrors((prev) => ({ ...prev, reference_document_id: "" }));
        setSelectedContact(doc.contact || null);
        loadFromDocument(doc.items || []);
        toast.success("โหลดรายการจากใบเบิกสินค้าสำเร็จ — รายการ/ราคา/S-N ถูกล็อกตามใบเบิกสินค้า");
      } else {
        toast.error("โหลดข้อมูลจากใบเบิกสินค้าไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("โหลดข้อมูลจากใบเบิกสินค้าไม่สำเร็จ");
    } finally {
      setLoadingMaterialIssue(false);
    }
  };

  useEffect(() => {
    const userStr = getUserRaw();
    if (!userStr) {
      router.replace("/");
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
        typeof p === "string" ? p === "create_cash" : p?.name === "create_cash",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        fetchMasterData();
      } else {
        toast.error("คุณไม่มีสิทธิ์สร้างเอกสาร");
        router.replace("/sales/cash-sales");
      }
    } catch (e) {
      router.replace("/");
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
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        })
          .then((r) => r.json())
          .then((d) => {
            const contact = d.data || d;
            setFormData((prev) => ({
              ...prev,
              contact_id: String(contact.id),
            }));
            setSelectedContact(contact);
          })
          .catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillProjectId, projects]);

  // 🆕 [2026-09-17] มาจากโครงการ/งานเช่าแล้วยังไม่ได้เลือกใบเบิกสินค้าที่จะอ้างอิง — ผู้ใช้บางคนไม่รู้ว่าต้องเลือกอะไรต่อ
  // เลื่อนจอไปที่ช่องนี้ + ขึ้นกรอบแดงพร้อมข้อความเตือนอัตโนมัติครั้งเดียวตอนโหลดโครงการ/งานเช่าเสร็จ
  const referenceFieldRef = useRef<HTMLDivElement>(null);
  const referenceHintShownRef = useRef(false);
  useEffect(() => {
    const arrivedViaProject = !!prefillProjectId && formData.project_id === prefillProjectId;
    const arrivedViaRentalJob = !!prefillRentalJobId && formData.rental_job_id === prefillRentalJobId;
    if (
      (arrivedViaProject || arrivedViaRentalJob) &&
      !formData.reference_document_id &&
      !referenceHintShownRef.current
    ) {
      referenceHintShownRef.current = true;
      setErrors((prev) => ({
        ...prev,
        reference_document_id: "กรุณาเลือกใบเบิกสินค้า",
      }));
      setTimeout(() => {
        referenceFieldRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 300);
    }
  }, [
    prefillProjectId,
    prefillRentalJobId,
    formData.project_id,
    formData.rental_job_id,
    formData.reference_document_id,
  ]);

  const finance = useMemo(() => {
    let subtotal = 0;
    let wht_amount = 0;
    items.forEach((item) => {
      subtotal += item.total_price;
      if (item.wht_rate > 0)
        wht_amount += item.total_price * (item.wht_rate / 100);
    });
    let discount = Number(formData.discount_amount) || 0;
    let after_discount = Math.max(0, subtotal - discount);
    let vat_amount = 0;
    let grand_total = after_discount;
    if (formData.tax_type === "exclude") {
      vat_amount = after_discount * 0.07;
      grand_total = after_discount + vat_amount;
    } else if (formData.tax_type === "include") {
      vat_amount = after_discount - after_discount / 1.07;
    }
    return {
      subtotal,
      discount,
      after_discount,
      vat_amount,
      wht_amount,
      grand_total,
      net_payable: grand_total - wht_amount,
    };
  }, [items, formData.tax_type, formData.discount_amount]);

  // 🧠 เลขที่เอกสารตัวอย่าง (Auto) ให้เห็นก่อนบันทึกจริง เหมือนหน้าใบเสนอราคา/ใบสั่งซื้อ — เลขจริงรันตอนกดบันทึกเท่านั้น
  const documentNumberPreview = useMemo(() => {
    let prefix = "CS";
    let prefixSep = "-";
    let dateSep = "-";
    let datePattern = "YYMM";

    if (companySettings?.document_settings) {
      let settings = companySettings.document_settings;
      if (typeof settings === "string") {
        try {
          settings = JSON.parse(settings);
        } catch (e) {
          settings = {};
        }
      }
      prefix = settings?.docs?.cash?.prefix || "CS";
      prefixSep =
        settings?.format?.prefixSeparator === "none"
          ? ""
          : settings?.format?.prefixSeparator || "-";
      dateSep =
        settings?.format?.dateSeparator === "none"
          ? ""
          : settings?.format?.dateSeparator || "-";
      datePattern = settings?.format?.datePattern || "YYMM";

      if (
        settings?.format?.companyPrefixEnabled &&
        settings?.format?.companyPrefixText
      ) {
        prefix = `${settings.format.companyPrefixText}${prefixSep}${prefix}`;
      }
    }

    const d = dayjs(formData.issue_date || undefined);
    let dateStr = "";
    if (datePattern === "YYYYMMDD") dateStr = d.format("YYYYMMDD");
    else if (datePattern === "YYYYMM") dateStr = d.format("YYYYMM");
    else if (datePattern === "YYMM") dateStr = d.format("YYMM");
    else if (datePattern === "YYYY") dateStr = d.format("YYYY");

    return `${prefix}${prefixSep}${dateStr}${dateSep}Auto`;
  }, [formData.issue_date, companySettings]);

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
      const { paperSize, letterLayout } = getPaperSizeConfig(
        companySettings,
        "cash",
      );
      const blob = await pdf(
        <SalesPdfTemplate
          data={{
            companySettings,
            formData,
            selectedContact,
            items,
            finance,
            documentNumber: "ตัวอย่าง-XXXX",
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
    if (!formData.reference_document_id)
      newErrors.reference_document_id = "กรุณาเลือกใบเบิกสินค้า";
    if (!formData.warehouse_id)
      newErrors.warehouse_id = "กรุณาเลือกคลังสินค้า";
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
      router.push("/sales/cash-sales");
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) return <AppLoading text="กำลังตรวจสอบสิทธิ์การเข้าใช้งาน..." variant="bar" minHeight="min-h-screen" className="bg-muted/50" />;

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <FileBox className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">สร้างบิลเงินสด</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              เลือกใบเบิกสินค้าที่อนุมัติแล้ว — รายการ/ราคา/S-N สืบทอดมาจากใบเบิกสินค้าโดยตรง
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={handlePreviewPDF}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileText className="w-4 h-4 text-blue-600" /> ตัวอย่าง PDF
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" /> ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
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

      <div className="bg-card p-6 rounded-2xl shadow-sm border border-border min-h-[500px]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8 p-5 border border-border rounded-xl bg-muted/50">
          <div>
            <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              ประเภทเอกสาร
            </label>
            <div className="h-10 flex items-center text-sm font-bold text-foreground">
              บิลเงินสด (CS)
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              เลขที่เอกสาร
            </label>
            <div className="h-10 flex items-center">
              <span className="inline-block bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-lg border border-blue-200 text-sm">
                {documentNumberPreview}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              วันที่ออกเอกสาร
            </label>
            <AppDatePicker
              value={formData.issue_date}
              onChange={(v) => setFormData({ ...formData, issue_date: v })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              ยืนราคา (วัน)
            </label>
            <input
              type="number"
              min="0"
              className="w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8 p-5 border border-border rounded-xl bg-muted/50">
          <div className="md:col-span-2" ref={referenceFieldRef}>
            <label className="flex items-center gap-1.5 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
              อ้างอิงใบเบิกสินค้าที่อนุมัติแล้ว <span className="text-red-500">*</span>
              {loadingMaterialIssue && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            </label>
            <AppSelect
              value={formData.reference_document_id || "__none__"}
              onValueChange={(v) => handleSelectMaterialIssue(v === "__none__" ? "" : v)}
              disabled={loadingMaterialIssue}
              error={!!errors.reference_document_id}
              options={[
                { value: "__none__", label: "-- เลือกใบเบิกสินค้า --" },
                ...materialIssueDocs.map((d) => ({
                  value: String(d.id),
                  label: `${d.document_number} - ${d.contact?.business_name || d.contact?.contact_name || d.contact?.name || ""} (${dayjs(d.issue_date).format("DD/MM/YYYY")})`,
                })),
              ]}
            />
            {errors.reference_document_id && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.reference_document_id}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="relative z-20">
            <label className="block text-sm font-bold text-foreground mb-2">
              เลือกลูกค้า <span className="text-red-500">*</span>
            </label>
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
            {errors.contact_id && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.contact_id}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                คลังสินค้า <span className="text-red-500">*</span> (ล็อกตามใบเบิก)
              </label>
              <AppSelect
                value={formData.warehouse_id}
                disabled
                onValueChange={(v) => {
                  setFormData({
                    ...formData,
                    warehouse_id: v,
                  });
                  setErrors((prev) => ({ ...prev, warehouse_id: "" }));
                }}
                error={!!errors.warehouse_id}
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">
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
                  ...projects
                    .filter((pj) => pj.status !== "completed" || String(pj.id) === formData.project_id)
                    .map((pj) => ({
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
          readOnly
          onSelectProduct={(index, productData) => {
            selectProduct(index, productData);
            setErrors((prev) => ({ ...prev, items: "" }));
          }}
          onChangeField={updateItem}
          onAdd={addItem}
          onRemove={removeItem}
        />

        <div className="flex flex-col lg:flex-row justify-between gap-8">
          <div className="w-full lg:w-1/2">
            <label className="block text-sm font-bold text-foreground mb-2">
              เงื่อนไขแนบท้าย (แสดงในเอกสาร)
            </label>
            <textarea
              rows={5}
              className="w-full p-4 rounded-2xl border border-border outline-none text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-muted/50 focus:bg-background"
              placeholder="ระบุเงื่อนไข เช่น การชำระเงินมัดจำ, การรับประกัน..."
              value={formData.note}
              onChange={(e) =>
                setFormData({ ...formData, note: e.target.value })
              }
            ></textarea>
          </div>
          <div className="w-full lg:w-96 space-y-3 bg-muted/50 p-6 rounded-3xl border border-border text-sm text-muted-foreground shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-500" /> รูปแบบภาษี
              </span>
              <AppSelect
                value={formData.tax_type}
                onValueChange={(v) => setFormData({ ...formData, tax_type: v })}
                triggerClassName="h-8 w-auto px-2 rounded-lg border-blue-500 text-blue-700 bg-blue-100 font-bold text-xs"
                options={[
                  { value: "exclude", label: "Vat นอก (แยกภาษี)" },
                  { value: "include", label: "Vat ใน (รวมภาษี)" },
                  { value: "none", label: "ไม่มีภาษี (Non-Vat)" },
                ]}
              />
            </div>
            <div className="flex justify-between font-medium pt-2">
              <span>รวมเป็นเงิน (Subtotal)</span>
              <span>
                {finance.subtotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>ส่วนลดท้ายบิล</span>
              <input
                type="number"
                min="0"
                className="w-28 h-10 text-right px-2 rounded-xl border border-border text-red-500 font-bold outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 bg-background"
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
              <div className="flex justify-between text-foreground font-medium">
                <span>ยอดหลังหักส่วนลด</span>
                <span>
                  {finance.after_discount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            {formData.tax_type !== "none" && (
              <div className="flex justify-between font-medium">
                <span>
                  ภาษีมูลค่าเพิ่ม{" "}
                  {formData.tax_type === "include" ? "(รวมในยอด)" : "(7%)"}
                </span>
                <span>
                  {finance.vat_amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-black text-foreground border-t border-border pt-3 mt-2">
              <span>จำนวนเงินรวมทั้งสิ้น</span>
              <span className="text-blue-600">
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
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />{" "}
                พรีวิวตัวอย่างเอกสาร
              </h3>
              <button
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full transition-all cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-muted p-2">
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-xl border border-border"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
