"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { toast } from "sonner";
import {
  LayoutTemplate,
  ArrowLeft,
  Save,
  RefreshCw,
  FileText,
  XCircle,
  Loader2,
  Upload,
  X,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { getToken } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";
import { AppLoading } from "@/components/ui/app-loading";
import { AppSelect } from "@/components/ui/app-select";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { A4_PAGE_WIDTH, A4_PAGE_HEIGHT } from "@/lib/letterLayoutDefaults";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";
import {
  A4_LAYOUT_GROUPS,
  A4_LAYOUT_SECTIONS,
  DEFAULT_A4_V2_LAYOUTS,
  DEFAULT_A4_V2_ACCENT_COLORS,
  isNoPriceA4Group,
  getA4LayoutConfig,
  A4_BOX_FILL_RADIUS,
  type A4LayoutGroup,
  type LetterLayoutBox,
  type LetterLayoutConfig,
} from "@/lib/a4LayoutDefaults";

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;
const MIN_WIDTH = 20;
const MIN_HEIGHT = 4;

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

type DragMode = "move" | "resize";
type DragState = { key: string; mode: DragMode; startX: number; startY: number; startBox: LetterLayoutBox };

// 🖨️ เอกสารตัวแทนที่พรีวิวได้ต่อกลุ่ม — กลุ่มที่รวมหลายประเภทเอกสารเข้าด้วยกัน (เช่น po_contractor) เลือกได้ว่าจะ
// ดูตัวอย่างเป็นประเภทไหน (แต่ละประเภทอาจใช้ template คนละไฟล์กัน)
const A4_GROUP_MEMBERS: Record<A4LayoutGroup, { value: string; label: string }[]> = {
  quotation: [{ value: "quotation", label: "ใบเสนอราคา" }],
  po_contractor: [
    { value: "purchase_order", label: "ใบสั่งซื้อ" },
    { value: "contractor_work_order", label: "ใบสั่งซื้อ/ใบสั่งจ้าง (ผู้รับเหมา)" },
  ],
  tax_invoice_delivery: [
    { value: "tax_invoice", label: "ใบกำกับภาษี" },
    { value: "delivery_note", label: "ใบส่งสินค้าชั่วคราว" },
    { value: "invoice", label: "ใบแจ้งหนี้" },
  ],
  receipt: [{ value: "receipt", label: "ใบเสร็จรับเงิน" }],
  billing_cash_notes: [
    { value: "billing_invoice", label: "ใบวางบิล" },
    { value: "cash", label: "บิลเงินสด" },
    { value: "credit_note", label: "ใบลดหนี้" },
    { value: "debit_note", label: "ใบเพิ่มหนี้" },
  ],
  goods_packing: [
    { value: "goods_receipt", label: "ใบรับสินค้า" },
    { value: "packing_list", label: "ใบจัดสินค้า" },
  ],
  stock_movement: [
    { value: "material_issue", label: "ใบเบิกสินค้า (โครงการ)" },
    { value: "stock_issue", label: "ใบเบิกสินค้า (งานเช่า)" },
    { value: "stock_return", label: "ใบคืนสินค้า" },
    { value: "rental_stock_return", label: "ใบคืนสินค้าเช่า" },
  ],
  custom_quotation: [{ value: "custom_quotation", label: "ใบเสนอราคา (แบบกำหนดเอง)" }],
  custom_cash: [{ value: "custom_cash", label: "บิลเงินสด (แบบกำหนดเอง)" }],
};

// 🔢 ช่องกรอกตัวเลข X/Y/W/H — ค่าที่พิมพ์อยู่ระหว่างมือ (staged) ไม่ผูกกับ state จริงจนกว่าจะ blur/Enter กัน
// ปัญหาเดิมที่พิมพ์เลขน้อยกว่าค่าปัจจุบัน (เช่น 20→10) แล้วโดน clamp ทับกลับทุกครั้งที่พิมพ์ตัวเลข ทำให้พิมพ์ไม่ทันจบ
const NumberField = ({
  label,
  field,
  value,
  staged,
  setStaged,
  onCommit,
}: {
  label: string;
  field: string;
  value: number;
  staged: Record<string, string>;
  setStaged: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onCommit: (field: string) => void;
}) => (
  <div>
    <label className="block text-[11px] font-medium text-muted-foreground mb-1">{label}</label>
    <input
      type="number"
      className="w-full h-9 px-3 rounded-lg border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
      value={staged[field] ?? Math.round(value)}
      onChange={(e) => setStaged((s) => ({ ...s, [field]: e.target.value }))}
      onBlur={() => onCommit(field)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  </div>
);

const SectionPreview = ({ sectionKey }: { sectionKey: string }) => {
  switch (sectionKey) {
    case "title":
      return (
        <div className="text-right w-full">
          <div className="text-blue-600 font-bold text-sm leading-tight">ชื่อเอกสาร</div>
        </div>
      );
    case "customerInfo":
      return (
        <div className="text-[9px] text-muted-foreground leading-tight space-y-0.5">
          <div className="text-muted-foreground font-bold">ลูกค้า (Customer)</div>
          <div className="font-bold text-foreground">บริษัท ตัวอย่าง จำกัด</div>
          <div>123 ถนนตัวอย่าง กรุงเทพฯ</div>
        </div>
      );
    case "metaInfo":
      return (
        <div className="text-[9px] text-muted-foreground leading-tight space-y-0.5">
          <div className="flex justify-between"><span>เลขที่เอกสาร:</span><span className="font-bold">XX-2609-0000</span></div>
          <div className="flex justify-between"><span>วันที่:</span><span>12/09/2026</span></div>
        </div>
      );
    case "itemsTable":
      return (
        <div className="w-full text-[8px]">
          <div className="flex bg-muted font-bold text-muted-foreground px-1 py-0.5">
            <span className="flex-1">รายการสินค้า</span>
            <span className="w-8 text-center">จำนวน</span>
          </div>
          <div className="flex px-1 py-0.5 border-t border-border">
            <span className="flex-1 truncate">โคมไฟ LED PAR 64</span>
            <span className="w-8 text-center">4</span>
          </div>
        </div>
      );
    case "notes":
      return <div className="text-[9px] text-muted-foreground leading-tight">หมายเหตุ (Remarks)</div>;
    case "customText":
      return <div className="text-[9px] text-muted-foreground italic leading-tight">ข้อความแสดงเอง...</div>;
    case "summary":
      return (
        <div className="text-[9px] text-muted-foreground leading-tight space-y-0.5 w-full">
          <div className="flex justify-between"><span>รวมเป็นเงิน</span><span>11,900.00</span></div>
          <div className="flex justify-between font-bold text-foreground border-t border-border pt-0.5 mt-0.5"><span>รวมทั้งสิ้น</span><span>12,733.00</span></div>
        </div>
      );
    case "grandTotalText":
      return <div className="text-[9px] text-muted-foreground italic w-full text-right">(หนึ่งหมื่นสองพันเจ็ดร้อยสามสิบสามบาทถ้วน)</div>;
    case "quotationValidityNote":
      return (
        <div className="text-[9px] text-muted-foreground text-center w-full">
          กรณีต้องการซื้อสินค้า...(ข้อความแจ้งลงชื่ออนุมัติ)
        </div>
      );
    default:
      if (sectionKey.startsWith("signature"))
        return (
          <div className="text-[9px] text-muted-foreground text-center w-full">
            <div className="border-b border-border mb-1" />
            ลายเซ็น
          </div>
        );
      return null;
  }
};

export default function A4LayoutEditorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [companyData, setCompanyData] = useState({ name: "", tax_id: "", phone: "", address: "" });
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [fullDocumentSettings, setFullDocumentSettings] = useState<any>({});

  const [activeGroup, setActiveGroup] = useState<A4LayoutGroup>("quotation");
  const [previewDocType, setPreviewDocType] = useState<string>("quotation");
  const [layouts, setLayouts] = useState<Record<A4LayoutGroup, LetterLayoutConfig>>({ ...DEFAULT_A4_V2_LAYOUTS });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [accentColors, setAccentColors] = useState<Record<A4LayoutGroup, string>>({ ...DEFAULT_A4_V2_ACCENT_COLORS });
  const [customTexts, setCustomTexts] = useState<Record<A4LayoutGroup, string>>(
    Object.fromEntries(A4_LAYOUT_GROUPS.map((g) => [g.key, ""])) as Record<A4LayoutGroup, string>,
  );

  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 🖼️ พื้นหลังหัวกระดาษใบเสนอราคา (พิมพ์ลง PDF จริง เฉพาะกลุ่ม quotation) — ใช้ endpoint/field เดิมที่มีอยู่แล้ว
  const [quotationBgPath, setQuotationBgPath] = useState("");
  const [quotationBgUrl, setQuotationBgUrl] = useState("");
  const [uploadingQuotationBg, setUploadingQuotationBg] = useState(false);
  const quotationBgInputRef = useRef<HTMLInputElement>(null);

  // 🖼️ พื้นหลังจางเต็มหน้า (watermark) ของเอกสารขาย A4 ทุกประเภท — ย้ายมาจากแท็บ "แก้ไขใบเสนอราคา" ในหน้า
  // /company เดิม (ฟีเจอร์เดิมที่มีอยู่แล้ว ใช้ endpoint เดิมทุกประการ) มาไว้ที่นี่แทนเพื่อไม่ให้มี 2 จุดแก้ไขซ้ำกัน
  const [a4WatermarkPath, setA4WatermarkPath] = useState("");
  const [a4WatermarkUrl, setA4WatermarkUrl] = useState("");
  const [uploadingA4Watermark, setUploadingA4Watermark] = useState(false);
  const a4WatermarkInputRef = useRef<HTMLInputElement>(null);
  const [a4WatermarkGrayscale, setA4WatermarkGrayscale] = useState(false);
  const [a4WatermarkOpacity, setA4WatermarkOpacity] = useState(8); // 0-100 — ตรงกับ opacity:0.08 เดิมที่เคย hardcode
  const [a4WatermarkSize, setA4WatermarkSize] = useState(100); // 0-100 — % ของกล่องตารางรายการสินค้า

  // 🎨 สีพื้นหลังกล่อง — ตั้งค่าเดียวใช้ร่วมกันทั้งเอกสาร A4 ทุกกลุ่ม/ทุกประเภท (ไม่แยกต่อกลุ่มเหมือนสีแถบหัวเอกสาร)
  // 🛡️ เดิมเป็น "เส้นขอบกล่อง" (border) แต่เส้นเดินขอบมุมฉากไปชนกับกล่อง...BoxFull เดิมที่มีอยู่แล้ว (มุมโค้ง) ทำให้
  // เกิดเส้นซ้อนทับที่มุมกล่อง (บั๊กที่ผู้ใช้แจ้งมาพร้อมรูป) เปลี่ยนมาใช้พื้นหลังสี (fill) แทนตามที่ผู้ใช้ขอ
  const [a4BoxFillColor, setA4BoxFillColor] = useState("#ffffff");

  const dragStateRef = useRef<DragState | null>(null);

  const getAuthHeader = () => {
    const token = getToken();
    return { Authorization: `Bearer ${token}`, Accept: "application/json" };
  };
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

  const PAGE_WIDTH = A4_PAGE_WIDTH;
  const PAGE_HEIGHT = A4_PAGE_HEIGHT;

  const layout = layouts[activeGroup];
  const sections = A4_LAYOUT_SECTIONS[activeGroup];

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/company`, { headers: getAuthHeader() });
      if (res.ok) {
        const result = await res.json();
        const data = Array.isArray(result) ? result[0] : result.data || result;
        if (data) {
          setCompanyData({
            name: data.name || "",
            tax_id: data.tax_id || "",
            phone: data.phone || "",
            address: data.address || "",
          });
          setCompanySettings(data);
          let parsed = data.document_settings;
          if (typeof parsed === "string") {
            try {
              parsed = JSON.parse(parsed);
            } catch (e) {}
          }
          setFullDocumentSettings(parsed || {});

          // 🎯 ใช้ getA4LayoutConfig() เดียวกับที่ template จริงใช้ตอนพิมพ์ — รับประกันว่ากลุ่มที่ยังไม่เคยปรับเอง
          // จะยึดค่าล่าสุดของ quotation มาแสดงในหน้าแก้ไขนี้ด้วย (ไม่ใช้ default หยุดนิ่งของกลุ่มตัวเองเฉยๆ อีกต่อไป)
          const result2 = {} as Record<A4LayoutGroup, LetterLayoutConfig>;
          A4_LAYOUT_GROUPS.forEach((g) => {
            result2[g.key] = getA4LayoutConfig(data, g.key).layout;
          });
          setLayouts(result2);
          setAccentColors({ ...DEFAULT_A4_V2_ACCENT_COLORS, ...(parsed?.a4v2_accent_colors || {}) });
          setCustomTexts((prev) => ({ ...prev, ...(parsed?.a4v2_custom_texts || {}) }));
          setA4BoxFillColor(parsed?.a4v2_box_fill_color || "#ffffff");
          setA4WatermarkGrayscale(!!parsed?.a4_watermark_grayscale);
          setA4WatermarkOpacity(typeof parsed?.a4_watermark_opacity === "number" ? parsed.a4_watermark_opacity : 8);
          setA4WatermarkSize(typeof parsed?.a4_watermark_size === "number" ? parsed.a4_watermark_size : 100);

          if (parsed?.quotation_header_background_path) {
            setQuotationBgPath(parsed.quotation_header_background_path);
            setQuotationBgUrl(`${apiUrl.replace("/api", "")}/storage/${parsed.quotation_header_background_path}`);
          }
          if (parsed?.a4_watermark_background_path) {
            setA4WatermarkPath(parsed.a4_watermark_background_path);
            setA4WatermarkUrl(`${apiUrl.replace("/api", "")}/storage/${parsed.a4_watermark_background_path}`);
          }
        }
      } else {
        toast.error("โหลดข้อมูลบริษัทไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const handleQuotationBgSelect = async (file: File | null) => {
    if (!file) return;
    setUploadingQuotationBg(true);
    try {
      const body = new FormData();
      body.append("background", file);
      const res = await fetch(`${apiUrl}/company/quotation-header-background`, {
        method: "POST",
        headers: getAuthHeader(),
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.message || "อัปโหลดรูปพื้นหลังไม่สำเร็จ");
        return;
      }
      const result = await res.json();
      setQuotationBgPath(result.path);
      setQuotationBgUrl(result.url);
      toast.success('อัปโหลดรูปพื้นหลังสำเร็จ (ยังไม่บันทึกจนกว่าจะกด "บันทึกตำแหน่ง")');
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบขณะอัปโหลดรูปพื้นหลัง");
    } finally {
      setUploadingQuotationBg(false);
      if (quotationBgInputRef.current) quotationBgInputRef.current.value = "";
    }
  };

  const handleQuotationBgRemove = () => {
    setQuotationBgPath("");
    setQuotationBgUrl("");
  };

  const handleA4WatermarkSelect = async (file: File | null) => {
    if (!file) return;
    setUploadingA4Watermark(true);
    try {
      const body = new FormData();
      body.append("background", file);
      const res = await fetch(`${apiUrl}/company/a4-watermark-background`, {
        method: "POST",
        headers: getAuthHeader(),
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.message || "อัปโหลดรูปพื้นหลังไม่สำเร็จ");
        return;
      }
      const result = await res.json();
      setA4WatermarkPath(result.path);
      setA4WatermarkUrl(result.url);
      toast.success('อัปโหลดรูปพื้นหลังสำเร็จ (ยังไม่บันทึกจนกว่าจะกด "บันทึกตำแหน่ง")');
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบขณะอัปโหลดรูปพื้นหลัง");
    } finally {
      setUploadingA4Watermark(false);
      if (a4WatermarkInputRef.current) a4WatermarkInputRef.current.value = "";
    }
  };

  const handleA4WatermarkRemove = () => {
    setA4WatermarkPath("");
    setA4WatermarkUrl("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 🛡️ บันทึกเฉพาะกลุ่มที่กำลังแก้ไขอยู่ (activeGroup) เท่านั้น ผสานเข้ากับ a4v2_layout_groups เดิมที่เคย
      // บันทึกไว้ — ห้ามเขียนทับกลุ่มอื่นทั้งหมดด้วยค่าที่ resolve ไว้ตอนโหลดหน้า (ซึ่งอาจเป็นค่าที่ cascade มาจาก
      // quotation ไม่ใช่ค่าที่ผู้ใช้ตั้งใจแก้เองจริงๆ) ไม่งั้นกลุ่มที่ไม่เคยถูกแก้เลยจะโดน "แช่แข็ง" เป็นค่า override
      // ตายตัวทันทีที่กดบันทึกครั้งแรกจากกลุ่มไหนก็ได้ ทำให้ฟีเจอร์ยึดค่าจาก quotation ล่าสุดใช้งานไม่ได้จริงหลังจากนั้น
      const groupsPayload: any = {
        ...(fullDocumentSettings?.a4v2_layout_groups || {}),
        [activeGroup]: layouts[activeGroup],
      };

      const formData = new FormData();
      formData.append("name", companyData.name);
      formData.append("tax_id", companyData.tax_id);
      formData.append("phone", companyData.phone);
      formData.append("address", companyData.address);
      formData.append(
        "document_settings",
        JSON.stringify({
          ...fullDocumentSettings,
          a4v2_layout_groups: groupsPayload,
          a4v2_accent_colors: accentColors,
          a4v2_custom_texts: customTexts,
          a4v2_box_fill_color: a4BoxFillColor,
          quotation_header_background_path: quotationBgPath || null,
          a4_watermark_background_path: a4WatermarkPath || null,
          a4_watermark_grayscale: a4WatermarkGrayscale,
          a4_watermark_opacity: a4WatermarkOpacity,
          a4_watermark_size: a4WatermarkSize,
        }),
      );

      const res = await fetch(`${apiUrl}/company`, { method: "POST", headers: getAuthHeader(), body: formData });
      if (res.ok) {
        toast.success("บันทึกตำแหน่งจัดวางเอกสาร A4 สำเร็จ");
      } else {
        let errMsg = "Error 500";
        try {
          const err = await res.json();
          errMsg = err.message || "Unknown Error";
        } catch (e) {}
        toast.error(`บันทึกไม่สำเร็จ: ${errMsg}`);
      }
    } catch (error) {
      toast.error("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const executeReset = () => {
    setLayouts((prev) => ({ ...prev, [activeGroup]: { ...DEFAULT_A4_V2_LAYOUTS[activeGroup] } }));
    setSelectedKey(null);
    setIsResetOpen(false);
  };

  const SAMPLE_CONTACT = {
    business_name: "บริษัท ตัวอย่าง จำกัด",
    address: "123 ถนนตัวอย่าง กรุงเทพฯ",
    tax_id: "0000000000000",
    phone: "02-000-0000",
  };
  const SAMPLE_ITEMS = [
    { product_id: "1", product_name: "โคมไฟ LED PAR 64", sku: "LED-PAR64", quantity: 4, unit_name: "ชุด", unit_price: 850, discount_amount: 0, total_price: 3400 },
    { product_id: "2", product_name: "ลำโพง Line Array", sku: "SPK-LA200", quantity: 2, unit_name: "ตู้", unit_price: 4500, discount_amount: 500, total_price: 8500 },
  ];
  const sampleSubtotal = SAMPLE_ITEMS.reduce((s, i) => s + i.total_price, 0);
  const sampleFinance = {
    subtotal: sampleSubtotal,
    discount: 0,
    after_discount: sampleSubtotal,
    afterDiscount: sampleSubtotal,
    vat_amount: sampleSubtotal * 0.07,
    wht_amount: 0,
    whtAmount: 0,
    grand_total: sampleSubtotal * 1.07,
    grandTotal: sampleSubtotal,
  };
  const sampleInvoiceRefs = [
    {
      document_number: "INV-2609-0001",
      issue_date: dayjs().format("YYYY-MM-DD"),
      due_date: dayjs().add(7, "day").format("YYYY-MM-DD"),
      grand_total: sampleFinance.grand_total,
      outstanding_balance: 0,
      payment_amount: sampleFinance.grand_total,
    },
  ];

  const handlePreviewPDF = async () => {
    const toastId = toast.loading("กำลังสร้างตัวอย่างเอกสาร...");
    let baseDocSettings: any = companySettings?.document_settings;
    if (typeof baseDocSettings === "string") {
      try {
        baseDocSettings = JSON.parse(baseDocSettings);
      } catch (e) {
        baseDocSettings = {};
      }
    }
    const companySettingsForPreview = {
      ...companySettings,
      document_settings: {
        ...(baseDocSettings || {}),
        a4v2_accent_colors: accentColors,
        a4v2_box_fill_color: a4BoxFillColor,
        quotation_header_background_path: quotationBgPath || null,
        a4_watermark_background_path: a4WatermarkPath || null,
        a4_watermark_grayscale: a4WatermarkGrayscale,
        a4_watermark_opacity: a4WatermarkOpacity,
        a4_watermark_size: a4WatermarkSize,
      },
      quotation_header_background_base64: companySettings?.quotation_header_background_base64,
      a4_watermark_background_base64: companySettings?.a4_watermark_background_base64,
    };
    try {
      const { pdf } = await import("@react-pdf/renderer");
      let element: React.ReactElement;

      if (activeGroup === "po_contractor" && previewDocType === "contractor_work_order") {
        const { default: ContractorWorkOrderPdfTemplate } = await import("@/components/documents/ContractorWorkOrderPdfTemplate");
        element = (
          <ContractorWorkOrderPdfTemplate
            data={{
              companySettings: companySettingsForPreview,
              formData: { order_date: dayjs().format("YYYY-MM-DD"), site_reference: "หน่วยงานตัวอย่าง" },
              selectedContact: SAMPLE_CONTACT,
              items: SAMPLE_ITEMS,
              finance: sampleFinance,
              orderNumber: "WO-2609-0000",
              paperSize: "A4",
              letterLayout: layout,
            }}
          />
        );
      } else if (activeGroup === "po_contractor") {
        const { default: POPdfTemplate } = await import("@/components/documents/POPdfTemplate");
        element = (
          <POPdfTemplate
            data={{
              companySettings: companySettingsForPreview,
              formData: { expected_date: dayjs().format("YYYY-MM-DD"), reference_number: "REF-0000", credit_days: 7 },
              selectedContact: SAMPLE_CONTACT,
              items: SAMPLE_ITEMS,
              finance: sampleFinance,
              poNumber: "PO-2609-0000",
              footerCondition: "ตัวอย่างการจัดวางเอกสารขนาด A4",
              paperSize: "A4",
              letterLayout: layout,
            }}
          />
        );
      } else if (activeGroup === "goods_packing" && previewDocType === "goods_receipt") {
        const { default: GRPdfTemplate } = await import("@/components/documents/GRPdfTemplate");
        element = (
          <GRPdfTemplate
            data={{
              companySettings: companySettingsForPreview,
              grData: { gr_number: "GR-2609-0000", received_date: dayjs().format("YYYY-MM-DD"), reference_number: "PO-2609-0000", note: "ตัวอย่างการจัดวางเอกสารขนาด A4" },
              items: SAMPLE_ITEMS,
              creator: { name: "ผู้ใช้ตัวอย่าง" },
              paperSize: "A4",
              letterLayout: layout,
            }}
          />
        );
      } else if (
        activeGroup === "stock_movement" &&
        ["stock_issue", "stock_return", "rental_stock_return"].includes(previewDocType)
      ) {
        const { default: StockMovementPdfTemplate } = await import("@/components/documents/StockMovementPdfTemplate");
        element = (
          <StockMovementPdfTemplate
            data={{
              companySettings: companySettingsForPreview,
              documentType: previewDocType,
              documentNumber: "SI-2609-0000",
              formData: { doc_date: dayjs().format("YYYY-MM-DD"), note: "ตัวอย่างการจัดวางเอกสารขนาด A4", reference_label: "งานเช่า", reference_value: "งานตัวอย่าง" },
              contactName: SAMPLE_CONTACT.business_name,
              items: SAMPLE_ITEMS,
              paperSize: "A4",
              letterLayout: layout,
            }}
          />
        );
      } else {
        // 🖨️ กลุ่มที่เหลือทั้งหมด (quotation/tax_invoice_delivery/receipt/billing_cash_notes/material_issue/
        // packing_list/custom_quotation/custom_cash) ใช้ SalesPdfTemplate เหมือนกันหมด ต่างกันแค่ document_type
        const { default: SalesPdfTemplate } = await import("@/components/documents/SalesPdfTemplate");
        const isReceiptLike = previewDocType === "receipt" || previewDocType === "billing_invoice";
        element = (
          <SalesPdfTemplate
            data={{
              companySettings: companySettingsForPreview,
              formData: {
                document_type: previewDocType,
                document_number: "XX-2609-0000",
                issue_date: dayjs().format("YYYY-MM-DD"),
                credit_days: 7,
                tax_type: isNoPriceA4Group(activeGroup) ? "none" : "exclude",
                note: "ตัวอย่างการจัดวางเอกสารขนาด A4",
                reference_number: "PO27-000000",
                saleman_code: "SALE-01",
              },
              selectedContact: SAMPLE_CONTACT,
              items: SAMPLE_ITEMS,
              invoiceRefs: isReceiptLike ? sampleInvoiceRefs : undefined,
              finance: sampleFinance,
              documentNumber: "XX-2609-0000",
              paperSize: "A4",
              letterLayout: layout,
            }}
          />
        );
      }

      const blob = await pdf(element as React.ReactElement<any>).toBlob();
      setPreviewUrl(URL.createObjectURL(blob));
      toast.dismiss(toastId);
    } catch (e) {
      toast.error("สร้างตัวอย่าง PDF ไม่สำเร็จ", { id: toastId });
    }
  };

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const dxPt = (e.clientX - drag.startX) / zoom;
      const dyPt = (e.clientY - drag.startY) / zoom;

      setLayouts((prevLayouts) => {
        const prev = prevLayouts[activeGroup];
        const box = prev[drag.key] || drag.startBox;
        const next = { ...box };
        if (drag.mode === "move") {
          next.x = clamp(drag.startBox.x + dxPt, 0, PAGE_WIDTH - box.width);
          next.y = clamp(drag.startBox.y + dyPt, 0, PAGE_HEIGHT - box.height);
        } else {
          next.width = clamp(drag.startBox.width + dxPt, MIN_WIDTH, PAGE_WIDTH - box.x);
          next.height = clamp(drag.startBox.height + dyPt, MIN_HEIGHT, PAGE_HEIGHT - box.y);
        }
        return { ...prevLayouts, [activeGroup]: { ...prev, [drag.key]: next } };
      });
    };
    const handleUp = () => {
      dragStateRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [activeGroup, zoom, PAGE_WIDTH, PAGE_HEIGHT]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const zoomIn = () => setZoom((z) => Math.round(Math.min(ZOOM_MAX, z + ZOOM_STEP) * 100) / 100);
  const zoomOut = () => setZoom((z) => Math.round(Math.max(ZOOM_MIN, z - ZOOM_STEP) * 100) / 100);
  const zoomReset = () => setZoom(1);

  const handleCanvasWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  };

  const startDrag = (e: React.PointerEvent, key: string, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedKey(key);
    dragStateRef.current = { key, mode, startX: e.clientX, startY: e.clientY, startBox: { ...layout[key] } };
  };

  const updateSelectedBox = (field: keyof LetterLayoutBox, value: number) => {
    if (!selectedKey) return;
    setLayouts((prevLayouts) => {
      const prev = prevLayouts[activeGroup];
      const box = prev[selectedKey];
      if (!box) return prevLayouts;
      const next = { ...box, [field]: value };
      if (field === "x") next.x = clamp(value, 0, PAGE_WIDTH - next.width);
      if (field === "y") next.y = clamp(value, 0, PAGE_HEIGHT - next.height);
      if (field === "width") next.width = clamp(value, MIN_WIDTH, PAGE_WIDTH - next.x);
      if (field === "height") next.height = clamp(value, MIN_HEIGHT, PAGE_HEIGHT - next.y);
      return { ...prevLayouts, [activeGroup]: { ...prev, [selectedKey]: next } };
    });
  };

  // 🔢 ค่าพิมพ์ค้างของช่อง X/Y/W/H — commit (พร้อม clamp ผ่าน updateSelectedBox) เฉพาะตอน blur/Enter เท่านั้น
  const [staged, setStaged] = useState<Record<string, string>>({});
  useEffect(() => setStaged({}), [selectedKey]);
  const commitField = (field: string) => {
    if (staged[field] === undefined) return;
    updateSelectedBox(field as keyof LetterLayoutBox, Number(staged[field]) || 0);
    setStaged((s) => ({ ...s, [field]: undefined as any }));
  };

  const toggleVisible = (key: string) => {
    setLayouts((prevLayouts) => {
      const prev = prevLayouts[activeGroup];
      const box = prev[key];
      if (!box) return prevLayouts;
      return { ...prevLayouts, [activeGroup]: { ...prev, [key]: { ...box, visible: box.visible === false } } };
    });
  };

  const toggleShowFill = (key: string) => {
    setLayouts((prevLayouts) => {
      const prev = prevLayouts[activeGroup];
      const box = prev[key];
      if (!box) return prevLayouts;
      return { ...prevLayouts, [activeGroup]: { ...prev, [key]: { ...box, showFill: box.showFill === false } } };
    });
  };

  const switchGroup = (group: A4LayoutGroup) => {
    setActiveGroup(group);
    setSelectedKey(null);
    setPreviewDocType(A4_GROUP_MEMBERS[group][0].value);
  };

  if (loading) return <AppLoading text="กำลังโหลดข้อมูลการจัดวางเอกสาร..." minHeight="min-h-screen" />;

  const selectedBox = selectedKey ? layout[selectedKey] : null;
  const selectedLabel = sections.find((s) => s.key === selectedKey)?.label;
  const isQuotationGroup = activeGroup === "quotation";
  const groupMembers = A4_GROUP_MEMBERS[activeGroup];

  const SectionRow = ({ boxKey, label }: { boxKey: string; label: string }) => {
    const isChecked = layout[boxKey]?.visible !== false;
    return (
      <div
        onClick={() => setSelectedKey(boxKey)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer",
          selectedKey === boxKey ? "bg-blue-600 text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted",
        )}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleVisible(boxKey)}
          className="w-4 h-4 rounded cursor-pointer accent-blue-600 shrink-0"
        />
        <span className={cn("flex-1 text-left", !isChecked && "opacity-50")}>
          {label}
          {!isChecked && " (ซ่อน)"}
        </span>
      </div>
    );
  };

  const CanvasBox = ({ boxKey, label }: { boxKey: string; label: string }) => {
    const box = layout[boxKey] || DEFAULT_A4_V2_LAYOUTS[activeGroup][boxKey];
    if (!box) return null;
    const isSelected = selectedKey === boxKey;
    const isHidden = box.visible === false;
    const fillOn = box.showFill !== false;

    // 🖊️ เส้นขอบบางๆ นี้เป็นแค่ตัวช่วยในหน้าจอแก้ไข (ให้ยังมองเห็น/คลิกลากกล่องได้เสมอ) ไม่เกี่ยวกับพื้นหลังสีที่จะ
    // พิมพ์จริง — กล่องที่เลือกอยู่ขอบฟ้าทึบเสมอ (ต้องเห็นชัดว่ากำลังเลือกกล่องไหน) นอกนั้นขอบเทาบางคงที่เสมอ
    // 🎨 พื้นหลังสี (fill) คือสิ่งที่พิมพ์จริงลง PDF — แสดงตัวอย่างสีพื้นหลังตามที่ตั้งไว้ (หรือโปร่งใสถ้าปิดสวิทช์นี้)
    const outlineStyle: React.CSSProperties = isSelected
      ? { borderWidth: 2, borderStyle: "solid", borderColor: "#3b82f6" }
      : { borderWidth: 1, borderStyle: "solid", borderColor: "#cbd5e1" };
    const fillStyle: React.CSSProperties = fillOn
      ? { backgroundColor: a4BoxFillColor, borderRadius: A4_BOX_FILL_RADIUS }
      : {};

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          setSelectedKey(boxKey);
        }}
        onPointerDown={(e) => startDrag(e, boxKey, "move")}
        className={cn(
          "absolute rounded-md p-1.5 overflow-hidden cursor-move flex flex-col",
          // 🎨 สีจางๆ นี้เป็นตัวช่วยในหน้าจอแก้ไขเท่านั้น (มองเห็นกล่องได้เสมอแม้ปิดสวิทช์พื้นหลัง) — ถ้าเปิดสวิทช์
          // พื้นหลัง สีจริงที่ตั้งไว้ (a4BoxFillColor) จะเขียนทับทาง inline style ด้านล่างแทน (ตัวอย่างตรงกับที่พิมพ์จริง)
          isHidden ? "bg-muted/50 opacity-50" : isSelected ? "bg-blue-50/70 z-10" : "bg-blue-50/40 hover:brightness-95",
        )}
        style={{ left: box.x * zoom, top: box.y * zoom, width: box.width * zoom, height: box.height * zoom, ...outlineStyle, ...fillStyle }}
      >
        <span
          className={cn(
            "absolute -top-2.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-white",
            isHidden ? "bg-slate-400" : isSelected ? "bg-blue-600" : "bg-blue-400",
          )}
        >
          {label}
          {isHidden && " (ซ่อน)"}
        </span>
        <div className="flex-1 flex items-center overflow-hidden mt-1 w-full">
          <SectionPreview sectionKey={boxKey} />
        </div>
        <div
          onPointerDown={(e) => startDrag(e, boxKey, "resize")}
          className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-blue-500 rounded-tl cursor-nwse-resize"
        />
      </div>
    );
  };

  return (
    <RoleRouteGuard permission="manage_company">
    <div className="w-full max-w-full px-4 py-4 text-foreground pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <LayoutTemplate className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">ตั้งค่าจัดวางเอกสาร (A4)</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              ลากกล่องเพื่อย้ายตำแหน่ง ลากมุมล่างขวาเพื่อย่อ/ขยายขนาด — เฉพาะกระดาษ A4 เท่านั้น
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={handlePreviewPDF}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileText className="w-4 h-4 text-blue-600" /> ดูตัวอย่าง PDF
          </button>
          <AppTooltip label="รีเซ็ตเป็นค่าเริ่มต้น">
            <button
              type="button"
              onClick={() => setIsResetOpen(true)}
              className="flex items-center justify-center h-10 w-10 text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-105"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </AppTooltip>
          <AppTooltip label="ขยายเต็มจอ">
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="flex items-center justify-center h-10 w-10 text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-105"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </AppTooltip>
          <button
            onClick={() => router.back()}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึกตำแหน่ง
          </button>
        </div>
      </div>

      {isFullscreen && (
        <AppTooltip label="ปิดโหมดเต็มจอ (Esc)">
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="fixed top-4 right-4 z-[110] p-2.5 text-muted-foreground hover:text-red-500 bg-background hover:bg-red-50 rounded-full shadow-lg border border-border cursor-pointer transition-all"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        </AppTooltip>
      )}

      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-[100] bg-background p-6 overflow-auto flex flex-col lg:flex-row gap-6 items-start"
            : "flex flex-col lg:flex-row gap-6 items-start"
        }
      >
        {/* ฝั่งซ้าย: ส่วนประกอบเอกสาร + ตัวเลขปรับตำแหน่ง + พื้นหลัง */}
        <div className="w-full lg:w-1/5 space-y-4">
          <div className="bg-card p-5 rounded-2xl shadow-sm border border-border">
            <h3 className="text-sm font-bold text-foreground mb-3">ส่วนประกอบเอกสาร</h3>
            <div className="space-y-1.5">
              {sections.map(({ key, label }) => (
                <SectionRow key={key} boxKey={key} label={label} />
              ))}
            </div>
          </div>

          {selectedKey === "customText" && (
            <div className="bg-card p-5 rounded-2xl shadow-sm border border-border">
              <h3 className="text-sm font-bold text-foreground mb-2">เนื้อหาข้อความแสดงเอง</h3>
              <textarea
                rows={3}
                className="w-full p-3 rounded-xl border border-border outline-none text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-muted/50 focus:bg-background"
                placeholder="พิมพ์ข้อความที่ต้องการให้แสดงตายตัวในเอกสารกลุ่มนี้..."
                value={customTexts[activeGroup]}
                onChange={(e) => setCustomTexts((prev) => ({ ...prev, [activeGroup]: e.target.value }))}
              />
            </div>
          )}

          {selectedBox && (
            <div className="bg-card p-5 rounded-2xl shadow-sm border border-border">
              <h3 className="text-sm font-bold text-foreground mb-3">{selectedLabel}</h3>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="ตำแหน่ง X (pt)" field="x" value={selectedBox.x} staged={staged} setStaged={setStaged} onCommit={commitField} />
                <NumberField label="ตำแหน่ง Y (pt)" field="y" value={selectedBox.y} staged={staged} setStaged={setStaged} onCommit={commitField} />
                <NumberField label="ความกว้าง (pt)" field="width" value={selectedBox.width} staged={staged} setStaged={setStaged} onCommit={commitField} />
                <NumberField label="ความสูง (pt)" field="height" value={selectedBox.height} staged={staged} setStaged={setStaged} onCommit={commitField} />
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <label className="text-[11px] font-medium text-muted-foreground">แสดงสีพื้นหลังกล่องนี้</label>
                <Switch
                  checked={selectedBox.showFill !== false}
                  onCheckedChange={() => toggleShowFill(selectedKey!)}
                  size="sm"
                />
              </div>
            </div>
          )}

          {/* พื้นหลังหัวกระดาษใบเสนอราคา — เฉพาะกลุ่ม quotation (พิมพ์ลง PDF จริง) */}
          {isQuotationGroup && (
            <div className="bg-card p-5 rounded-2xl shadow-sm border border-border">
              <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-500" /> พื้นหลังหัวกระดาษใบเสนอราคา
              </h3>
              <p className="text-[11px] text-muted-foreground mb-3">
                พิมพ์ลง PDF จริง แสดงหลังข้อความ "ใบเสนอราคา" หัวกระดาษฝั่งขวา
              </p>
              <input
                ref={quotationBgInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => handleQuotationBgSelect(e.target.files?.[0] || null)}
              />
              {quotationBgUrl ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <img src={quotationBgUrl} alt="" className="w-12 h-16 object-contain rounded-lg border border-border bg-background" />
                  <button
                    type="button"
                    onClick={() => quotationBgInputRef.current?.click()}
                    className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold text-muted-foreground hover:bg-muted/50 cursor-pointer"
                  >
                    เปลี่ยนรูป
                  </button>
                  <AppTooltip label="ลบรูปพื้นหลัง">
                    <button type="button" onClick={handleQuotationBgRemove} className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </AppTooltip>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => quotationBgInputRef.current?.click()}
                  disabled={uploadingQuotationBg}
                  className="w-full h-10 px-4 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {uploadingQuotationBg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  อัปโหลดรูปพื้นหลัง
                </button>
              )}
            </div>
          )}

          {/* พื้นหลังจางเต็มหน้า (watermark) — ใช้ร่วมกันทุกกลุ่ม/ทุกประเภทเอกสารขาย A4 (ไม่ใช่ต่อกลุ่ม) */}
          <div className="bg-card p-5 rounded-2xl shadow-sm border border-border">
            <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-500" /> พื้นหลังจางเต็มหน้า (เอกสารขาย A4 ทุกประเภท)
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">พิมพ์ลง PDF จริง จำกัดพื้นที่อยู่ในกล่องตารางรายการสินค้า ใช้ร่วมกันทุกประเภทเอกสารขาย ไม่ต้องตั้งแยกต่อกลุ่ม</p>
            <input
              ref={a4WatermarkInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => handleA4WatermarkSelect(e.target.files?.[0] || null)}
            />
            {a4WatermarkUrl ? (
              <div className="flex items-center gap-2 flex-wrap">
                <img src={a4WatermarkUrl} alt="" className="w-12 h-16 object-contain rounded-lg border border-border bg-background" />
                <button
                  type="button"
                  onClick={() => a4WatermarkInputRef.current?.click()}
                  className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold text-muted-foreground hover:bg-muted/50 cursor-pointer"
                >
                  เปลี่ยนรูป
                </button>
                <AppTooltip label="ลบรูปพื้นหลัง">
                  <button type="button" onClick={handleA4WatermarkRemove} className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </AppTooltip>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => a4WatermarkInputRef.current?.click()}
                disabled={uploadingA4Watermark}
                className="w-full h-10 px-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {uploadingA4Watermark ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                อัปโหลดรูปพื้นหลัง
              </button>
            )}
            <div className="flex items-center justify-between mt-3">
              <label className="text-[11px] font-medium text-muted-foreground">โทนขาวดำ (Grayscale)</label>
              <Switch checked={a4WatermarkGrayscale} onCheckedChange={setA4WatermarkGrayscale} size="sm" />
            </div>
            <div className="mt-3">
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                ความจาง ({a4WatermarkOpacity}%)
              </label>
              <input
                type="range"
                min={1}
                max={40}
                value={a4WatermarkOpacity}
                onChange={(e) => setA4WatermarkOpacity(Number(e.target.value))}
                className="w-full cursor-pointer accent-emerald-500"
              />
            </div>
            <div className="mt-3">
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                ขนาด ({a4WatermarkSize}%)
              </label>
              <input
                type="range"
                min={20}
                max={150}
                value={a4WatermarkSize}
                onChange={(e) => setA4WatermarkSize(Number(e.target.value))}
                className="w-full cursor-pointer accent-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* ฝั่งขวา: เลือกเอกสาร + Canvas จำลองหน้ากระดาษ A4 แบบเต็มพื้นที่ (ขยายใหญ่ขึ้น อยู่แถวเดียวกับดรอปดาวน์) */}
        <div
          className={
            isFullscreen
              ? "w-full lg:w-4/5 bg-card p-6 rounded-2xl shadow-sm border border-border flex-1"
              : "w-full lg:w-4/5 bg-card p-6 rounded-2xl shadow-sm border border-border lg:sticky lg:top-4"
          }
        >
          {/* เลือกเอกสารที่จะตั้งค่า (dropdown) + เลือกประเภทย่อยที่จะพรีวิว (ถ้ากลุ่มมีมากกว่า 1 ประเภท) */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="w-full sm:w-96">
              <label className="block text-xs font-medium text-muted-foreground mb-1">เอกสารที่จะตั้งค่า</label>
              <AppSelect
                value={activeGroup}
                onValueChange={(v) => switchGroup(v as A4LayoutGroup)}
                options={A4_LAYOUT_GROUPS.map((g) => ({ value: g.key, label: g.label }))}
              />
            </div>
            {groupMembers.length > 1 && (
              <div className="w-full sm:w-64">
                <label className="block text-xs font-medium text-muted-foreground mb-1">พรีวิวเป็นประเภท</label>
                <AppSelect value={previewDocType} onValueChange={setPreviewDocType} options={groupMembers} />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 h-9 bg-muted rounded-full">
                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">สีแถบหัวเอกสาร (กลุ่มนี้)</span>
                <input
                  type="color"
                  value={accentColors[activeGroup]}
                  onChange={(e) => setAccentColors((prev) => ({ ...prev, [activeGroup]: e.target.value }))}
                  className="w-6 h-6 rounded-full border border-border cursor-pointer p-0 overflow-hidden"
                  title="เลือกสีเอง"
                />
                <div className="flex gap-1">
                  {["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#7c3aed", "#0891b2", "#334155"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => setAccentColors((prev) => ({ ...prev, [activeGroup]: c }))}
                      className={cn(
                        "w-5 h-5 rounded-full border-2 cursor-pointer transition-all",
                        accentColors[activeGroup] === c ? "border-slate-700 scale-110" : "border-white shadow-sm",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 h-9 bg-muted rounded-full">
                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">สีพื้นหลังกล่อง (ทั้งเอกสาร)</span>
                <input
                  type="color"
                  value={a4BoxFillColor}
                  onChange={(e) => setA4BoxFillColor(e.target.value)}
                  className="w-6 h-6 rounded-full border border-border cursor-pointer p-0 overflow-hidden"
                  title="สีพื้นหลังกล่อง"
                />
                <div className="flex gap-1">
                  {["#ffffff", "#f1f5f9", "#eff6ff", "#fffbeb"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => setA4BoxFillColor(c)}
                      className={cn(
                        "w-5 h-5 rounded-full border-2 cursor-pointer transition-all",
                        a4BoxFillColor === c ? "border-blue-600 scale-110" : "border-white shadow-sm",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <AppTooltip label="ซูมออก">
                <button type="button" onClick={zoomOut} className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer">
                  <ZoomOut className="w-4 h-4" />
                </button>
              </AppTooltip>
              <span className="text-xs font-bold text-muted-foreground w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
              <AppTooltip label="ซูมเข้า">
                <button type="button" onClick={zoomIn} className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer">
                  <ZoomIn className="w-4 h-4" />
                </button>
              </AppTooltip>
              <button type="button" onClick={zoomReset} className="h-8 px-3 rounded-xl border border-border bg-background text-xs font-bold text-muted-foreground hover:bg-muted/50 cursor-pointer ml-1">
                รีเซ็ต 100%
              </button>
            </div>
          </div>
          <div
            className={cn(
              "rounded-xl bg-muted flex justify-center",
              isFullscreen ? "max-h-[calc(100vh-11rem)] overflow-auto p-4" : "max-h-[calc(100vh-180px)] overflow-auto p-4",
            )}
            onWheel={handleCanvasWheel}
          >
            <div className="relative bg-background shrink-0" style={{ width: PAGE_WIDTH * zoom, height: PAGE_HEIGHT * zoom }}>
              <div
                className="absolute bg-card border border-border shadow-md select-none"
                style={{ left: 0, top: 0, width: PAGE_WIDTH * zoom, height: PAGE_HEIGHT * zoom }}
                onClick={() => setSelectedKey(null)}
              >
                {a4WatermarkUrl && layout.itemsTable && (
                  <div
                    className="absolute overflow-hidden pointer-events-none flex items-center justify-center"
                    style={{
                      left: layout.itemsTable.x * zoom,
                      top: layout.itemsTable.y * zoom,
                      width: layout.itemsTable.width * zoom,
                      height: layout.itemsTable.height * zoom,
                      opacity: a4WatermarkOpacity / 100,
                      filter: a4WatermarkGrayscale ? "grayscale(1)" : "none",
                    }}
                  >
                    <img
                      src={a4WatermarkUrl}
                      alt=""
                      className="object-contain shrink-0"
                      style={{ width: `${a4WatermarkSize}%`, height: `${a4WatermarkSize}%` }}
                    />
                  </div>
                )}
                {sections.map(({ key, label }) => (
                  <CanvasBox key={key} boxKey={key} label={label} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AppConfirmDialog
        open={isResetOpen}
        onOpenChange={setIsResetOpen}
        icon={RefreshCw}
        iconColorClass="bg-orange-50 text-orange-600 border-orange-100/50"
        title="รีเซ็ตตำแหน่งจัดวาง?"
        description="ยืนยันรีเซ็ตตำแหน่งจัดวางของเอกสารนี้กลับเป็นค่าเริ่มต้นใช่หรือไม่?"
        confirmLabel="ยืนยันรีเซ็ต"
        confirmColorClass="bg-orange-500 hover:bg-orange-600 shadow-orange-500/20"
        onConfirm={executeReset}
      />

      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> ตัวอย่างเอกสาร A4
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
              <iframe src={previewUrl} className="w-full h-full rounded-xl border border-border" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
    </RoleRouteGuard>
  );
}
