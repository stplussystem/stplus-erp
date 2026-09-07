"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ShoppingCart,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Printer,
  Search,
  ChevronDown,
  FileText,
  Download,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { ProductSearchDropdown } from "@/components/products/ProductSearchDropdown";
import { getToken } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { calculatePurchaseOrderFinance } from "@/lib/purchaseOrderFinance";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

function EditPurchaseOrderPageContent() {
  const router = useRouter();
  const params = useParams();
  const poId = params.id; // ดึง ID จาก URL

  // 📦 ข้อมูล Master Data
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);

  // 🔍 State สำหรับ Custom Dropdown ค้นหาผู้จำหน่าย
  const [selectedContact, setSelectedContact] = useState<any>(null);

  // State สำหรับเปิด/ปิด พรีวิว Print
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 📝 State หัวบิล (เพิ่มช่องเก็บเลขที่บิลเดิม)
  const [formData, setFormData] = useState({
    po_number: "",
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
    footerCondition: "", // เก็บเงื่อนไขท้ายบิลแยกไว้
  });

  // 🛒 State รายการสินค้า
  const [items, setItems] = useState<any[]>([]);

  // 💰 แก้ subtotal/VAT เองได้ (ปัดเศษ/ให้ตรงกับผู้ขาย) — ว่าง = ใช้ค่าที่คำนวณอัตโนมัติ
  const [subtotalOverride, setSubtotalOverride] = useState("");
  const [vatAmountOverride, setVatAmountOverride] = useState("");
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 🚀 เก็บข้อมูลผู้จัดทำ/ผู้อนุมัติ (พร้อมลายเซ็น) จาก PO ที่บันทึกไว้แล้ว ไว้ใช้ตอนพิมพ์/ดาวน์โหลด PDF
  // เดิมข้อมูลนี้ถูกดึงมาจาก backend แล้วแต่ไม่เคยเก็บไว้ที่ไหนเลย ทำให้ชื่อ+ลายเซ็นไม่ขึ้นตอนพิมพ์/ดาวน์โหลด
  const [docMeta, setDocMeta] = useState<{
    creator?: any;
    approver?: any;
    created_at?: string;
    updated_at?: string;
  }>({});

  // 🏗️ เพิ่มโครงการใหม่แบบเร็ว (Quick Add)
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [addingProjectLoading, setAddingProjectLoading] = useState(false);

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

  // 🚀 โหลด Master Data และ ข้อมูล PO เดิมพร้อมกัน
  useEffect(() => {
    if (poId) {
      fetchMasterDataAndPO();
    }
  }, [poId]);

  const fetchMasterDataAndPO = async () => {
    try {
      const token = getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };

      // ดึงของทุกอย่างพร้อมกัน
      const [warehousesRes, companyRes, projectsRes, poRes] = await Promise.all(
        [
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/warehouses`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/company`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
            headers,
          }).catch(() => null),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/purchase-orders/${poId}`, {
            headers,
          }), // 👈 บรรทัดนี้สำคัญมาก!
        ],
      );

      if (warehousesRes.ok) {
        const wData = await warehousesRes.json();
        setWarehouses(Array.isArray(wData) ? wData : wData.data || []);
      }
      if (companyRes.ok) {
        const compData = await companyRes.json();
        setCompanySettings(
          Array.isArray(compData) ? compData[0] : compData.data || compData,
        );
      }
      if (projectsRes && projectsRes.ok) {
        const projData = await projectsRes.json();
        setProjects(Array.isArray(projData) ? projData : projData.data || []);
      }

      // 2. จัดการหยอดข้อมูลบิลเดิมลงฟอร์ม
      if (poRes && poRes.ok) {
        const poData = await poRes.json();
        const po = poData.data || poData;

        // 🚀 ดึง Supplier จากบิลเดิมมาแสดงได้เลย (ไม่ต้องไปเทียบหาใน Array แล้ว)
        if (po.contact) {
          setSelectedContact(po.contact);
        }

        // 🚀 เก็บผู้จัดทำ/ผู้อนุมัติ (มี signature_base64 ติดมาจาก backend อยู่แล้ว) ไว้ใช้ตอนพิมพ์/ดาวน์โหลด PDF
        setDocMeta({
          creator: po.creator,
          approver: po.approver,
          created_at: po.created_at,
          updated_at: po.updated_at,
        });

        // 🧠 แยกร่าง หมายเหตุ กับ เงื่อนไขท้ายบิล
        let extractedNote = po.note || "";
        let extractedFooter = "";
        if (extractedNote.includes("[เงื่อนไขท้ายบิล]:")) {
          const parts = extractedNote.split("[เงื่อนไขท้ายบิล]:");
          extractedNote = parts[0].trim();
          extractedFooter = parts[1].trim();
        }

        setFormData({
          po_number: po.po_number || "",
          contact_id: po.contact_id?.toString() || "",
          project_id: po.project_id?.toString() || "",
          warehouse_id: po.warehouse_id?.toString() || "",
          reference_number: po.reference_number || "",
          expected_date: po.expected_date
            ? dayjs(po.expected_date).format("YYYY-MM-DD")
            : "",
          credit_days: po.credit_days || 0,
          currency: po.currency || "THB",
          tax_type: po.tax_type || "exclude",
          discount_amount: po.discount_amount || 0,
          note: extractedNote,
          footerCondition: extractedFooter,
        });

        // 🚀 หยอดข้อมูลสินค้าให้ครบถ้วน
        if (po.items && po.items.length > 0) {
          const loadedItems = po.items.map((item: any) => ({
            product_id: item.product_id?.toString() || "",
            product_name: item.product?.name || "", // เติมชื่อ
            sku: item.product?.sku || "", // เติม SKU
            quantity: Number(item.quantity) || 1,
            unit_name: item.unit_name || "ชิ้น", // เติมหน่วย
            unit_price: Number(item.unit_price) || 0,
            discount_amount: Number(item.discount_amount) || 0,
            wht_rate: Number(item.wht_rate) || 0,
            total_price: Number(item.total_price) || 0,
          }));
          setItems(loadedItems);

          // 🚀 ถ้าบิลนี้เคยถูกแก้ subtotal/VAT เองไว้ (ต่างจากค่าที่คำนวณจาก items จริง) ให้เติมช่อง override
          // กลับมาให้เห็น ไม่งั้นจะดูเหมือนค่าหายไปตอนเปิดมาแก้ไขซ้ำ
          const computed = calculatePurchaseOrderFinance({
            items: loadedItems,
            taxType: po.tax_type || "exclude",
            discountAmount: po.discount_amount || 0,
          });
          if (
            Math.abs(computed.itemSubtotal - Number(po.subtotal || 0)) > 0.01
          ) {
            setSubtotalOverride(String(po.subtotal));
          }
          if (
            Math.abs(computed.computedVatAmount - Number(po.vat_amount || 0)) >
            0.01
          ) {
            setVatAmountOverride(String(po.vat_amount));
          }
        } else {
          // ถ้าบิลว่างเปล่า
          setItems([
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
        }
      } else {
        toast.error("ไม่พบข้อมูลใบสั่งซื้อนี้");
        router.push("/purchase-orders");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
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

  const handleItemChange = (
    index: number,
    field: string,
    value: string | number,
  ) => {
    const newItems = [...items];
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

  // 💰 ใช้ util กลางร่วมกับหน้าสร้าง/list/view — เดิมเขียนสูตรซ้ำที่นี่
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

  // 🧠 ปั้นไฟล์ PDF
  const generatePdfBlobUrl = async () => {
    const toastId = toast.loading("กำลังเตรียมไฟล์เอกสาร...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: POPdfTemplate } =
        await import("@/components/documents/POPdfTemplate");

      const { paperSize, letterLayout } = getPaperSizeConfig(
        companySettings,
        "purchase_order",
      );

      const pdfData = {
        companySettings,
        formData: { ...formData, ...docMeta },
        selectedContact,
        items,
        products: [],
        finance,
        poNumber: formData.po_number,
        footerCondition:
          formData.footerCondition ||
          "**กรุณาแนบใบสั่งซื้อทุกครั้งที่มีการส่งของ วางบิล หรือรับเช็ค**\nทางบริษัทฯมีสิทธิ์ที่จะส่งสินค้าคืนกลับผู้ขาย หรือยกเลิกการสั่งซื้อ ถ้าสินค้าที่ส่งไม่เป็นไปตามที่กำหนดไว้ในใบสั่งซื้อ",
        paperSize,
        letterLayout,
      };

      const blob = await pdf(<POPdfTemplate data={pdfData} />).toBlob();
      toast.dismiss(toastId);
      return URL.createObjectURL(blob);
    } catch (err) {
      toast.error("สร้างเอกสารไม่สำเร็จ", { id: toastId });
      return null;
    }
  };

  const handleDownloadPDF = async () => {
    const url = await generatePdfBlobUrl();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${formData.po_number || "PO"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = async () => {
    // 🚀 เดิมเปิดแท็บใหม่แยกไปเลย ทำให้ประสบการณ์ไม่เหมือนปุ่ม "ตัวอย่าง" — เปลี่ยนให้แสดงผลแบบเดียวกัน
    // (เปิด modal ตัวอย่างเอกสารในหน้าเดิม ผู้ใช้กดพิมพ์จากปุ่มพิมพ์ในตัว viewer ของเบราว์เซอร์ได้เลย)
    const url = await generatePdfBlobUrl();
    if (url) setPreviewUrl(url);
  };

  // 🧠 บันทึกการแก้ไข (Update)
  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.contact_id) newErrors.contact_id = "กรุณาเลือกผู้จำหน่าย";
    if (items.some((i) => !i.product_id))
      newErrors.items = "กรุณาเลือกสินค้าให้ครบทุกแถว";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async (
    footerTextFromModal = formData.footerCondition,
  ) => {
    if (!validate()) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("กำลังอัปเดตเอกสาร...");

    try {
      const token = getToken();

      const finalNote = footerTextFromModal
        ? `${formData.note}\n\n[เงื่อนไขท้ายบิล]:\n${footerTextFromModal}`.trim()
        : formData.note;

      const payload = {
        ...formData,
        note: finalNote,
        project_id: formData.project_id || null,
        warehouse_id: formData.warehouse_id || null,
        discount_amount: finance.discount,
        subtotal: finance.subtotal,
        vat_amount: finance.vat_amount,
        wht_amount: finance.wht_amount,
        grand_total: finance.grand_total,
        items: items.map((item) => ({
          ...item,
          wht_amount: item.total_price * (item.wht_rate / 100),
        })),
      };

      // 🚀 ยิง API แบบ PUT เพื่อทับข้อมูลเดิม
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/purchase-orders/${poId}`,
        {
          method: "PUT",
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
        setLoading(false);
        return;
      }

      toast.success("อัปเดตใบสั่งซื้อสำเร็จ!", { id: toastId });
      router.push("/purchase-orders");
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", {
        id: toastId,
        description: "ไม่สามารถเชื่อมต่อกับระบบได้",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !formData.po_number) {
    return <AppLoading text="กำลังโหลดข้อมูลเอกสาร..." />;
  }

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      {loading && formData.po_number && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <AppLoading text="กำลังอัปเดตเอกสาร..." minHeight="min-h-0" />
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 dark:border-amber-800/50 shadow-sm">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight flex items-center gap-2">
              แก้ไขใบสั่งซื้อ{" "}
              <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md text-base">
                {formData.po_number}
              </span>
            </h1>
            <p className="text-muted-foreground text-xs">
              แก้ไขรายละเอียดผู้จำหน่ายและรายการสินค้า
            </p>
          </div>
        </div>

        {/* 🎛️ กลุ่มปุ่มเครื่องมือระดับ Pro */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const url = await generatePdfBlobUrl();
              if (url) setPreviewUrl(url);
            }}
            className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileText className="w-4 h-4 text-blue-500" />{" "}
            <span className="hidden sm:inline">ตัวอย่าง</span>
          </button>
          {/* 🖨️ ปุ่ม Print (เขียวพาสเทล) */}
          <button
            type="button"
            onClick={handlePrint}
            className="h-10 px-3 rounded-full font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 flex items-center gap-2 transition-all shadow-sm cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <Printer className="w-4 h-4" />{" "}
            <span className="hidden sm:inline">พิมพ์</span>
          </button>
          {/* 📥 ปุ่ม โหลด PDF (แดงอ่อนตามสั่ง) */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="h-10 px-3 rounded-full font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 flex items-center gap-2 transition-all shadow-sm cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <Download className="w-4 h-4" />{" "}
            <span className="hidden sm:inline">PDF</span>
          </button>
          <div className="w-px h-8 bg-muted mx-1"></div> {/* เส้นคั่น */}
          <Link href="/purchase-orders">
            <button
              type="button"
              className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              <ArrowLeft className="w-4 h-4" /> ยกเลิก
            </button>
          </Link>
          <button
            type="button"
            onClick={() => handleUpdate()}
            disabled={loading}
            className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            <Save className="w-4 h-4" />{" "}
            {loading ? "กำลังบันทึก..." : "อัปเดตเอกสาร"}
          </button>
        </div>
      </div>

      <div className="bg-card p-6 rounded-2xl shadow-sm border border-border min-h-[500px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 🔍 ฝั่งซ้าย: ผู้จำหน่าย */}
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-xs font-bold text-foreground mb-1">
                ชื่อผู้จำหน่าย <span className="text-red-500">*</span>
              </label>
              <ContactSearchDropdown
                value={formData.contact_id}
                selectedName={
                  selectedContact?.business_name ||
                  selectedContact?.contact_name
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

            <div className="p-3 bg-muted/50 rounded-xl border border-border min-h-[90px] text-sm text-muted-foreground">
              {selectedContact ? (
                <>
                  <p>{selectedContact.address || "ไม่มีข้อมูลที่อยู่"}</p>
                  <p className="mt-2 text-muted-foreground">
                    เลขประจำตัวผู้เสียภาษี: {selectedContact.tax_id || "-"}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  รายละเอียดที่อยู่จะแสดงเมื่อเลือกผู้จำหน่าย...
                </p>
              )}
            </div>
          </div>

          {/* 💵 ฝั่งขวา: การเงิน */}
          <div className="bg-muted/50 p-5 rounded-xl border border-border">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-sm font-bold text-muted-foreground mb-1">
                  เลขที่ใบสั่งซื้อ
                </div>
                <div className="inline-block bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-lg border border-blue-200">
                  {formData.po_number}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-muted-foreground mb-1">
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
                <label className="block text-xs text-muted-foreground mb-1">
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
                <label className="block text-xs text-muted-foreground mb-1">
                  เครดิต (วัน)
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
          </div>
        </div>

        {/* แถบอ้างอิงตรงกลาง */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 border border-border rounded-xl bg-card">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
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
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              โปรเจค (Project)
            </label>
            {isAddingProject ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="ชื่อโครงการใหม่..."
                  className="w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
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
                  className="h-10 px-3 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 cursor-pointer shrink-0"
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
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              เลขที่อ้างอิง
            </label>
            <input
              type="text"
              placeholder="เช่น อ้างอิงใบเสนอราคา"
              className="w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={formData.reference_number}
              onChange={(e) =>
                setFormData({ ...formData, reference_number: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
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
        <div className="border border-border rounded-xl overflow-hidden mb-6">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="px-3 py-3 w-10 text-center font-bold">#</th>
                <th className="px-3 py-3 font-bold">ชื่อสินค้า / รายละเอียด</th>
                <th className="px-3 py-3 w-20 text-center font-bold">จำนวน</th>
                <th className="px-3 py-3 w-20 text-center font-bold">หน่วย</th>
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
            <tbody className="divide-y divide-border">
              {items.map((item, index) => (
                <tr key={index} className="hover:bg-muted/50">
                  <td className="px-3 py-3 text-center text-muted-foreground">
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
                          unit_price: Number(productData.cost_price || 0),
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
                      className="w-full h-10 text-center border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm outline-none"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(index, "quantity", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      placeholder="ชิ้น/กล่อง"
                      className="w-full h-10 text-center border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm outline-none"
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
                      className="w-full h-10 text-right border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm outline-none"
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
                      className="w-full h-10 text-right border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm text-red-500 outline-none"
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
                  <td className="px-3 py-3 text-right font-medium text-foreground">
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
                      className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-2 border-t border-border bg-muted/50">
            <button
              onClick={() =>
                setItems([
                  ...items,
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
                ])
              }
              className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> เพิ่มรายการสินค้า
            </button>
          </div>
        </div>

        {/* 📝 หมายเหตุ & สรุปยอด */}
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div className="w-full md:w-1/2">
            <label className="block text-sm font-bold text-foreground mb-2">
              หมายเหตุ
            </label>
            <textarea
              rows={4}
              className="w-full p-3 rounded-xl border border-border focus:border-blue-500 outline-none text-sm resize-none"
              placeholder="ระบุหมายเหตุเพิ่มเติม หรือเงื่อนไขการสั่งซื้อ..."
              value={formData.note}
              onChange={(e) =>
                setFormData({ ...formData, note: e.target.value })
              }
            ></textarea>
          </div>

          <div className="w-full md:w-80 space-y-2 bg-muted/50 p-4 rounded-xl border border-border">
            <div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>รวมเป็นเงิน (Subtotal)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-28 h-10 text-right px-2 rounded-xl border border-border font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-background"
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
                className="w-28 h-10 text-right px-2 rounded-xl border border-border text-red-500 font-bold outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 bg-background"
                value={formData.discount_amount || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    discount_amount: Number(e.target.value),
                  })
                }
              />
            </div>

            {finance.discount > 0 && (
              <div className="flex justify-between text-foreground font-medium border-t border-border pt-2">
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
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>
                    ภาษีมูลค่าเพิ่ม{" "}
                    {formData.tax_type === "include" ? "(รวมในยอด)" : ""}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-28 h-10 text-right px-2 rounded-xl border border-border font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-background"
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
            <div className="flex justify-between text-lg font-bold text-foreground border-t border-border pt-2 mt-2">
              <span>จำนวนเงินรวมทั้งสิ้น</span>
              <span className="text-blue-600">
                {finance.grand_total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            {finance.wht_amount > 0 && (
              <>
                <div className="flex justify-between text-sm text-red-500 pt-2 border-t border-border mt-2">
                  <span>หัก ณ ที่จ่าย</span>
                  <span>
                    -
                    {finance.wht_amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-green-600">
                  <span>ยอดชำระสุทธิ</span>
                  <span>
                    {finance.net_payable.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 🚀 กรอบพรีวิว PDF ตัวจริง (แทนที่ POPrintPreviewModal เดิม) */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />{" "}
                ตัวอย่างเอกสารจริง
              </h3>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleUpdate()}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 shadow-lg shadow-blue-600/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {loading ? "กำลังอัปเดต..." : "อัปเดตเอกสาร"}
                </button>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }}
                  className="p-1 text-muted-foreground hover:text-red-500 bg-background rounded-full shadow-sm border border-border transition-all cursor-pointer"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
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

export default function EditPurchaseOrderPage() {
  return (
    <RoleRouteGuard permission="bt_edit_purchase">
      <EditPurchaseOrderPageContent />
    </RoleRouteGuard>
  );
}
