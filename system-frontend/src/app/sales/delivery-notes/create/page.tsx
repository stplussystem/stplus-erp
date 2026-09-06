"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Truck,
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
import { SaleDocumentItemsTable } from "@/components/sales/SaleDocumentItemsTable";
import { useSaleDocumentItems } from "@/hooks/useSaleDocumentItems";
import { useApprovedDocuments } from "@/hooks/useApprovedDocuments";
import {
  getLetterLayoutConfig,
  getPaperSizeConfig,
} from "@/lib/letterLayoutDefaults";

export default function DeliveryNoteCreatePage() {
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

  const [formData, setFormData] = useState({
    document_type: "delivery_note",
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
    reference_number: "",
    saleman_code: "",
  });

  const {
    items,
    selectProduct,
    updateItem,
    addItem,
    removeItem,
    buildPayload,
    loadFromDocument,
  } = useSaleDocumentItems();

  const { docs: quotationDocs } = useApprovedDocuments([
    "quotation",
    "custom_quotation",
  ]);
  const { docs: materialIssueDocs } = useApprovedDocuments(["material_issue"]);
  const [loadingQuotation, setLoadingQuotation] = useState(false);
  // 🔒 ล็อกรายการสินค้าตามใบเบิกสินค้า (material_issue) ที่เลือก — ห้ามแก้ไขตัวเลขใดๆ เลย เพราะสต๊อกจะถูกตัดจริง
  // ตอนอนุมัติเอกสารนี้โดยอ้างอิงจำนวน/สินค้าจากใบเบิกตรงๆ (ดู backend SaleDocumentController::store())
  const [isLockedToMaterialIssue, setIsLockedToMaterialIssue] = useState(false);

  // 🚀 เลือกใบเสนอราคาที่อนุมัติแล้ว (ลูกค้าสั่งซื้อแล้ว) มาโหลดลูกค้า/รายละเอียด/รายการสินค้าให้อัตโนมัติ
  const handleSelectQuotation = async (quotationId: string) => {
    if (!quotationId) {
      setFormData((prev) => ({ ...prev, reference_document_id: "" }));
      return;
    }
    setIsLockedToMaterialIssue(false);
    setLoadingQuotation(true);
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/sale-documents/${quotationId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        const doc = data.data;
        setFormData((prev) => ({
          ...prev,
          reference_document_id: quotationId,
          contact_id: doc.contact_id ? String(doc.contact_id) : "",
          project_id: doc.project_id ? String(doc.project_id) : "",
          warehouse_id: doc.warehouse_id ? String(doc.warehouse_id) : "",
          rental_job_id:
            prev.rental_job_id ||
            (doc.rental_job_id ? String(doc.rental_job_id) : ""),
          tax_type: doc.tax_type || prev.tax_type,
          discount_amount: Number(doc.discount_amount) || 0,
          credit_days: Number(doc.credit_days) || 0,
          note: doc.note || "",
        }));
        setSelectedContact(doc.contact || null);
        loadFromDocument(doc.items || []);
        toast.success("โหลดข้อมูลจากใบเสนอราคาสำเร็จ");
      } else {
        toast.error("โหลดข้อมูลจากใบเสนอราคาไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("โหลดข้อมูลจากใบเสนอราคาไม่สำเร็จ");
    } finally {
      setLoadingQuotation(false);
    }
  };

  // 🎗️ เลือกใบเบิกสินค้า (material_issue) ที่อนุมัติแล้วมาโหลดลูกค้า/รายการสินค้า — รายการที่โหลดมาจะถูกล็อกห้ามแก้ไข
  const handleSelectMaterialIssue = async (materialIssueId: string) => {
    if (!materialIssueId) {
      setFormData((prev) => ({ ...prev, reference_document_id: "" }));
      setIsLockedToMaterialIssue(false);
      return;
    }
    setLoadingQuotation(true);
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/sale-documents/${materialIssueId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        const doc = data.data;
        setFormData((prev) => ({
          ...prev,
          reference_document_id: materialIssueId,
          contact_id: doc.contact_id ? String(doc.contact_id) : "",
          project_id: doc.project_id ? String(doc.project_id) : "",
          warehouse_id: doc.warehouse_id ? String(doc.warehouse_id) : "",
          rental_job_id:
            prev.rental_job_id ||
            (doc.rental_job_id ? String(doc.rental_job_id) : ""),
          note: doc.note || "",
        }));
        setSelectedContact(doc.contact || null);
        loadFromDocument(doc.items || []);
        setIsLockedToMaterialIssue(true);
        toast.success(
          "โหลดรายการจากใบเบิกสินค้าสำเร็จ — รายการสินค้าถูกล็อกตามใบเบิก",
        );
      } else {
        toast.error("โหลดข้อมูลจากใบเบิกสินค้าไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("โหลดข้อมูลจากใบเบิกสินค้าไม่สำเร็จ");
    } finally {
      setLoadingQuotation(false);
    }
  };

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
          ? p === "create_delivery_note"
          : p?.name === "create_delivery_note",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        fetchMasterData();
      } else {
        toast.error("คุณไม่มีสิทธิ์สร้างเอกสาร");
        router.push("/sales/delivery-notes");
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
      const { layout: deliveryNoteLetterLayout } = getLetterLayoutConfig(
        companySettings,
        "delivery_note",
      );
      const { paperSize } = getPaperSizeConfig(
        companySettings,
        "delivery_note",
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
            deliveryNoteLetterLayout,
            paperSize,
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
    // 🔒 รายการที่ล็อกจากใบเบิกสินค้าถูกยืนยันความถูกต้องมาแล้วตอนอนุมัติใบเบิก — ไม่ต้องตรวจซ้ำฝั่งนี้
    if (!isLockedToMaterialIssue && items.some((i) => !i.product_id))
      newErrors.items = "กรุณาเลือกสินค้าให้ครบทุกแถว";
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
      router.push("/sales/delivery-notes");
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
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              สร้างใบส่งสินค้า
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              ระบุรายละเอียดลูกค้าและรายการสินค้า
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={handlePreviewPDF}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileText className="w-4 h-4 text-blue-600" /> ตัวอย่าง PDF
          </button>
          <Link href="/sales/delivery-notes" className="w-full md:w-auto">
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

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[500px]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8 p-5 border border-slate-100 rounded-xl bg-slate-50/50">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              ประเภทเอกสาร
            </label>
            <input
              type="text"
              className="w-full h-10 px-4 text-sm rounded-xl border border-blue-200 bg-slate-100 text-slate-500 font-bold outline-none cursor-not-allowed"
              value="ใบส่งสินค้า (DO)"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8 p-5 border border-slate-100 rounded-xl bg-slate-50/50">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              อ้างอิงใบเสนอราคาที่อนุมัติแล้ว (ถ้ามี)
              {loadingQuotation && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
            </label>
            <AppSelect
              value={
                !isLockedToMaterialIssue
                  ? formData.reference_document_id || "__none__"
                  : "__none__"
              }
              onValueChange={(v) =>
                handleSelectQuotation(v === "__none__" ? "" : v)
              }
              disabled={loadingQuotation || isLockedToMaterialIssue}
              options={[
                { value: "__none__", label: "-- ไม่อ้างอิง (สร้างใหม่) --" },
                ...quotationDocs.map((d) => ({
                  value: String(d.id),
                  label: `${d.document_number} - ${d.contact?.business_name || d.contact?.contact_name || d.contact?.name || ""} (${dayjs(d.issue_date).format("DD/MM/YYYY")})`,
                })),
              ]}
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
              หรืออ้างอิงใบเบิกสินค้าที่อนุมัติแล้ว (ล็อกรายการ)
              {loadingQuotation && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
            </label>
            <AppSelect
              value={
                isLockedToMaterialIssue
                  ? formData.reference_document_id || "__none__"
                  : "__none__"
              }
              onValueChange={(v) =>
                handleSelectMaterialIssue(v === "__none__" ? "" : v)
              }
              disabled={
                loadingQuotation ||
                (!!formData.reference_document_id && !isLockedToMaterialIssue)
              }
              options={[
                { value: "__none__", label: "-- ไม่อ้างอิง --" },
                ...materialIssueDocs.map((d) => ({
                  value: String(d.id),
                  label: `${d.document_number} - ${d.contact?.business_name || d.contact?.contact_name || d.contact?.name || ""} (${dayjs(d.issue_date).format("DD/MM/YYYY")})`,
                })),
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              เลขที่ใบสั่งซื้อ / อ้างอิง
            </label>
            <input
              type="text"
              className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={formData.reference_number}
              onChange={(e) =>
                setFormData({ ...formData, reference_number: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              รหัสพนักงานขาย
            </label>
            <input
              type="text"
              className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={formData.saleman_code}
              onChange={(e) =>
                setFormData({ ...formData, saleman_code: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="relative z-20">
            <label className="block text-sm font-bold text-slate-700 mb-2">
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
              <label className="block text-xs font-medium text-slate-500 mb-1">
                คลังสินค้า (ถ้ามี){" "}
                {isLockedToMaterialIssue && "(ล็อกตามใบเบิก)"}
              </label>
              <AppSelect
                value={formData.warehouse_id || "__none__"}
                disabled={isLockedToMaterialIssue}
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
          variant="compact"
          readOnly={isLockedToMaterialIssue}
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
            <label className="block text-sm font-bold text-slate-700 mb-2">
              เงื่อนไขแนบท้าย (แสดงในเอกสาร)
            </label>
            <textarea
              rows={5}
              className="w-full p-4 rounded-2xl border border-slate-200 outline-none text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50 focus:bg-white"
              placeholder="ระบุเงื่อนไข เช่น สถานที่จัดส่ง, ผู้รับสินค้า..."
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
            <div className="flex justify-between text-lg font-black text-slate-800 border-t border-slate-200 pt-3 mt-2">
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
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />{" "}
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
    </div>
  );
}
