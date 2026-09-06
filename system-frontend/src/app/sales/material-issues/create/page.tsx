"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PackagePlus,
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
import { SerialPickerDialog } from "@/components/repairs/SerialPickerDialog";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { SaleDocumentItemsTable } from "@/components/sales/SaleDocumentItemsTable";
import { useSaleDocumentItems } from "@/hooks/useSaleDocumentItems";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

interface ProjectOption {
  id: number;
  name: string;
  contact_id: number | null;
}

interface QuotationOption {
  id: number;
  document_number: string;
  issue_date: string;
  contact?: {
    business_name?: string;
    contact_person_name?: string;
    name?: string;
  } | null;
}

export default function MaterialIssueCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillProjectId = searchParams.get("project_id");

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [quotations, setQuotations] = useState<QuotationOption[]>([]);
  const [loadingQuotation, setLoadingQuotation] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    document_type: "material_issue",
    contact_id: "",
    project_id: "",
    reference_document_id: "",
    warehouse_id: "",
    issue_date: dayjs().format("YYYY-MM-DD"),
    note: "",
  });

  const {
    items,
    loadFromDocument,
    selectProduct,
    updateItem,
    updateItemSerials,
    addItem,
    removeItem,
    buildPayload,
  } = useSaleDocumentItems();
  const [serialPickerIndex, setSerialPickerIndex] = useState<number | null>(
    null,
  );

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
          ? p === "create_material_issue"
          : p?.name === "create_material_issue",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        fetchMasterData();
      } else {
        toast.error("คุณไม่มีสิทธิ์สร้างเอกสาร");
        router.push("/sales/material-issues");
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

  // 🚀 ดึงใบเสนอราคาที่อนุมัติแล้ว — ถ้าเลือกโครงการ ดึงเฉพาะของโครงการนั้น ถ้าไม่เลือกโครงการ ดึงเฉพาะที่ไม่มีโครงการ
  const fetchQuotations = async (projectId: string) => {
    setQuotations([]);
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const projectParam = projectId || "none";
      const res = await fetch(
        `${apiUrl}/sale-documents?type=quotation&status=Approved&project_id=${projectParam}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setQuotations(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {}
  };

  useEffect(() => {
    fetchQuotations(formData.project_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.project_id]);

  // 🚀 เลือกโครงการแล้ว auto-fill ลูกค้าจาก project.contact_id (ถ้ามี) — เปลี่ยนใบเสนอราคาที่เคยเลือกไว้ทิ้ง
  const handleProjectChange = async (projectId: string) => {
    setFormData((prev) => ({
      ...prev,
      project_id: projectId,
      reference_document_id: "",
    }));
    if (!projectId) return;
    const proj = projects.find((p) => String(p.id) === projectId);
    if (proj?.contact_id) {
      try {
        const token = getToken();
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
        const res = await fetch(`${apiUrl}/contacts/${proj.contact_id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });
        if (res.ok) {
          const d = await res.json();
          const contact = d.data || d;
          setFormData((prev) => ({ ...prev, contact_id: String(contact.id) }));
          setSelectedContact(contact);
        }
      } catch (error) {}
    }
  };

  // 🚀 เติมโครงการอัตโนมัติเมื่อมาจากปุ่ม "สร้างใหม่" ในหน้า Project Hub (?project_id=)
  useEffect(() => {
    if (prefillProjectId && projects.length > 0 && !formData.project_id) {
      handleProjectChange(prefillProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillProjectId, projects]);

  // 🚀 เลือกใบเสนอราคา มาโหลดรายการสินค้าเข้าใบเบิก (ไม่แตะลูกค้า/โครงการที่เลือกไว้)
  const handleSelectQuotation = async (quotationId: string) => {
    if (!quotationId) return;
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
        if (doc.items && doc.items.length > 0) {
          loadFromDocument(doc.items);
        }
        setFormData((prev) => ({
          ...prev,
          reference_document_id: quotationId,
        }));
        toast.success("โหลดรายการสินค้าจากใบเสนอราคาสำเร็จ");
      } else {
        toast.error("โหลดข้อมูลจากใบเสนอราคาไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("โหลดข้อมูลจากใบเสนอราคาไม่สำเร็จ");
    } finally {
      setLoadingQuotation(false);
    }
  };

  // 📌 ไม่มีส่วนลด/ภาษีสำหรับใบเบิกสินค้า (tax_type ล็อกเป็น "none" เสมอ) — subtotal คำนวณจากรายการสินค้าเพื่อโชว์ตัวอย่าง PDF
  // ให้ตรงกับสิ่งที่ backend จะคำนวณจริงตอนบันทึก (backend เป็นคน authoritative สุดท้ายเสมอ ไม่เชื่อค่าฝั่งนี้)
  const finance = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + (item.total_price || 0),
      0,
    );
    return {
      subtotal,
      discount: 0,
      after_discount: subtotal,
      vat_amount: 0,
      wht_amount: 0,
      grand_total: subtotal,
      net_payable: subtotal,
    };
  }, [items]);

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
        "material_issue",
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
    if (items.some((i) => !i.product_id))
      newErrors.items = "กรุณาเลือกสินค้าให้ครบทุกแถว";
    if (
      items.some(
        (i) => i.has_serial_number && (i.serials?.length || 0) !== i.quantity,
      )
    )
      newErrors.items =
        "กรุณาเลือก S/N ให้ครบตามจำนวนของสินค้าที่คุม S/N ทุกแถว";
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
        reference_document_id: formData.reference_document_id || null,
        tax_type: "none",
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
      router.push("/sales/material-issues");
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
            <PackagePlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              สร้างใบเบิกสินค้า
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              เบิกสินค้าใช้ในโครงการ — ตัดสต๊อกจริงเมื่ออนุมัติ
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
          <Link href="/sales/material-issues" className="w-full md:w-auto">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-5 p-5 border border-slate-100 rounded-xl bg-slate-50/50">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              โครงการ (Project)
            </label>
            <AppSelect
              value={formData.project_id || "__none__"}
              onValueChange={(v) =>
                handleProjectChange(v === "__none__" ? "" : v)
              }
              options={[
                { value: "__none__", label: "-- ไม่ระบุโครงการ --" },
                ...projects.map((p) => ({
                  value: String(p.id),
                  label: p.name,
                })),
              ]}
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
              อ้างอิงใบเสนอราคา (โหลดรายการสินค้า)
              {loadingQuotation && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
            </label>
            <AppSelect
              value={formData.reference_document_id || "__none__"}
              onValueChange={(v) =>
                v !== "__none__" && handleSelectQuotation(v)
              }
              disabled={loadingQuotation}
              options={[
                {
                  value: "__none__",
                  label:
                    quotations.length === 0
                      ? formData.project_id
                        ? "-- ไม่มีใบเสนอราคาของโครงการนี้ --"
                        : "-- ไม่มีใบเสนอราคาที่ไม่มีโครงการ --"
                      : "-- เลือกใบเสนอราคา --",
                },
                ...quotations.map((q) => ({
                  value: String(q.id),
                  label: `${q.document_number} - ${q.contact?.business_name || q.contact?.contact_person_name || q.contact?.name || ""} (${dayjs(q.issue_date).format("DD/MM/YYYY")})`,
                })),
              ]}
            />
          </div>
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
              วันที่ออกเอกสาร
            </label>
            <AppDatePicker
              value={formData.issue_date}
              onChange={(v) => setFormData({ ...formData, issue_date: v })}
            />
          </div>
        </div>

        <div className="mb-6">
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

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            หมายเหตุ
          </label>
          <textarea
            rows={3}
            className="w-full p-4 rounded-2xl border border-slate-200 outline-none text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50 focus:bg-white"
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          />
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
    </div>
  );
}
