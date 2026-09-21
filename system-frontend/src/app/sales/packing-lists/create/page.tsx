"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PackageCheck,
  Save,
  ArrowLeft,
  Loader2,
  FileText,
  XCircle,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";
import { SaleDocumentItemsTable } from "@/components/sales/SaleDocumentItemsTable";
import { useSaleDocumentItems } from "@/hooks/useSaleDocumentItems";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

interface ProjectOption {
  id: number;
  name: string;
  contact_id: number | null;
  status?: string;
}

interface MaterialIssueOption {
  id: number;
  document_number: string;
  issue_date: string;
  warehouse_id?: number | null;
  contact?: {
    business_name?: string;
    contact_person_name?: string;
    name?: string;
  } | null;
}

export default function PackingListCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillProjectId = searchParams.get("project_id");
  // 🆕 [2026-09-20] มาจากปุ่ม "จัดสินค้า" ในหน้ารายการใบจัดสินค้า — เลือกใบเบิกสินค้านี้ให้อัตโนมัติ
  const prefillMaterialIssueId = searchParams.get("material_issue_id");
  const prefillMaterialIssueAppliedRef = useRef(false);

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [materialIssues, setMaterialIssues] = useState<MaterialIssueOption[]>(
    [],
  );
  // 🎯 material_issue id ที่ "มีใบจัดสินค้าอยู่แล้ว" (ไม่นับใบที่ถูกยกเลิก) — ตัดออกจาก dropdown เพื่อกันเลือกซ้ำ
  // (บังคับจาก backend อยู่แล้ว แต่กรองที่นี่ด้วยกันผู้ใช้เสียเวลาเลือกแล้วโดนปฏิเสธ) — เช็คทั้ง reference_document_id
  // ตัวแทนเดิม (ใบจัดสินค้าเก่าก่อนรองรับหลายใบ) และ material_issue_refs pivot ตัวเต็ม (ใบจัดสินค้าใหม่ที่อาจรวม
  // มากกว่า 1 ใบเบิก) ดู SaleDocumentController::index()/store()
  const [claimedMaterialIssueIds, setClaimedMaterialIssueIds] = useState<
    Set<number>
  >(new Set());
  const [loadingMaterialIssue, setLoadingMaterialIssue] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    document_type: "packing_list",
    contact_id: "",
    project_id: "",
    warehouse_id: "",
    issue_date: dayjs().format("YYYY-MM-DD"),
    note: "",
  });

  // 🆕 [2026-09-15] เลือกใบเบิกสินค้าที่อนุมัติแล้วได้หลายใบพร้อมกัน (กรณีใบเบิกค้างเบิกมากกว่า 1 ใบในโครงการเดียวกัน)
  // — เก็บเอกสารเต็มที่เลือกไว้ทั้งหมด (ใช้ทั้งแสดงรายการที่เลือก + คำนวณ merge ใหม่ทุกครั้งที่เพิ่ม/ลบ) มิเรอร์ pattern
  // เดียวกับ tax-invoices/create/page.tsx แต่ไม่บังคับต้องมาจากใบเสนอราคาเดียวกัน (ใบจัดสินค้าไม่มีเรื่องราคาเกี่ยวข้อง
  // เลย) บังคับแค่ต้องมาจากคลังสินค้าเดียวกันเท่านั้น (เช็คตอนเพิ่ม — backend เช็คซ้ำอีกชั้นตอนบันทึกด้วย)
  const [selectedMaterialIssues, setSelectedMaterialIssues] = useState<any[]>([]);

  const {
    items,
    loadFromDocument,
    buildPayload,
  } = useSaleDocumentItems();

  // 🆕 รวมสินค้าชนิดเดียวกันจากใบเบิกหลายใบเข้าแถวเดียว บวกจำนวนกัน — จับคู่ด้วย product_id ตรงๆ เท่านั้น (ไม่สนใจ
  // ใบเสนอราคาต้นทาง/ราคา เพราะใบจัดสินค้าไม่มีเรื่องราคาเกี่ยวข้องเลย ต่างจาก tax-invoices/create ที่ต้องจับคู่ด้วย
  // source_item_id เพื่อรักษาราคาที่ล็อกมาจากใบเสนอราคา) ต้องตรงกับ logic ฝั่ง backend (SaleDocumentController::store())
  // เป๊ะๆ เพราะนี่แค่ preview ก่อนบันทึกจริง
  const mergePackingListItems = (docs: any[]) => {
    const groups = new Map<string, any>();
    const order: string[] = [];
    docs.forEach((doc) => {
      (doc.items || []).forEach((item: any) => {
        // 🆕 [2026-09-20] รายการบริการ (service เช่น ค่าติดตั้ง) ไม่มีของให้จัด — ไม่โหลดเข้าใบจัดสินค้า (ตรงกับ backend store())
        if (item.product?.product_type === "service") return;
        const key = `pl:${item.product_id}`;
        if (!groups.has(key)) {
          groups.set(key, {
            id: item.id,
            product_id: item.product_id,
            product: item.product,
            item_name: item.item_name,
            unit_name: item.unit_name,
            unit_price: item.unit_price,
            cost_price: item.cost_price,
            has_serial_number: item.has_serial_number ?? item.product?.has_serial_number,
            quantity: 0,
            discount_amount: 0,
            serials: [] as any[],
          });
          order.push(key);
        }
        const g = groups.get(key);
        g.quantity += Number(item.quantity) || 0;
        g.discount_amount += Number(item.discount_amount) || 0;
        g.serials = [...g.serials, ...(item.serials || [])];
      });
    });
    return order.map((key) => {
      const g = groups.get(key);
      return { ...g, total_price: g.quantity * g.unit_price - g.discount_amount };
    });
  };

  const applyMaterialIssueSelection = (docs: any[]) => {
    setSelectedMaterialIssues(docs);
    if (docs.length === 0) {
      setFormData((prev) => ({ ...prev, contact_id: "", warehouse_id: "" }));
      setSelectedContact(null);
      loadFromDocument([]);
      return;
    }
    const first = docs[0];
    setFormData((prev) => ({
      ...prev,
      contact_id: first.contact_id ? String(first.contact_id) : "",
      warehouse_id: first.warehouse_id ? String(first.warehouse_id) : "",
    }));
    setSelectedContact(first.contact || null);
    const merged = mergePackingListItems(docs);
    loadFromDocument(merged);
    if (merged.length === 0) {
      toast.warning("ใบเบิกสินค้าที่เลือกมีแต่รายการบริการ ไม่ต้องจัดสินค้า");
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
        typeof p === "string"
          ? p === "create_packing_list"
          : p?.name === "create_packing_list",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        fetchMasterData();
      } else {
        toast.error("คุณไม่มีสิทธิ์สร้างเอกสาร");
        router.replace("/sales/packing-lists");
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
      const [projectsRes, warehousesRes, companyRes] = await Promise.all([
        fetch(`${apiUrl}/projects`, { headers }).catch(() => null),
        fetch(`${apiUrl}/warehouses`, { headers }).catch(() => null),
        fetch(`${apiUrl}/company`, { headers }),
      ]);
      if (projectsRes && projectsRes.ok) {
        const pData = await projectsRes.json();
        setProjects(Array.isArray(pData) ? pData : pData?.data || []);
      }
      if (warehousesRes && warehousesRes.ok) {
        const wData = await warehousesRes.json();
        setWarehouses(Array.isArray(wData) ? wData : wData?.data || []);
      }
      if (companyRes.ok) {
        const compData = await companyRes.json();
        setCompanySettings(
          Array.isArray(compData) ? compData[0] : compData.data || compData,
        );
      }
    } catch (error) {}
  };

  // 🚀 ดึงใบเบิกสินค้าที่อนุมัติแล้วของโครงการนี้ + ใบจัดสินค้าที่มีอยู่แล้ว (ทุกสถานะ) เพื่อตัดใบเบิกที่ "มีใบจัดสินค้า
  // แล้ว" (ยกเว้นใบที่ถูกยกเลิก) ออกจากตัวเลือก (ดู SaleDocumentController::store())
  // 🆕 [2026-09-15] เช็คทั้ง reference_document_id ตัวแทนเดิม และ material_issue_refs pivot ตัวเต็ม — ใบจัดสินค้า
  // ใหม่อาจรวมมากกว่า 1 ใบเบิกไว้ในเอกสารเดียว ซึ่ง reference_document_id เก็บได้แค่ใบแรกใบเดียว
  const fetchMaterialIssues = async (projectId: string) => {
    setMaterialIssues([]);
    setClaimedMaterialIssueIds(new Set());
    if (!projectId) return;
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };
      const [issuesRes, packingListsRes] = await Promise.all([
        fetch(
          `${apiUrl}/sale-documents?type=material_issue&status=Approved&project_id=${projectId}`,
          { headers },
        ),
        fetch(
          `${apiUrl}/sale-documents?type=packing_list&project_id=${projectId}`,
          { headers },
        ),
      ]);
      if (issuesRes.ok) {
        const data = await issuesRes.json();
        setMaterialIssues(Array.isArray(data) ? data : data.data || []);
      }
      if (packingListsRes.ok) {
        const data = await packingListsRes.json();
        const list = Array.isArray(data) ? data : data.data || [];
        const claimed = new Set<number>();
        list
          .filter((pl: any) => pl.status !== "Cancelled")
          .forEach((pl: any) => {
            if (pl.reference_document_id) claimed.add(pl.reference_document_id);
            (pl.material_issue_refs || []).forEach((ref: any) =>
              claimed.add(ref.material_issue_id),
            );
          });
        setClaimedMaterialIssueIds(claimed);
      }
    } catch (error) {}
  };

  // 🚀 เลือกโครงการแล้วดึงใบเบิกสินค้าที่อนุมัติแล้วของโครงการนั้นมาให้เลือก (ไม่ auto-fill ลูกค้าเหมือนหน้าอื่น เพราะ
  // ลูกค้า/คลังสินค้าของใบจัดสินค้านี้ต้องมาจากใบเบิกที่เลือกเท่านั้น ดู handleAddMaterialIssue ด้านล่าง)
  const handleProjectChange = (projectId: string) => {
    setFormData((prev) => ({
      ...prev,
      project_id: projectId,
      contact_id: "",
      warehouse_id: "",
    }));
    setSelectedContact(null);
    setSelectedMaterialIssues([]);
    loadFromDocument([]);
    fetchMaterialIssues(projectId);
  };

  useEffect(() => {
    if (prefillProjectId && projects.length > 0 && !formData.project_id) {
      handleProjectChange(prefillProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillProjectId, projects]);

  // 🆕 [2026-09-17] มาจากโครงการแล้วยังไม่ได้เลือกใบเบิกสินค้าที่จะจัด — ผู้ใช้บางคนไม่รู้ว่าต้องเลือกอะไรต่อ
  // เลื่อนจอไปที่ช่องนี้ + ขึ้นกรอบแดงพร้อมข้อความเตือนอัตโนมัติครั้งเดียวตอนโหลดโครงการเสร็จ
  const referenceFieldRef = useRef<HTMLDivElement>(null);
  const referenceHintShownRef = useRef(false);
  useEffect(() => {
    if (
      prefillProjectId &&
      formData.project_id === prefillProjectId &&
      selectedMaterialIssues.length === 0 &&
      !prefillMaterialIssueId &&
      !referenceHintShownRef.current
    ) {
      referenceHintShownRef.current = true;
      setErrors((prev) => ({
        ...prev,
        material_issue_ids: "กรุณาเลือกใบเบิกสินค้าอย่างน้อย 1 ใบ",
      }));
      setTimeout(() => {
        referenceFieldRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 300);
    }
  }, [prefillProjectId, formData.project_id, selectedMaterialIssues.length]);

  // 🎯 เพิ่มใบเบิกสินค้าที่อนุมัติแล้วเข้าชุดที่เลือกไว้ (เลือกได้หลายใบพร้อมกัน) — โหลดเอกสารเต็มมาตรวจคลังสินค้าให้
  // ตรงกับใบอื่นที่เลือกไว้ก่อน (ถ้ามี) แล้ว merge รายการสินค้าชนิดเดียวกันเข้าแถวเดียวบวกจำนวนกัน — S/N เปิดให้เลือก
  // ต่อได้ทันที (จุดประสงค์หลักของหน้านี้) เหมือนเดิมทุกประการ
  const handleAddMaterialIssue = async (materialIssueId: string) => {
    if (!materialIssueId) return;
    setLoadingMaterialIssue(true);
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/sale-documents/${materialIssueId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) {
        toast.error("โหลดข้อมูลจากใบเบิกสินค้าไม่สำเร็จ");
        return;
      }
      const data = await res.json();
      const doc = data.data;

      const firstExisting = selectedMaterialIssues[0];
      if (firstExisting && String(firstExisting.warehouse_id || "") !== String(doc.warehouse_id || "")) {
        toast.error("ใบเบิกสินค้าที่เลือกต้องมาจากคลังสินค้าเดียวกันเท่านั้น");
        return;
      }

      const next = [...selectedMaterialIssues, doc];
      applyMaterialIssueSelection(next);
      setErrors((prev) => ({ ...prev, material_issue_ids: "" }));
      toast.success(`โหลดรายการจาก ${doc.document_number} สำเร็จ`);
    } catch (error) {
      toast.error("โหลดข้อมูลจากใบเบิกสินค้าไม่สำเร็จ");
    } finally {
      setLoadingMaterialIssue(false);
    }
  };

  const handleRemoveMaterialIssue = (materialIssueId: number) => {
    const next = selectedMaterialIssues.filter((d) => d.id !== materialIssueId);
    applyMaterialIssueSelection(next);
  };

  // 🆕 มาจากปุ่ม "จัดสินค้า" (?material_issue_id=) — พอโหลดโครงการ+รายการใบเบิกของโครงการเสร็จ เลือกใบเบิกนั้นให้เลยครั้งเดียว
  useEffect(() => {
    if (!prefillMaterialIssueId || prefillMaterialIssueAppliedRef.current) return;
    if (formData.project_id !== prefillProjectId) return;
    if (!materialIssues.some((mi) => String(mi.id) === prefillMaterialIssueId)) return;
    prefillMaterialIssueAppliedRef.current = true;
    handleAddMaterialIssue(prefillMaterialIssueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillMaterialIssueId, prefillProjectId, formData.project_id, materialIssues]);

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
    if (selectedMaterialIssues.length === 0) {
      toast.error("กรุณาเลือกใบเบิกสินค้าก่อน");
      return;
    }
    const toastId = toast.loading("กำลังสร้างตัวอย่างเอกสาร...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: SalesPdfTemplate } =
        await import("@/components/documents/SalesPdfTemplate");
      const { paperSize, letterLayout } = getPaperSizeConfig(
        companySettings,
        "packing_list",
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
    if (selectedMaterialIssues.length === 0)
      newErrors.material_issue_ids = "กรุณาเลือกใบเบิกสินค้าอย่างน้อย 1 ใบ";
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
        material_issue_ids: selectedMaterialIssues.map((d) => d.id),
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
      router.push("/sales/packing-lists");
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
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              สร้างใบจัดสินค้า
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              เลือกใบเบิกสินค้าที่อนุมัติแล้ว — รายการสินค้า/S-N สืบทอดมาจากใบเบิกสินค้าโดยตรง
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-5 p-5 border border-border rounded-xl bg-muted/50">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              โครงการ <span className="text-red-500">*</span>
            </label>
            <AppSelect
              value={formData.project_id || undefined}
              onValueChange={(v) => handleProjectChange(v)}
              options={projects
                .filter((p) => p.status !== "completed" || String(p.id) === formData.project_id)
                .map((p) => ({
                  value: String(p.id),
                  label: p.name,
                }))}
            />
          </div>
          <div className="md:col-span-2" ref={referenceFieldRef}>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
              ใบเบิกสินค้าที่อนุมัติแล้ว <span className="text-red-500">*</span>
              {loadingMaterialIssue && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
            </label>
            <div className={`border rounded-xl overflow-hidden ${errors.material_issue_ids ? "border-red-500" : "border-border"}`}>
              {selectedMaterialIssues.length > 0 && (
                <div className="divide-y divide-border bg-background">
                  {selectedMaterialIssues.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">
                        {d.document_number}{" "}
                        <span className="text-muted-foreground font-normal">
                          ({dayjs(d.issue_date).format("DD/MM/YYYY")})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMaterialIssue(d.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-2 bg-muted/50 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="flex-1">
                  <AppSelect
                    value="__none__"
                    onValueChange={handleAddMaterialIssue}
                    disabled={!formData.project_id || loadingMaterialIssue}
                    triggerClassName="h-9 bg-background"
                    options={[
                      {
                        value: "__none__",
                        label: !formData.project_id
                          ? "-- เลือกโครงการก่อน --"
                          : "-- เพิ่มใบเบิกสินค้า (เลือกได้หลายใบ) --",
                      },
                      ...materialIssues
                        .filter(
                          (mi) =>
                            !claimedMaterialIssueIds.has(mi.id) &&
                            !selectedMaterialIssues.some((s) => s.id === mi.id),
                        )
                        .map((mi) => ({
                          value: String(mi.id),
                          label: `${mi.document_number} - ${mi.contact?.business_name || mi.contact?.contact_person_name || mi.contact?.name || ""} (${dayjs(mi.issue_date).format("DD/MM/YYYY")})`,
                        })),
                    ]}
                  />
                </div>
              </div>
            </div>
            {selectedMaterialIssues.length > 1 && (
              <p className="text-muted-foreground text-[11px] mt-1">
                สินค้าชนิดเดียวกันจากใบเบิกที่เลือกจะถูกรวมเป็นแถวเดียวในรายการด้านล่าง
              </p>
            )}
            {errors.material_issue_ids && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.material_issue_ids}
              </p>
            )}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              ลูกค้า (ตามใบเบิกสินค้า)
            </label>
            <input
              type="text"
              disabled
              className="w-full h-10 px-4 text-sm rounded-xl border border-border bg-muted text-muted-foreground font-medium outline-none cursor-not-allowed"
              value={
                selectedContact
                  ? selectedContact.business_name || selectedContact.name || ""
                  : "-- เลือกใบเบิกสินค้าก่อน --"
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              คลังสินค้า <span className="text-red-500">*</span> (ตามใบเบิกสินค้า)
            </label>
            <AppSelect
              value={formData.warehouse_id}
              disabled
              onValueChange={() => {}}
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
          hidePricing
          onSelectProduct={() => {}}
          onChangeField={() => {}}
          onAdd={() => {}}
          onRemove={() => {}}
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
    </div>
  );
}
