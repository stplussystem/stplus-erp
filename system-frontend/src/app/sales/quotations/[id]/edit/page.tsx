"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { SalesHistoryModal } from "@/components/sales/SalesHistoryModal";
import { SaleDocumentItemsTable } from "@/components/sales/SaleDocumentItemsTable";
import { useSaleDocumentItems } from "@/hooks/useSaleDocumentItems";
import {
  getPaperSizeConfig,
  getQuotationHeaderBackgroundUrl,
} from "@/lib/letterLayoutDefaults";
import { GroupComboboxField } from "@/components/permissions/GroupComboboxField";

// 💳 วิธีการชำระเงิน — ตัวเลือกสำเร็จรูป (พิมพ์เองได้ด้วยผ่าน GroupComboboxField ถ้าไม่มีในรายการ)
const PAYMENT_METHOD_OPTIONS = ["เงินสด", "โอนเงิน", "เช็ค", "บัตรเครดิต", "เครดิต"];

export default function QuotationEditPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id;

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [projects, setProjects] = useState<any[]>([]);
  const [rentalJobs, setRentalJobs] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  // 🚀 ล็อกฝั่งตรงข้ามตามค่าที่โหลดมาจากเอกสารเดิม — เอกสารผูกกับโปรเจคอยู่แล้วก็ล็อกช่องงานเช่า, ผูกกับงานเช่า
  // อยู่แล้วก็ล็อกช่องโปรเจค (มิเรอร์ตรรกะเดียวกับตอนสร้างใหม่จาก URL param)
  const [projectLocked, setProjectLocked] = useState(false);
  const [rentalJobLocked, setRentalJobLocked] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 🚀 ปุ่ม "ดูรายการขายล่าสุด" ต่อแถวสินค้า — เปิดเมื่อเลือกทั้งลูกค้าและสินค้าแล้วเท่านั้น
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [historyProductName, setHistoryProductName] = useState("");

  // 💰 แก้ยอดภาษีมูลค่าเพิ่มเองได้ (ปัดเศษ/ให้ตรงกับที่ตกลงกับลูกค้า) — ว่าง = ใช้ค่าที่คำนวณอัตโนมัติ (7%)
  const [vatAmountOverride, setVatAmountOverride] = useState("");

  const [formData, setFormData] = useState({
    document_number: "",
    document_type: "quotation",
    contact_id: "",
    project_id: "",
    rental_job_id: "",
    issue_date: dayjs().format("YYYY-MM-DD"),
    credit_days: 0,
    currency: "THB",
    tax_type: "exclude",
    discount_amount: 0,
    payment_method: "",
    note: "",
  });

  const {
    items,
    loadFromDocument,
    selectProduct,
    updateItem,
    addItem,
    removeItem,
    buildPayload,
  } = useSaleDocumentItems();

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
          ? p === "edit_quotation"
          : p?.name === "edit_quotation",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        fetchMasterData();
        fetchDocumentData();
      } else {
        toast.error("คุณไม่มีสิทธิ์แก้ไขเอกสาร");
        router.push("/sales/quotations");
      }
    } catch (e) {
      router.push("/");
    }
  }, [router, documentId]);

  const fetchMasterData = async () => {
    try {
      const token = getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const [projectsRes, rentalJobsRes, companyRes] = await Promise.all([
        fetch(`${apiUrl}/projects`, { headers }).catch(() => null),
        fetch(`${apiUrl}/rental-jobs`, { headers }).catch(() => null),
        fetch(`${apiUrl}/company`, { headers }),
      ]);
      if (projectsRes && projectsRes.ok) {
        const projData = await projectsRes.json();
        setProjects(projData?.data || projData || []);
      }
      if (rentalJobsRes && rentalJobsRes.ok) {
        const rjData = await rentalJobsRes.json();
        setRentalJobs(rjData?.data || rjData || []);
      }
      if (companyRes.ok) {
        const compData = await companyRes.json();
        setCompanySettings(
          Array.isArray(compData) ? compData[0] : compData.data || compData,
        );
      }
    } catch (error) {
      console.error("fetchMasterData failed:", error);
    }
  };

  const fetchDocumentData = async () => {
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/sale-documents/${documentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (res.ok) {
        const doc = (await res.json()).data;
        // 🛡️ backend กัน update() ไว้แล้วถ้า status !== 'Pending' (400) แต่หน้านี้ยังโหลดฟอร์มให้แก้ไขได้เต็ม
        // รูปแบบเสมอไม่สนสถานะ ผู้ใช้กรอกจนกดบันทึกถึงจะเจอ error — กันตั้งแต่ตรงนี้แทน (พบบั๊กจากทางลัดที่หน้า
        // โครงการ/งานเช่าลิงก์ตรงมาหน้านี้โดยไม่เช็คสถานะเอกสารเลย)
        if (doc.status !== "Pending") {
          toast.error("ไม่สามารถแก้ไขเอกสารที่ยืนยันหรือดำเนินการไปแล้วได้", {
            description:
              'เอกสารนี้ถูกอนุมัติ/ดำเนินการไปแล้ว ใช้ปุ่ม "แก้ไข (Revise)" จากหน้ารายการแทน เพื่อสร้างฉบับแก้ไขใหม่',
          });
          router.push(`/sales/quotations/${documentId}`);
          return;
        }
        setFormData({
          document_number: doc.document_number,
          document_type: doc.document_type,
          contact_id: doc.contact_id?.toString() || "",
          project_id: doc.project_id?.toString() || "",
          rental_job_id: doc.rental_job_id?.toString() || "",
          issue_date: doc.issue_date
            ? dayjs(doc.issue_date).format("YYYY-MM-DD")
            : "",
          credit_days: doc.credit_days || 0,
          currency: doc.currency || "THB",
          tax_type: doc.tax_type || "exclude",
          discount_amount: Number(doc.discount_amount) || 0,
          payment_method: doc.payment_method || "",
          note: doc.note || "",
        });
        if (doc.contact) setSelectedContact(doc.contact);
        // 🚀 เอกสารนี้ผูกกับโปรเจค/งานเช่าไว้แล้ว — ล็อกฝั่งตรงข้ามไว้ กันเปลี่ยนไปผูกซ้อนกันทั้งสองทาง
        if (doc.project_id) setRentalJobLocked(true);
        if (doc.rental_job_id) setProjectLocked(true);
        loadFromDocument(doc.items || []);

        if (doc.items && doc.items.length > 0) {
          // 💰 ถ้า VAT ที่เคยบันทึกไว้ต่างจากที่คำนวณอัตโนมัติได้ (เคยแก้เองไว้) ให้ตั้ง override กลับมาให้เห็น
          // ไม่งั้นจะดูเหมือนค่าหายไปตอนเปิดมาแก้ไขซ้ำ
          const itemSubtotal = doc.items.reduce(
            (s: number, i: any) => s + (Number(i.total_price) || 0),
            0,
          );
          const afterDiscount = Math.max(
            0,
            itemSubtotal - (Number(doc.discount_amount) || 0),
          );
          let computedVat = 0;
          if ((doc.tax_type || "exclude") === "exclude")
            computedVat = afterDiscount * 0.07;
          else if (doc.tax_type === "include")
            computedVat = afterDiscount - afterDiscount / 1.07;
          if (Math.abs(computedVat - Number(doc.vat_amount || 0)) > 0.01) {
            setVatAmountOverride(String(doc.vat_amount));
          }
        }
      } else {
        toast.error("ไม่พบข้อมูลเอกสาร");
        router.push("/sales/quotations");
      }
    } catch (error) {
      toast.error("ข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setFetching(false);
    }
  };

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
    let computed_vat_amount = 0;
    if (formData.tax_type === "exclude") {
      computed_vat_amount = after_discount * 0.07;
    } else if (formData.tax_type === "include") {
      computed_vat_amount = after_discount - after_discount / 1.07;
    }
    const vat_amount =
      vatAmountOverride === ""
        ? computed_vat_amount
        : Number(vatAmountOverride) || 0;
    let grand_total = after_discount;
    if (formData.tax_type === "exclude") {
      grand_total = after_discount + vat_amount;
    }
    return {
      subtotal,
      discount,
      after_discount,
      computed_vat_amount,
      vat_amount,
      wht_amount,
      grand_total,
      net_payable: grand_total - wht_amount,
    };
  }, [items, formData.tax_type, formData.discount_amount, vatAmountOverride]);

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
        "quotation",
      );
      const quotationHeaderBackgroundUrl =
        getQuotationHeaderBackgroundUrl(companySettings);
      const blob = await pdf(
        <SalesPdfTemplate
          data={{
            companySettings,
            formData,
            selectedContact,
            items,
            finance,
            documentNumber: formData.document_number,
            paperSize,
            letterLayout,
            quotationHeaderBackgroundUrl,
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    if (!validate()) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    setLoading(true);
    const toastId = toast.loading("กำลังอัปเดตเอกสาร...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const payload = {
        ...formData,
        project_id: formData.project_id || null,
        rental_job_id: formData.rental_job_id || null,
        vat_amount: finance.vat_amount,
        wht_amount: finance.wht_amount,
        grand_total: finance.grand_total,
        items: buildPayload(),
      };
      const res = await fetch(`${apiUrl}/sale-documents/${documentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error("อัปเดตไม่สำเร็จ", {
          id: toastId,
          description: (await res.json()).message,
        });
        return;
      }
      toast.success("อัปเดตเอกสารสำเร็จ!", { id: toastId });
      router.push("/sales/quotations");
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) return <div className="min-h-screen bg-muted/50"></div>;

  if (fetching) return <AppLoading text="กำลังโหลดข้อมูลเอกสาร..." />;

  return (
    <div className="w-full max-w-full px-4 py-4 overflow-x-hidden text-foreground pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileBox className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight flex items-center gap-2">
              แก้ไข{" "}
              <span className="text-blue-600">{formData.document_number}</span>
            </h1>
            <p className="text-muted-foreground text-xs mt-0.5">
              แก้ไขรายละเอียดใบเสนอราคา
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={handlePreviewPDF}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileText className="w-4 h-4 text-blue-600" /> ตัวอย่าง PDF
          </button>
          <Link href="/sales/quotations" className="w-full md:w-auto">
            <button
              type="button"
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              <ArrowLeft className="w-4 h-4" /> ยกเลิก
            </button>
          </Link>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={loading}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}{" "}
            อัปเดตเอกสาร
          </button>
        </div>
      </div>

      <div className="bg-card p-6 rounded-2xl shadow-sm border border-border min-h-[500px]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8 p-5 border border-border rounded-xl bg-muted/50">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              ประเภทเอกสาร
            </label>
            <div className="h-10 flex items-center text-sm font-bold text-foreground">
              ใบเสนอราคา (SQ)
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
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              วิธีการชำระเงิน
            </label>
            <GroupComboboxField
              value={formData.payment_method}
              onChange={(v) => setFormData({ ...formData, payment_method: v })}
              options={PAYMENT_METHOD_OPTIONS}
              placeholder="เลือกหรือพิมพ์วิธีการชำระเงิน"
              accentColor="amber"
            />
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
                disabled={projectLocked}
                options={[
                  { value: "__none__", label: "-- ไม่มีโปรเจค --" },
                  ...projects.map((pj) => ({
                    value: String(pj.id),
                    label: pj.name,
                  })),
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                งานเช่า (Rental Job)
              </label>
              <AppSelect
                value={formData.rental_job_id || "__none__"}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    rental_job_id: v === "__none__" ? "" : v,
                  })
                }
                disabled={rentalJobLocked}
                options={[
                  { value: "__none__", label: "-- ไม่มีงานเช่า --" },
                  ...rentalJobs.map((j) => ({
                    value: String(j.id),
                    label: j.name,
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
          showHistoryButton
          historyEnabled={!!formData.contact_id}
          onOpenHistory={(index) => {
            setHistoryProductId(items[index].product_id);
            setHistoryProductName(items[index].product_name);
            setHistoryOpen(true);
          }}
          showCostPrice
          isCostEditable={(item) =>
            !!formData.rental_job_id &&
            (!!item.can_rent || item.product_type === "service")
          }
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
              <div className="flex justify-between items-center font-medium">
                <span>
                  ภาษีมูลค่าเพิ่ม{" "}
                  {formData.tax_type === "include" ? "(รวมในยอด)" : "(7%)"}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-28 h-10 text-right px-2 rounded-xl border border-border font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-background"
                  placeholder={finance.computed_vat_amount.toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2 },
                  )}
                  value={vatAmountOverride}
                  onChange={(e) => setVatAmountOverride(e.target.value)}
                />
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

      <SalesHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        productId={historyProductId}
        productName={historyProductName}
        contactId={formData.contact_id || null}
        companySettings={companySettings}
      />

      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />{" "}
                พรีวิวตัวอย่างเอกสาร ({formData.document_number})
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
