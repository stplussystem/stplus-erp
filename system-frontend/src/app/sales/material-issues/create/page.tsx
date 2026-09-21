"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PackagePlus,
  Save,
  ArrowLeft,
  Loader2,
  Calculator,
  FileText,
  XCircle,
  AlertTriangle,
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
import { SerialPickerDialog } from "@/components/repairs/SerialPickerDialog";
import { useSaleDocumentItems } from "@/hooks/useSaleDocumentItems";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

interface ProjectOption {
  id: number;
  name: string;
  contact_id: number | null;
  status?: string;
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
  // 🆕 [2026-09-15] มาจากปุ่ม "เบิกเพิ่ม" ในหน้ารายการใบเบิกสินค้า (สำหรับใบเบิกที่อนุมัติไปแล้วบางส่วน ยังไม่ครบ
  // ตามใบเสนอราคา) — เปิดหน้าสร้างใหม่นี้พร้อม preselect ใบเสนอราคาเดิมให้เลย ไม่ต้องเลือกซ้ำเอง เอกสารที่ได้จะเป็น
  // ใบเบิกใหม่แยกจากใบเดิม (เลขที่เอกสารรันต่อเนื่องปกติ ไม่ใช่ระบบ revise/-V เดิม) อ้างอิงจำนวนคงเหลือที่ยังเบิกได้
  // จริงจากใบเสนอราคาเดียวกัน (ไม่นับใบเบิกเดิมซ้ำ เพราะ /issuable-items หักจากใบเบิกเดิมที่อนุมัติแล้วให้อัตโนมัติ)
  const prefillQuotationId = searchParams.get("quotation_id");

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

  // 🆕 ล็อกเฉพาะ "ราคา" ของแถวเมื่อโหลดจากใบเสนอราคาที่อนุมัติแล้ว — จำนวนยังปรับลดได้เพื่อเบิกเป็นรอบๆ (ดู backend
  // $quotationLock ใน SaleDocumentController::store()) และปุ่มเลือก S/N ต่อแถว — ย้ายมาจากใบจัดสินค้าเดิม
  const [isLockedToQuotation, setIsLockedToQuotation] = useState(false);
  const [serialPickerIndex, setSerialPickerIndex] = useState<number | null>(null);

  // 🆕 จำนวนสูงสุดที่ยังเบิกได้ต่อแถว (จาก remaining_quantity ของ /issuable-items ตอนโหลด) — key ด้วย _rowId
  // เดียวกับที่ loadFromDocument ตั้งให้ (= id ของแถวในใบเสนอราคา) ใช้เช็คตอนผู้ใช้แก้จำนวนเอง ห้ามเกินเด็ดขาด
  const [maxQtyByRowId, setMaxQtyByRowId] = useState<Record<string, number>>({});
  const [exceedWarning, setExceedWarning] = useState<{ index: number; productName: string; max: number } | null>(null);

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
        typeof p === "string"
          ? p === "create_material_issue"
          : p?.name === "create_material_issue",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        fetchMasterData();
      } else {
        toast.error("คุณไม่มีสิทธิ์สร้างเอกสาร");
        router.replace("/sales/material-issues");
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
    setIsLockedToQuotation(false);
    setMaxQtyByRowId({});
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

  // 🆕 [2026-09-17] มาจากโครงการแล้วยังไม่ได้เลือกใบเสนอราคาที่จะเบิก — ผู้ใช้บางคนไม่รู้ว่าต้องเลือกอะไรต่อ
  // เลื่อนจอไปที่ช่องนี้ + ขึ้นกรอบแดงพร้อมข้อความเตือนอัตโนมัติครั้งเดียวตอนโหลดโครงการเสร็จ (ดู referenceFieldRef)
  const referenceFieldRef = useRef<HTMLDivElement>(null);
  const referenceHintShownRef = useRef(false);
  useEffect(() => {
    if (
      prefillProjectId &&
      formData.project_id === prefillProjectId &&
      !formData.reference_document_id &&
      !referenceHintShownRef.current
    ) {
      referenceHintShownRef.current = true;
      setErrors((prev) => ({
        ...prev,
        reference_document_id: "กรุณาเลือกใบเสนอราคาที่จะเบิก",
      }));
      setTimeout(() => {
        referenceFieldRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 300);
    }
  }, [prefillProjectId, formData.project_id, formData.reference_document_id]);

  // 🚀 เลือกใบเสนอราคา มาโหลดเฉพาะรายการสินค้าที่ "ยังเบิกไม่ครบ" เข้าใบเบิก (ไม่แตะลูกค้า/โครงการที่เลือกไว้)
  // — ใช้ /issuable-items แทนการดึงเอกสารตรงๆ เพื่อหักจำนวนที่เบิกไปแล้วจากใบเบิกอื่นที่อ้างอิงใบเสนอราคาเดียวกัน
  const handleSelectQuotation = async (quotationId: string) => {
    if (!quotationId) return;
    setLoadingQuotation(true);
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(
        `${apiUrl}/sale-documents/${quotationId}/issuable-items`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        const issuableItems = data.data || [];
        if (issuableItems.length === 0) {
          toast.error("ใบเสนอราคานี้เบิกสินค้าครบทุกรายการแล้ว");
          return;
        }
        loadFromDocument(
          issuableItems.map((item: any) => ({
            ...item,
            quantity: item.remaining_quantity,
          })),
        );
        // 🆕 เก็บจำนวนสูงสุดที่ยังเบิกได้ต่อแถวไว้เช็คตอนแก้จำนวนเอง (ดู handleChangeField ด้านล่าง) — key ด้วย
        // source_item_id (= id แถวในใบเสนอราคาจริง) ไม่ใช่ _rowId เพราะ _rowId เป็นแค่ค่าที่บังเอิญตรงกันตอน
        // preview ก่อนบันทึกเท่านั้น ผูกกับความหมายจริงน้อยกว่า
        setMaxQtyByRowId(
          Object.fromEntries(
            issuableItems.map((item: any) => [String(item.source_item_id ?? item.id), Number(item.remaining_quantity)]),
          ),
        );
        setFormData((prev) => ({
          ...prev,
          reference_document_id: quotationId,
        }));
        setIsLockedToQuotation(true);
        toast.success("โหลดรายการสินค้าคงเหลือจากใบเสนอราคาสำเร็จ — ราคาล็อกตามใบเสนอราคา ปรับได้เฉพาะจำนวน");
      } else {
        toast.error("โหลดข้อมูลจากใบเสนอราคาไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("โหลดข้อมูลจากใบเสนอราคาไม่สำเร็จ");
    } finally {
      setLoadingQuotation(false);
    }
  };

  // 🆕 มาจากปุ่ม "เบิกเพิ่ม" (?quotation_id=) — ดึงโครงการของใบเสนอราคานั้นมาตั้งค่าก่อน (เหมือนผู้ใช้เลือกโครงการเอง
  // ปกติ ทำให้ลูกค้า auto-fill ตาม project ถ้ามี) แล้วค่อยโหลดรายการคงเหลือจากใบเสนอราคาต่อทันที รันครั้งเดียวตอนเปิดหน้า
  useEffect(() => {
    if (!prefillQuotationId) return;
    (async () => {
      try {
        const token = getToken();
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
        const res = await fetch(`${apiUrl}/sale-documents/${prefillQuotationId}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          const projectId = data.data?.project_id ? String(data.data.project_id) : "";
          if (projectId) await handleProjectChange(projectId);
        }
      } catch (error) {}
      handleSelectQuotation(prefillQuotationId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillQuotationId]);

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

  // 🧠 เลขที่เอกสารตัวอย่าง (Auto) ให้เห็นก่อนบันทึกจริง เหมือนหน้าใบเสนอราคา/ใบสั่งซื้อ — เลขจริงรันตอนกดบันทึกเท่านั้น
  const documentNumberPreview = useMemo(() => {
    let prefix = "MI";
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
      prefix = settings?.docs?.material_issue?.prefix || "MI";
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

  // 🆕 สกัดกั้นก่อนจะแก้จำนวนแถวที่ล็อกตามใบเสนอราคา — ถ้าเกินจำนวนที่ยังเบิกได้จริง (max ณ ตอนโหลด) บล็อกไว้เลย
  // ไม่ปล่อยให้เกินเด็ดขาด (ยืนยันกับผู้ใช้แล้ว) แล้วเด้ง modal เตือนแทน ฟิลด์อื่น/แถวที่ไม่ได้ล็อกผ่านตามปกติ
  const handleChangeField = (index: number, field: string, value: string | number) => {
    if (field === "quantity" && isLockedToQuotation) {
      const row = items[index];
      const max = row.source_item_id !== null && row.source_item_id !== undefined
        ? maxQtyByRowId[String(row.source_item_id)]
        : undefined;
      if (max !== undefined && Number(value) > max) {
        setExceedWarning({ index, productName: row.product_name || row.item_name || "-", max });
      }
    }
    updateItem(index, field, value);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.contact_id) newErrors.contact_id = "กรุณาเลือกลูกค้า";
    if (!formData.warehouse_id)
      newErrors.warehouse_id = "กรุณาเลือกคลังสินค้า";
    if (items.some((i) => !i.product_id))
      newErrors.items = "กรุณาเลือกสินค้าให้ครบทุกแถว";
    // 🆕 บังคับเลือก S/N ให้ครบตามจำนวนสำหรับสินค้าที่คุม S/N ทุกแถว — ย้ายจุดบังคับมาจากใบจัดสินค้าเดิม
    else if (
      items.some(
        (i) => i.has_serial_number && (i.serials?.length || 0) !== i.quantity,
      )
    )
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

  if (!isAuthorized) return <AppLoading text="กำลังตรวจสอบสิทธิ์การเข้าใช้งาน..." variant="bar" minHeight="min-h-screen" className="bg-muted/50" />;

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
            <p className="text-muted-foreground text-[11px] mt-0.5">
              เบิกสินค้าใช้ในโครงการ — ตัดสต๊อกจริงเมื่ออนุมัติ
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 p-5 border border-border rounded-xl bg-muted/50">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              โครงการ (Project)
            </label>
            <AppSelect
              value={formData.project_id || "__none__"}
              onValueChange={(v) =>
                handleProjectChange(v === "__none__" ? "" : v)
              }
              options={[
                { value: "__none__", label: "-- ไม่ระบุโครงการ --" },
                ...projects
                  .filter((p) => p.status !== "completed" || String(p.id) === formData.project_id)
                  .map((p) => ({
                    value: String(p.id),
                    label: p.name,
                  })),
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
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
          <div ref={referenceFieldRef}>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
              อ้างอิงใบเสนอราคา (โหลดรายการสินค้า)
              {loadingQuotation && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
            </label>
            <AppSelect
              value={formData.reference_document_id || "__none__"}
              onValueChange={(v) => {
                if (v !== "__none__") {
                  handleSelectQuotation(v);
                  setErrors((prev) => ({ ...prev, reference_document_id: "" }));
                }
              }}
              disabled={loadingQuotation}
              error={!!errors.reference_document_id}
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
            {errors.reference_document_id && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.reference_document_id}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              คลังสินค้า <span className="text-red-500">*</span>
            </label>
            <AppSelect
              value={formData.warehouse_id || undefined}
              error={!!errors.warehouse_id}
              onValueChange={(v) => {
                setFormData({
                  ...formData,
                  warehouse_id: v,
                });
                setErrors((prev) => ({ ...prev, warehouse_id: "" }));
              }}
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
        </div>

        {errors.items && (
          <p className="text-red-500 text-xs font-medium mb-2">
            {errors.items}
          </p>
        )}
        <SaleDocumentItemsTable
          items={items}
          hasError={!!errors.items}
          readOnly={isLockedToQuotation}
          partialLock={isLockedToQuotation}
          onSelectProduct={(index, productData) => {
            selectProduct(index, productData);
            setErrors((prev) => ({ ...prev, items: "", reference_document_id: "" }));
          }}
          onChangeField={handleChangeField}
          onAdd={addItem}
          onRemove={removeItem}
          showSerialPicker
          onOpenSerialPicker={(index) => setSerialPickerIndex(index)}
        />

        <div>
          <label className="block text-sm font-bold text-foreground mb-2">
            หมายเหตุ
          </label>
          <textarea
            rows={3}
            className="w-full p-4 rounded-2xl border border-border outline-none text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-muted/50 focus:bg-background"
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          />
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

      {exceedWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center transform animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-[6px] bg-amber-50 text-amber-600 border-amber-100/50">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              จำนวนเกินที่เบิกได้
            </h3>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              สินค้า <span className="font-bold text-foreground">{exceedWarning.productName}</span> เบิกได้ไม่เกิน{" "}
              <span className="font-bold text-foreground">{exceedWarning.max}</span> หน่วยตามใบเสนอราคานี้ —
              เกินจำนวนคงเหลือที่ยังเบิกได้จริง กรุณากรอกใหม่
            </p>
            <button
              type="button"
              onClick={() => {
                if (exceedWarning) updateItem(exceedWarning.index, "quantity", exceedWarning.max);
                setExceedWarning(null);
              }}
              className="w-full py-3 rounded-full text-white font-bold shadow-lg bg-amber-600 hover:bg-amber-700 shadow-amber-600/20 transition-all cursor-pointer"
            >
              เข้าใจแล้ว
            </button>
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
          allowFileImport
          onConfirm={(serials) => updateItemSerials(serialPickerIndex, serials)}
        />
      )}
    </div>
  );
}
