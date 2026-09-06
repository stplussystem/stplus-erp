"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShoppingCart,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Search,
  ChevronDown,
  FileText,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { ProductSearchDropdown } from "@/components/products/ProductSearchDropdown";
import { getToken, getStoredUser } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { calculatePurchaseOrderFinance } from "@/lib/purchaseOrderFinance";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

export default function CreatePurchaseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillProjectId = searchParams.get("project_id");

  // 📦 ข้อมูล Master Data
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);

  // 🔍 State สำหรับ Custom Dropdown ค้นหาผู้จำหน่าย
  const [selectedContact, setSelectedContact] = useState<any>(null);

  // 👁️ State สำหรับการเปิด Preview PDF แท้ผ่าน Iframe (สไตล์ PWA)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 💰 แก้ subtotal/VAT เองได้ (ปัดเศษ/ให้ตรงกับผู้ขาย) — ว่าง = ใช้ค่าที่คำนวณอัตโนมัติ
  const [subtotalOverride, setSubtotalOverride] = useState("");
  const [vatAmountOverride, setVatAmountOverride] = useState("");

  // 📝 State หัวบิล
  const [formData, setFormData] = useState({
    contact_id: "",
    project_id: "",
    warehouse_id: "",
    reference_number: "",
    expected_date: dayjs().format("YYYY-MM-DD"),
    credit_days: 0,
    currency: "THB",
    tax_type: "exclude",
    discount_amount: 0, // ส่วนลดท้ายบิล
    note: "",
  });

  // 🛒 State รายการสินค้า
  const [items, setItems] = useState([
    {
      product_id: "",
      product_name: "",
      sku: "",
      quantity: 1,
      unit_name: "ชิ้น",
      unit_price: 0,
      discount_amount: 0,
      wht_rate: 0,
      total_price: 0,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 🏗️ เพิ่มโครงการใหม่แบบเร็ว (Quick Add)
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [addingProjectLoading, setAddingProjectLoading] = useState(false);

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    try {
      const token = getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };

      const [warehousesRes, companyRes, projectsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/warehouses`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/company`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects`, { headers }).catch(
          () => null,
        ),
      ]);

      if (warehousesRes.ok) {
        const wData = await warehousesRes.json();
        setWarehouses(Array.isArray(wData) ? wData : wData.data || []);
      }
      if (projectsRes && projectsRes.ok) {
        const projData = await projectsRes.json();
        setProjects(Array.isArray(projData) ? projData : projData.data || []);
      }
      if (companyRes.ok) {
        const compData = await companyRes.json();
        const companyObj = Array.isArray(compData)
          ? compData[0]
          : compData.data || compData;
        setCompanySettings(companyObj);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  // 🚀 เติมโครงการอัตโนมัติเมื่อมาจากปุ่ม "สร้างใหม่" ในหน้า Project Hub (?project_id=)
  // หมายเหตุ: ไม่เติม contact_id ให้ เพราะที่นี่ contact คือผู้จำหน่าย (supplier) ไม่ใช่ลูกค้าของโครงการ
  useEffect(() => {
    if (prefillProjectId && projects.length > 0 && !formData.project_id) {
      setFormData((prev) => ({ ...prev, project_id: prefillProjectId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillProjectId, projects]);

  // 🏗️ เพิ่มโครงการใหม่แบบเร็ว (Quick Add) — ตอนนี้ไม่มีหน้าจัดการโครงการแยกต่างหาก
  // เลยเปิดช่องให้พิมพ์เพิ่มตรงนี้ได้เลย กันดรอปดาวน์ว่างเปล่าถาวร
  const handleAddProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;

    setAddingProjectLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "เพิ่มโครงการไม่สำเร็จ");

      setProjects((prev) => [...prev, data.data]);
      setFormData((prev) => ({ ...prev, project_id: String(data.data.id) }));
      setNewProjectName("");
      setIsAddingProject(false);
      toast.success("เพิ่มโครงการสำเร็จ");
    } catch (error: any) {
      toast.error(error.message || "เพิ่มโครงการไม่สำเร็จ");
    } finally {
      setAddingProjectLoading(false);
    }
  };

  // const filteredContacts = contacts.filter(
  //   (c) =>
  //     (c.business_name?.toLowerCase() || "").includes(
  //       supplierSearch.toLowerCase(),
  //     ) ||
  //     (c.contact_code?.toLowerCase() || "").includes(
  //       supplierSearch.toLowerCase(),
  //     ) ||
  //     (c.tax_id || "").includes(supplierSearch),
  // );

  // const handleContactSelect = (contact: any) => {
  //   setFormData({ ...formData, contact_id: contact.id.toString() });
  //   setSelectedContact(contact);
  //   setIsSupplierOpen(false);
  //   setSupplierSearch("");
  // };

  // 🧮 จัดการรายการสินค้า
  const handleItemChange = (
    index: number,
    field: string,
    value: string | number,
  ) => {
    const newItems = [...items];

    // 🚀 จุดสำคัญ: ยกเว้น unit_name ให้พิมพ์เป็นข้อความได้ตามต้องการ ไม่โดนแปลงเป็น Number
    const val =
      field === "product_id" || field === "unit_name"
        ? value
        : Number(value) || 0;
    newItems[index] = { ...newItems[index], [field]: val };

    newItems[index].total_price =
      newItems[index].quantity * newItems[index].unit_price -
      newItems[index].discount_amount;
    setItems(newItems);
  };

  // 💰 คำนวณการเงินระบบส่วนลดท้ายบิลแบบใหม่ครบวงจร — ใช้ util กลางร่วมกับหน้าแก้ไข/list/view
  const finance = useMemo(
    () =>
      calculatePurchaseOrderFinance({
        items,
        taxType: formData.tax_type,
        discountAmount: formData.discount_amount,
        subtotalOverride:
          subtotalOverride === "" ? undefined : Number(subtotalOverride),
        vatAmountOverride:
          vatAmountOverride === "" ? undefined : Number(vatAmountOverride),
      }),
    [
      items,
      formData.tax_type,
      formData.discount_amount,
      subtotalOverride,
      vatAmountOverride,
    ],
  );

  const poNumberPreview = useMemo(() => {
    let prefix = "PO";
    let prefixSep = "-";
    let dateSep = "-";
    let datePattern = "YYMM";

    if (companySettings && companySettings.document_settings) {
      let settings = companySettings.document_settings;
      if (typeof settings === "string") {
        try {
          settings = JSON.parse(settings);
        } catch (e) {
          settings = {};
        }
      }
      prefix = settings?.docs?.purchase_order?.prefix || "PO";
      prefixSep =
        settings?.format?.prefixSeparator === "none"
          ? ""
          : settings?.format?.prefixSeparator || "-";
      dateSep =
        settings?.format?.dateSeparator === "none"
          ? ""
          : settings?.format?.dateSeparator || "-";
      datePattern = settings?.format?.datePattern || "YYMM";

      // 🏷️ ตัวย่อนำหน้าบริษัทเสริม (เช่น "ST") — ตั้งค่าเดียวใช้กับทุกประเภทเอกสารเหมือนกันหมด
      if (
        settings?.format?.companyPrefixEnabled &&
        settings?.format?.companyPrefixText
      ) {
        prefix = `${settings.format.companyPrefixText}${prefixSep}${prefix}`;
      }
    }

    const d = dayjs(formData.expected_date);
    let dateStr = "";
    if (datePattern === "YYYYMMDD") dateStr = d.format("YYYYMMDD");
    else if (datePattern === "YYYYMM") dateStr = d.format("YYYYMM");
    else if (datePattern === "YYMM") dateStr = d.format("YYMM");
    else if (datePattern === "YYYY") dateStr = d.format("YYYY");

    return `${prefix}${prefixSep}${dateStr}${dateSep}Auto`;
  }, [formData.expected_date, companySettings]);

  // 🧠 ยิงสร้าง PDF สไตล์ PWA (เปิด iframe ในหน้าเดิม 100%)
  const handlePreviewPDF = async () => {
    if (!formData.contact_id) {
      toast.error("กรุณาเลือกผู้จำหน่ายก่อนดูตัวอย่าง");
      return;
    }
    const toastId = toast.loading("กำลังสร้างตัวอย่างเอกสาร...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: POPdfTemplate } =
        await import("@/components/documents/POPdfTemplate");

      // 🚀 ตอนสร้าง PO ยังไม่มี creator/approver จาก backend (ยังไม่ถูกบันทึก) เลยหยิบข้อมูล
      // ผู้ใช้ที่ล็อกอินอยู่ตอนนี้ (จะกลายเป็นผู้จัดทำ) มาเติมชื่อ+ลายเซ็นเองแทน ไม่งั้นฝั่ง "ผู้จัดทำ" จะว่างเปล่าตลอด
      const currentUser = getStoredUser<any>()?.user;
      const { paperSize, letterLayout } = getPaperSizeConfig(
        companySettings,
        "purchase_order",
      );

      const pdfDataObj = {
        companySettings,
        formData: {
          ...formData,
          creator: currentUser
            ? {
                name: currentUser.name,
                signature_base64: currentUser.signature_base64,
              }
            : undefined,
        },
        selectedContact: selectedContact,
        items,
        products: [],
        finance,
        poNumber: poNumberPreview,
        footerCondition:
          "**กรุณาแนบใบสั่งซื้อทุกครั้งที่มีการส่งของ วางบิล หรือรับเช็ค**",
        paperSize,
        letterLayout,
      };

      const blob = await pdf(<POPdfTemplate data={pdfDataObj} />).toBlob();
      setPreviewUrl(URL.createObjectURL(blob));
      toast.dismiss(toastId);
    } catch (e) {
      toast.error("สร้างตัวอย่าง PDF ไม่สำเร็จ", { id: toastId });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.contact_id) newErrors.contact_id = "กรุณาเลือกผู้จำหน่าย";
    if (items.some((i) => !i.product_id))
      newErrors.items = "กรุณาเลือกสินค้าให้ครบทุกแถว";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveOnly = async () => {
    if (!validate()) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("กำลังบันทึกเอกสารลงระบบ...");

    try {
      const token = getToken();

      const payload = {
        ...formData,
        project_id: formData.project_id || null,
        warehouse_id: formData.warehouse_id || null,
        subtotal: finance.subtotal,
        vat_amount: finance.vat_amount,
        wht_amount: finance.wht_amount,
        grand_total: finance.grand_total,
        items: items.map((item) => ({
          ...item,
          wht_amount: item.total_price * (item.wht_rate / 100),
        })),
      };

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/purchase-orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        toast.error("เกิดข้อผิดพลาด", {
          id: toastId,
          description: err.message,
        });
        return;
      }

      toast.success("บันทึกเอกสารใบสั่งซื้อสำเร็จ!", { id: toastId });
      router.push("/purchase-orders");
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <AppLoading text="กำลังบันทึกเอกสาร..." minHeight="min-h-0" />
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              สร้างใบสั่งซื้อ (Create PO)
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              ระบุรายละเอียดผู้จำหน่ายและรายการสินค้า
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePreviewPDF}
            className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileText className="w-4 h-4 text-blue-600" /> ดูตัวอย่าง
          </button>

          {/* <Link href="/purchase-orders"> */}
          <button
            type="button"
            onClick={() => router.back()}
            className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" /> ยกเลิก
          </button>
          {/* </Link> */}

          <button
            type="button"
            onClick={handleSaveOnly}
            disabled={loading}
            className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            <Save className="w-4 h-4" />{" "}
            {loading ? "กำลังบันทึก..." : "บันทึกเอกสาร"}
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[500px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* ค้นหาผู้จำหน่าย */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ชื่อผู้จำหน่าย <span className="text-red-500">*</span>
            </label>
            <ContactSearchDropdown
              value={formData.contact_id}
              selectedName={
                selectedContact?.business_name || selectedContact?.contact_name
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

          {/* สรุปยอดหัวบิล */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-sm font-bold text-slate-500 mb-1">
                  เลขที่ใบสั่งซื้อ
                </div>
                <div className="inline-block bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-lg border border-blue-200">
                  {poNumberPreview}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-500 mb-1">
                  จำนวนเงินรวมทั้งสิ้น
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  {finance.grand_total.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  วันที่ออกเอกสาร
                </label>
                <AppDatePicker
                  value={formData.expected_date}
                  onChange={(value) =>
                    setFormData({ ...formData, expected_date: value })
                  }
                  placeholder="เลือกวันที่ออกเอกสาร"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  เครดิต (วัน)
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
          </div>
        </div>

        {/* ฟิลด์อ้างอิงตรงกลาง */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 border border-slate-200 rounded-xl bg-white">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              คลังสินค้าที่จะรับเข้า
            </label>
            <AppSelect
              value={formData.warehouse_id || "__none__"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  warehouse_id: value === "__none__" ? "" : value,
                })
              }
              placeholder="-- ไม่ระบุ --"
              options={[
                { value: "__none__", label: "-- ไม่ระบุ --" },
                ...warehouses.map((warehouse) => ({
                  value: String(warehouse.id),
                  label: warehouse.name,
                })),
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              โปรเจค (Project)
            </label>
            {isAddingProject ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="ชื่อโครงการใหม่..."
                  className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddProject();
                    }
                    if (e.key === "Escape") {
                      setIsAddingProject(false);
                      setNewProjectName("");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddProject}
                  disabled={addingProjectLoading}
                  className="h-10 px-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {addingProjectLoading ? "กำลังเพิ่ม..." : "เพิ่ม"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingProject(false);
                    setNewProjectName("");
                  }}
                  className="h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <AppSelect
                value={formData.project_id || "__none__"}
                onValueChange={(value) => {
                  if (value === "__add_new__") {
                    setIsAddingProject(true);
                    return;
                  }
                  setFormData({
                    ...formData,
                    project_id: value === "__none__" ? "" : value,
                  });
                }}
                placeholder="-- ไม่มีโปรเจค --"
                options={[
                  { value: "__none__", label: "-- ไม่มีโปรเจค --" },
                  ...projects.map((project) => ({
                    value: String(project.id),
                    label: project.name,
                  })),
                  { value: "__add_new__", label: "+ เพิ่มโครงการใหม่..." },
                ]}
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              เลขที่อ้างอิง
            </label>
            <input
              type="text"
              placeholder="เช่น อ้างอิงใบเสนอราคา"
              className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={formData.reference_number}
              onChange={(e) =>
                setFormData({ ...formData, reference_number: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              รูปแบบภาษี
            </label>
            <AppSelect
              value={formData.tax_type}
              onValueChange={(value) =>
                setFormData({ ...formData, tax_type: value })
              }
              triggerClassName="border-blue-500 bg-blue-50 font-medium text-blue-600 focus:ring-blue-100"
              options={[
                { value: "exclude", label: "ราคายังไม่รวมภาษี (Vat นอก)" },
                { value: "include", label: "ราคารวมภาษีแล้ว (Vat ใน)" },
                { value: "none", label: "ราคาไม่มีภาษี (Non-Vat)" },
              ]}
            />
          </div>
        </div>

        {/* 🛍️ ตารางรายการสินค้า */}
        {errors.items && (
          <p className="text-red-500 text-xs font-medium mb-2">
            {errors.items}
          </p>
        )}
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 w-10 text-center font-bold">#</th>
                <th className="px-3 py-3 font-bold">ชื่อสินค้า / รายละเอียด</th>
                <th className="px-3 py-3 w-20 text-center font-bold">จำนวน</th>
                <th className="px-3 py-3 w-24 text-center font-bold">หน่วย</th>
                <th className="px-3 py-3 w-28 text-right font-bold">
                  ราคาต่อหน่วย
                </th>
                <th className="px-3 py-3 w-24 text-right font-bold">ส่วนลด</th>
                <th className="px-3 py-3 w-28 text-center font-bold">
                  หัก ณ ที่จ่าย
                </th>
                <th className="px-3 py-3 w-32 text-right font-bold">ราคารวม</th>
                <th className="px-3 py-3 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50/50">
                  <td className="px-3 py-3 text-center text-slate-400">
                    {index + 1}
                  </td>
                  <td className="px-3 py-3">
                    <ProductSearchDropdown
                      value={item.product_id}
                      selectedSku={item.sku}
                      selectedName={item.product_name}
                      hasError={!!errors.items && !item.product_id}
                      onChange={(val, productData) => {
                        const newItems = [...items];
                        newItems[index] = {
                          ...newItems[index],
                          product_id: val,
                          product_name: productData.name,
                          sku: productData.sku,
                          unit_price: Number(productData.cost_price || 0), // ดึงราคาทุนมาหยอดอัตโนมัติ
                        };
                        newItems[index].total_price =
                          newItems[index].quantity *
                            newItems[index].unit_price -
                          newItems[index].discount_amount;
                        setItems(newItems);
                        setErrors((prev) => ({ ...prev, items: "" }));
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min="1"
                      className="w-full h-10 text-center border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm outline-none"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(index, "quantity", e.target.value)
                      }
                    />
                  </td>
                  {/* ช่องระบุหน่วยแบบพิมพ์อิสระ */}
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      placeholder="ชิ้น/กล่อง"
                      className="w-full h-10 text-center border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm outline-none"
                      value={item.unit_name}
                      onChange={(e) =>
                        handleItemChange(index, "unit_name", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min="0"
                      className="w-full h-10 text-right border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm outline-none"
                      value={item.unit_price}
                      onChange={(e) =>
                        handleItemChange(index, "unit_price", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min="0"
                      className="w-full h-10 text-right border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm text-red-500 outline-none"
                      value={item.discount_amount}
                      onChange={(e) =>
                        handleItemChange(
                          index,
                          "discount_amount",
                          e.target.value,
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <AppSelect
                      value={String(item.wht_rate)}
                      onValueChange={(value) =>
                        handleItemChange(index, "wht_rate", value)
                      }
                      triggerClassName="px-2"
                      options={[
                        { value: "0", label: "ไม่หัก" },
                        { value: "1", label: "หัก 1%" },
                        { value: "3", label: "หัก 3%" },
                        { value: "5", label: "หัก 5%" },
                      ]}
                    />
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-slate-700">
                    {item.total_price.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() =>
                        setItems(items.filter((_, i) => i !== index))
                      }
                      disabled={items.length === 1}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-2 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={() =>
                setItems([
                  ...items,
                  {
                    product_id: "",
                    quantity: 1,
                    unit_name: "ชิ้น",
                    unit_price: 0,
                    discount_amount: 0,
                    wht_rate: 0,
                    total_price: 0,
                  },
                ])
              }
              className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> เพิ่มรายการสินค้า
            </button>
          </div>
        </div>

        {/* หมายเหตุ & สรุปยอดเงินพร้อมช่องส่วนลดท้ายบิล */}
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div className="w-full md:w-1/2">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              หมายเหตุ
            </label>
            <textarea
              rows={4}
              className="w-full p-3 rounded-xl border border-slate-200 outline-none text-sm resize-none"
              placeholder="ระบุหมายเหตุเพิ่มเติม..."
              value={formData.note}
              onChange={(e) =>
                setFormData({ ...formData, note: e.target.value })
              }
            ></textarea>
          </div>

          <div className="w-full md:w-80 space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600">
            <div>
              <div className="flex justify-between items-center">
                <span>รวมเป็นเงิน (Subtotal)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-28 h-10 text-right px-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
                  placeholder={finance.itemSubtotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                  value={subtotalOverride}
                  onChange={(e) => setSubtotalOverride(e.target.value)}
                />
              </div>
              {finance.subtotalDiffersSignificantly && (
                <p className="text-amber-600 text-xs font-medium mt-1 text-right">
                  ต่างจากยอดที่คำนวณได้ (
                  {finance.itemSubtotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                  ) ค่อนข้างมาก
                </p>
              )}
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
              <div className="flex justify-between text-slate-700 font-medium border-t border-slate-200 pt-2">
                <span>ยอดหลังหักส่วนลด</span>
                <span>
                  {finance.after_discount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}

            {formData.tax_type !== "none" && (
              <div>
                <div className="flex justify-between items-center">
                  <span>
                    ภาษีมูลค่าเพิ่ม{" "}
                    {formData.tax_type === "include" ? "(รวมในยอด)" : "(7%)"}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-28 h-10 text-right px-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
                    placeholder={finance.computedVatAmount.toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )}
                    value={vatAmountOverride}
                    onChange={(e) => setVatAmountOverride(e.target.value)}
                  />
                </div>
                {finance.vatDiffersSignificantly && (
                  <p className="text-amber-600 text-xs font-medium mt-1 text-right">
                    ต่างจากยอดที่คำนวณได้ (
                    {finance.computedVatAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                    ) ค่อนข้างมาก
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-between text-base font-bold text-slate-800 border-t border-slate-200 pt-2">
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

      {/* 🚀 กรอบพรีวิว PDF ตัวจริงเสียงจริงใต้แอปในหน้าเดิม ปลอยภัยสำหรับ PWA */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />{" "}
                ตัวอย่างเอกสารจริง
              </h3>

              {/* 🚀 เพิ่มกลุ่มปุ่มกดตรงนี้ครับ */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSaveOnly()}
                  disabled={loading}
                  className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {loading ? "กำลังบันทึก..." : "บันทึกเอกสาร"}
                </button>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }}
                  className="p-1 text-slate-400 hover:text-red-500 bg-white rounded-full shadow-sm border border-slate-200 transition-all cursor-pointer"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
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
