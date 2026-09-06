"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
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
  Plus,
  Eye,
  EyeOff,
  Image as ImageIcon,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { getToken } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";
import { AppLoading } from "@/components/ui/app-loading";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";
import {
  DEFAULT_LETTER_LAYOUTS,
  DEFAULT_A4_LAYOUTS,
  DEFAULT_HALF_LETTER_LAYOUTS,
  LETTER_LAYOUT_GROUPS,
  LETTER_LAYOUT_SECTIONS,
  LETTER_PAGE_WIDTH,
  LETTER_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_PAGE_HEIGHT,
  HALF_LETTER_PAGE_WIDTH,
  HALF_LETTER_PAGE_HEIGHT,
  HOLE_STRIP_WIDTH,
  DEFAULT_A4_ACCENT_COLORS,
  LetterLayoutBox,
  LetterLayoutConfig,
  LetterLayoutGroup,
  PaperSize,
  getRepeatableDateKeys,
  normalizeColumnGroups,
} from "@/lib/letterLayoutDefaults";

// 🖨️ ตั้งแต่ตอนนี้หน้านี้จัดวางได้ทั้ง 3 ขนาดกระดาษ (A4/Letter/Half Letter) — เก็บ layout/พื้นหลังอ้างอิง
// แยกเป็นคนละชุดต่อขนาดกระดาษ (ผู้ใช้อาจอยากให้แต่ละขนาดของเอกสารเดียวกันจัดวางไม่เหมือนกันก็ได้)
const PAPER_SIZES: { key: PaperSize; label: string }[] = [
  { key: "A4", label: "A4" },
  { key: "Letter", label: "Letter" },
  { key: "HalfLetter", label: "Half Letter" },
];

// สเกลแสดงผลบนจอ (612x792pt -> เต็มขนาด px) พิกัดที่เก็บ/บันทึกยังเป็น pt เดิมเสมอ
// 🔍 ซูมได้ตั้งแต่ 25%-200% ทีละ 10% — ตัวคูณ scale เปลี่ยนเป็น state (zoom) แทนค่าคงที่เดิม
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;
const MIN_WIDTH = 60;
const MIN_HEIGHT = 20;

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

type DragMode = "move" | "resize";
type DragState = {
  key: string;
  mode: DragMode;
  startX: number;
  startY: number;
  startBox: LetterLayoutBox;
};

// เนื้อหาตัวอย่างในแต่ละกล่อง (ให้เห็นภาพใกล้เคียงของจริงตอนลาก-วาง) — ใช้กับกลุ่ม "shared" (8 กล่องเดิม) เป็นหลัก
// กล่องอื่นๆ (delivery_note ที่แยกละเอียด/grandTotalText) fallback ไปแสดงชื่อ label เฉยๆ
const SectionPreview = ({ sectionKey }: { sectionKey: string }) => {
  switch (sectionKey) {
    case "title":
      return (
        <div className="text-right w-full">
          <div className="text-blue-600 font-bold text-sm leading-tight">ใบเสนอราคา (Quotation)</div>
          <div className="text-[9px] text-slate-400">เอกสารออกเป็นชุด</div>
        </div>
      );
    case "customerInfo":
      return (
        <div className="text-[9px] text-slate-600 leading-tight space-y-0.5">
          <div className="text-slate-400 font-bold">ลูกค้า (Customer)</div>
          <div className="font-bold text-slate-700">บริษัท ตัวอย่าง จำกัด</div>
          <div>123 ถนนตัวอย่าง กรุงเทพฯ</div>
          <div>เลขผู้เสียภาษี: 0000000000000</div>
        </div>
      );
    case "metaInfo":
      return (
        <div className="text-[9px] text-slate-600 leading-tight space-y-0.5">
          <div className="flex justify-between"><span className="text-slate-400">เลขที่เอกสาร:</span><span className="font-bold">QT-2608-0000</span></div>
          <div className="flex justify-between"><span className="text-slate-400">วันที่:</span><span>23/08/2026</span></div>
          <div className="flex justify-between"><span className="text-slate-400">เครดิต:</span><span>7 วัน</span></div>
        </div>
      );
    case "itemsTable":
      return (
        <div className="w-full text-[8px]">
          <div className="flex bg-slate-100 font-bold text-slate-500 px-1 py-0.5">
            <span className="flex-1">รายการสินค้า</span>
            <span className="w-8 text-center">จำนวน</span>
            <span className="w-12 text-right">จำนวนเงิน</span>
          </div>
          <div className="flex px-1 py-0.5 border-t border-slate-100">
            <span className="flex-1 truncate">โคมไฟ LED PAR 64</span>
            <span className="w-8 text-center">4</span>
            <span className="w-12 text-right">3,400.00</span>
          </div>
          <div className="flex px-1 py-0.5 border-t border-slate-100">
            <span className="flex-1 truncate">ลำโพง Line Array</span>
            <span className="w-8 text-center">2</span>
            <span className="w-12 text-right">8,500.00</span>
          </div>
        </div>
      );
    case "notes":
      return (
        <div className="text-[9px] text-slate-500 leading-tight">
          <div className="font-bold text-slate-400 mb-0.5">หมายเหตุ (Remarks)</div>
          ตัวอย่างการจัดวางเอกสารขนาด Letter
        </div>
      );
    case "summary":
      return (
        <div className="text-[9px] text-slate-600 leading-tight space-y-0.5 w-full">
          <div className="flex justify-between"><span>รวมเป็นเงิน</span><span>11,900.00</span></div>
          <div className="flex justify-between"><span>ภาษีมูลค่าเพิ่ม 7%</span><span>833.00</span></div>
          <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-0.5 mt-0.5"><span>รวมทั้งสิ้น</span><span>12,733.00</span></div>
        </div>
      );
    case "grandTotalText":
      return <div className="text-[9px] text-slate-500 italic w-full">(หนึ่งหมื่นสองพันเจ็ดร้อยสามสิบสามบาทถ้วน)</div>;
    case "signatureLeft":
      return (
        <div className="text-[9px] text-slate-500 text-center w-full">
          <div className="border-b border-slate-300 mb-1" />
          ผู้รับสินค้า / ผู้รับวางบิล
        </div>
      );
    case "signatureRight":
      return (
        <div className="text-[9px] text-slate-500 text-center w-full">
          <div className="border-b border-slate-300 mb-1" />
          ผู้มีอำนาจลงนาม / ผู้รับเงิน
        </div>
      );
    default:
      return null;
  }
};

// ตัวอย่างสินค้าไว้ใช้กับ preview PDF ของกลุ่ม delivery_note
const SAMPLE_ITEMS = [
  { product_id: "1", product_name: "โคมไฟ LED PAR 64", sku: "LED-PAR64", quantity: 4, unit_name: "ชุด", unit_price: 850, discount_amount: 0, total_price: 3400 },
  { product_id: "2", product_name: "ลำโพง Line Array", sku: "SPK-LA200", quantity: 2, unit_name: "ตู้", unit_price: 4500, discount_amount: 500, total_price: 8500 },
];

export default function LetterLayoutEditorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [companyData, setCompanyData] = useState({ name: "", tax_id: "", phone: "", address: "" });
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [fullDocumentSettings, setFullDocumentSettings] = useState<any>({});

  const [paperSize, setPaperSize] = useState<PaperSize>("Letter");
  const [activeGroup, setActiveGroup] = useState<LetterLayoutGroup>("shared");
  const [layouts, setLayouts] = useState<Record<PaperSize, Record<LetterLayoutGroup, LetterLayoutConfig>>>({
    Letter: { ...DEFAULT_LETTER_LAYOUTS },
    A4: { ...DEFAULT_A4_LAYOUTS },
    HalfLetter: { ...DEFAULT_HALF_LETTER_LAYOUTS },
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isNewDeliveryNoteGroup, setIsNewDeliveryNoteGroup] = useState(false);
  // 🎨 สีแถบ headerDivider — เฉพาะ A4 แยกต่อกลุ่มเอกสาร (ดู DEFAULT_A4_ACCENT_COLORS/getA4AccentColor)
  const [accentColors, setAccentColors] = useState<Record<LetterLayoutGroup, string>>({ ...DEFAULT_A4_ACCENT_COLORS });

  // 🔍 ซูม canvas (25%-200%) และโหมดขยายเต็มจอ (overlay ทับหน้าเว็บ ไม่ใช่ browser Fullscreen API)
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const EMPTY_GROUP_STRINGS = {
    shared: "",
    delivery_note: "",
    purchase_order: "",
    goods_receipt: "",
    contractor_work_order: "",
    receipt_voucher: "",
    stock_movement: "",
  } as Record<LetterLayoutGroup, string>;

  // 🖼️ รูปถ่ายกระดาษหัวจดหมายตัวจริงของแต่ละกลุ่ม × แต่ละขนาดกระดาษ — ใช้เป็นพื้นหลังอ้างอิงบนหน้าจอเท่านั้น ไม่พิมพ์ลง PDF จริง
  const [backgroundPaths, setBackgroundPaths] = useState<Record<PaperSize, Record<LetterLayoutGroup, string>>>({
    Letter: { ...EMPTY_GROUP_STRINGS },
    A4: { ...EMPTY_GROUP_STRINGS },
    HalfLetter: { ...EMPTY_GROUP_STRINGS },
  });
  const [backgroundUrls, setBackgroundUrls] = useState<Record<PaperSize, Record<LetterLayoutGroup, string>>>({
    Letter: { ...EMPTY_GROUP_STRINGS },
    A4: { ...EMPTY_GROUP_STRINGS },
    HalfLetter: { ...EMPTY_GROUP_STRINGS },
  });
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const dragStateRef = useRef<DragState | null>(null);

  const getAuthHeader = () => {
    const token = getToken();
    return { Authorization: `Bearer ${token}`, Accept: "application/json" };
  };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

  // 🖨️ ขนาดหน้ากระดาษจริงที่ใช้คำนวณ/จำกัดขอบเขตการลาก-วาง เปลี่ยนไปตาม paperSize ที่เลือกอยู่ (3 ทาง)
  const PAGE_DIMENSIONS: Record<PaperSize, { width: number; height: number }> = {
    A4: { width: A4_PAGE_WIDTH, height: A4_PAGE_HEIGHT },
    Letter: { width: LETTER_PAGE_WIDTH, height: LETTER_PAGE_HEIGHT },
    HalfLetter: { width: HALF_LETTER_PAGE_WIDTH, height: HALF_LETTER_PAGE_HEIGHT },
  };
  const PAGE_WIDTH = PAGE_DIMENSIONS[paperSize].width;
  const PAGE_HEIGHT = PAGE_DIMENSIONS[paperSize].height;
  const DEFAULT_LAYOUTS_BY_PAPER_SIZE: Record<PaperSize, Record<LetterLayoutGroup, LetterLayoutConfig>> = {
    A4: DEFAULT_A4_LAYOUTS,
    Letter: DEFAULT_LETTER_LAYOUTS,
    HalfLetter: DEFAULT_HALF_LETTER_LAYOUTS,
  };

  // 🧩 กล่องคอลัมน์/วันที่ซ้ำต้อง normalize ก่อนนำไป render/แสดงในแถบด้านข้าง (เหมือน print-layouts)
  const layout = normalizeColumnGroups(layouts[paperSize][activeGroup], activeGroup);
  const sections = LETTER_LAYOUT_SECTIONS[activeGroup];
  const dateKeys = getRepeatableDateKeys(layout);
  const extraDateKeys = dateKeys.filter((k) => k !== "metaDate");

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

          // 🧩 รวม default + ค่าที่บันทึกไว้จริงของทุกกลุ่ม แยกต่างหากคนละชุดสำหรับ Letter กับ A4
          const buildGroupLayouts = (
            defaults: Record<LetterLayoutGroup, LetterLayoutConfig>,
            storedGroups: any,
            sharedStored: any,
          ): Record<LetterLayoutGroup, LetterLayoutConfig> => {
            const result = {} as Record<LetterLayoutGroup, LetterLayoutConfig>;
            (Object.keys(defaults) as LetterLayoutGroup[]).forEach((g) => {
              const stored = g === "shared" ? sharedStored : storedGroups?.[g];
              result[g] = { ...defaults[g], ...(stored || {}) };
            });
            return result;
          };
          setLayouts({
            Letter: buildGroupLayouts(DEFAULT_LETTER_LAYOUTS, parsed?.letter_layout_groups, parsed?.letter_layout),
            A4: buildGroupLayouts(DEFAULT_A4_LAYOUTS, parsed?.a4_layout_groups, parsed?.a4_layout),
            HalfLetter: buildGroupLayouts(
              DEFAULT_HALF_LETTER_LAYOUTS,
              parsed?.half_letter_layout_groups,
              parsed?.half_letter_layout,
            ),
          });
          // 🛡️ ใบส่งสินค้าชั่วคราวย้ายมาจาก print-layouts เดิม (เฉพาะฝั่ง Letter) — ถ้ายังไม่เคยบันทึกตำแหน่งใหม่เลยที่นี่ แจ้งผู้ใช้ว่ากำลังใช้ค่าเริ่มต้น
          setIsNewDeliveryNoteGroup(!parsed?.letter_layout_groups?.delivery_note);
          setAccentColors({ ...DEFAULT_A4_ACCENT_COLORS, ...(parsed?.a4_accent_colors || {}) });

          // 🧩 รูปพื้นหลังอ้างอิงก็แยกต่างหากคนละชุดตามขนาดกระดาษเช่นกัน
          const buildBackgrounds = (bgPaths: any, legacySharedPath?: string) => {
            const paths = { ...EMPTY_GROUP_STRINGS };
            const urls = { ...EMPTY_GROUP_STRINGS };
            (Object.keys(paths) as LetterLayoutGroup[]).forEach((g) => {
              const p = bgPaths?.[g] || (g === "shared" ? legacySharedPath : undefined);
              if (p) {
                paths[g] = p;
                urls[g] = `${apiUrl.replace("/api", "")}/storage/${p}`;
              }
            });
            return { paths, urls };
          };
          const letterBg = buildBackgrounds(parsed?.letter_layout_background_paths, parsed?.letter_layout_background_path);
          const a4Bg = buildBackgrounds(parsed?.a4_layout_background_paths);
          const halfLetterBg = buildBackgrounds(parsed?.half_letter_layout_background_paths);
          setBackgroundPaths({ Letter: letterBg.paths, A4: a4Bg.paths, HalfLetter: halfLetterBg.paths });
          setBackgroundUrls({ Letter: letterBg.urls, A4: a4Bg.urls, HalfLetter: halfLetterBg.urls });
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

  const handleBackgroundSelect = async (file: File | null) => {
    if (!file) return;
    setUploadingBackground(true);
    try {
      const body = new FormData();
      body.append("background", file);
      const res = await fetch(`${apiUrl}/company/letter-layout-background/${activeGroup}/${paperSize}`, {
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
      setBackgroundPaths((prev) => ({ ...prev, [paperSize]: { ...prev[paperSize], [activeGroup]: result.path } }));
      setBackgroundUrls((prev) => ({ ...prev, [paperSize]: { ...prev[paperSize], [activeGroup]: result.url } }));
      setShowBackground(true);
      toast.success("อัปโหลดรูปพื้นหลังสำเร็จ (ยังไม่บันทึกจนกว่าจะกด \"บันทึกตำแหน่ง\")");
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบขณะอัปโหลดรูปพื้นหลัง");
    } finally {
      setUploadingBackground(false);
      if (backgroundInputRef.current) backgroundInputRef.current.value = "";
    }
  };

  const handleRemoveBackground = () => {
    setBackgroundPaths((prev) => ({ ...prev, [paperSize]: { ...prev[paperSize], [activeGroup]: "" } }));
    setBackgroundUrls((prev) => ({ ...prev, [paperSize]: { ...prev[paperSize], [activeGroup]: "" } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 🧩 กลุ่มอื่นนอกจาก shared ทั้งหมด (ครบ 7 กลุ่มแล้ว) รวมเป็น payload เดียว ใช้ซ้ำได้ทั้ง A4/Letter/Half Letter
      const buildGroupsPayload = (paper: PaperSize) => {
        const g = layouts[paper];
        return {
          delivery_note: normalizeColumnGroups(g.delivery_note, "delivery_note"),
          purchase_order: normalizeColumnGroups(g.purchase_order, "purchase_order"),
          goods_receipt: normalizeColumnGroups(g.goods_receipt, "goods_receipt"),
          contractor_work_order: normalizeColumnGroups(g.contractor_work_order, "contractor_work_order"),
          receipt_voucher: normalizeColumnGroups(g.receipt_voucher, "receipt_voucher"),
          stock_movement: normalizeColumnGroups(g.stock_movement, "stock_movement"),
        };
      };
      const buildBgPayload = (paper: PaperSize) => {
        const b = backgroundPaths[paper];
        return {
          shared: b.shared || null,
          delivery_note: b.delivery_note || null,
          purchase_order: b.purchase_order || null,
          goods_receipt: b.goods_receipt || null,
          contractor_work_order: b.contractor_work_order || null,
          receipt_voucher: b.receipt_voucher || null,
          stock_movement: b.stock_movement || null,
        };
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
          letter_layout: normalizeColumnGroups(layouts.Letter.shared, "shared"),
          letter_layout_groups: buildGroupsPayload("Letter"),
          letter_layout_background_paths: buildBgPayload("Letter"),
          a4_layout: normalizeColumnGroups(layouts.A4.shared, "shared"),
          a4_layout_groups: buildGroupsPayload("A4"),
          a4_layout_background_paths: buildBgPayload("A4"),
          half_letter_layout: normalizeColumnGroups(layouts.HalfLetter.shared, "shared"),
          half_letter_layout_groups: buildGroupsPayload("HalfLetter"),
          half_letter_layout_background_paths: buildBgPayload("HalfLetter"),
          a4_accent_colors: accentColors,
        }),
      );

      const res = await fetch(`${apiUrl}/company`, {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
      });

      if (res.ok) {
        toast.success("บันทึกตำแหน่งจัดวางเอกสารสำเร็จ");
        setIsNewDeliveryNoteGroup(false);
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
    const defaults = DEFAULT_LAYOUTS_BY_PAPER_SIZE[paperSize];
    setLayouts((prev) => ({
      ...prev,
      [paperSize]: { ...prev[paperSize], [activeGroup]: { ...defaults[activeGroup] } },
    }));
    setSelectedKey(null);
    setIsResetOpen(false);
  };

  // 🎭 ตัวอย่างข้อมูลจำลอง ใช้ดูตัวอย่าง PDF เฉพาะ 4 กลุ่มใหม่ (แต่ละ template รับ prop คนละชุดกับ SalesPdfTemplate)
  const SAMPLE_CONTACT = {
    business_name: "บริษัท ตัวอย่าง จำกัด",
    address: "123 ถนนตัวอย่าง กรุงเทพฯ",
    tax_id: "0000000000000",
    phone: "02-000-0000",
  };
  const samplePoGrItems = SAMPLE_ITEMS.map((i) => ({ ...i, unit_price: i.unit_price, wht_rate: 0 }));
  const sampleSubtotal = SAMPLE_ITEMS.reduce((s, i) => s + i.total_price, 0);
  // 🛡️ ใส่ทั้ง 2 รูปแบบชื่อฟิลด์ (snake_case ที่ shared/PO/GR ใช้ กับ camelCase ที่ ContractorWorkOrderPdfTemplate
  // ใช้เอง — ไม่เหมือนกันข้ามไฟล์) เทมเพลตไหนอ่านชื่อไหนก็เจอค่าจริง ไม่ใช่ 0.00 เหมือนที่เจอบั๊กจริงมาก่อน
  // (ContractorWorkOrderPdfTemplate ไม่มี VAT ในสรุปยอด มีแค่หักส่วนลด+หัก ณ ที่จ่าย จึง grandTotal = afterDiscount)
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

  // 🖨️ แต่ละกลุ่ม layout ผูกกับ template คนละไฟล์ + ชนิดข้อมูลคนละชุด — dispatch ตาม activeGroup ตรงนี้ที่เดียว
  const handlePreviewPDF = async () => {
    const toastId = toast.loading("กำลังสร้างตัวอย่างเอกสาร...");
    // 🎨 ให้พรีวิวเห็นสี headerDivider ที่กำลังเลือกอยู่ทันที แม้ยังไม่กดบันทึก (เหมือนตำแหน่งกล่องที่ preview
    // ตาม state `layouts` สดๆ อยู่แล้ว ไม่ใช่ค่าที่เคย save ไว้)
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
      document_settings: { ...(baseDocSettings || {}), a4_accent_colors: accentColors },
    };
    try {
      const { pdf } = await import("@react-pdf/renderer");
      let element: React.ReactElement;

      if (activeGroup === "shared" || activeGroup === "delivery_note") {
        const { default: SalesPdfTemplate } = await import("@/components/documents/SalesPdfTemplate");
        const isDeliveryNote = activeGroup === "delivery_note";
        element = (
          <SalesPdfTemplate
            data={{
              companySettingsForPreview,
              formData: {
                document_type: isDeliveryNote ? "delivery_note" : "quotation",
                document_number: isDeliveryNote ? "DO-2608-0000" : "QT-2608-0000",
                issue_date: dayjs().format("YYYY-MM-DD"),
                credit_days: 7,
                tax_type: "exclude",
                note: `ตัวอย่างการจัดวางเอกสารขนาด ${paperSize}`,
                reference_number: "PO27-000000",
                saleman_code: "SALE-01",
              },
              selectedContact: SAMPLE_CONTACT,
              items: SAMPLE_ITEMS,
              finance: sampleFinance,
              documentNumber: isDeliveryNote ? "DO-2608-0000" : "QT-2608-0000",
              paperSize,
              letterLayout: isDeliveryNote ? undefined : layout,
              deliveryNoteLetterLayout: isDeliveryNote ? layout : undefined,
            }}
          />
        );
      } else if (activeGroup === "purchase_order") {
        const { default: POPdfTemplate } = await import("@/components/documents/POPdfTemplate");
        element = (
          <POPdfTemplate
            data={{
              companySettingsForPreview,
              formData: { expected_date: dayjs().format("YYYY-MM-DD"), reference_number: "REF-0000", credit_days: 7 },
              selectedContact: SAMPLE_CONTACT,
              items: samplePoGrItems,
              finance: sampleFinance,
              poNumber: "PO-2608-0000",
              footerCondition: `ตัวอย่างการจัดวางเอกสารขนาด ${paperSize}`,
              paperSize,
              letterLayout: layout,
            }}
          />
        );
      } else if (activeGroup === "goods_receipt") {
        const { default: GRPdfTemplate } = await import("@/components/documents/GRPdfTemplate");
        element = (
          <GRPdfTemplate
            data={{
              companySettingsForPreview,
              grData: {
                gr_number: "GR-2608-0000",
                received_date: dayjs().format("YYYY-MM-DD"),
                reference_number: "PO-2608-0000",
                note: `ตัวอย่างการจัดวางเอกสารขนาด ${paperSize}`,
              },
              items: samplePoGrItems,
              creator: { name: "ผู้ใช้ตัวอย่าง" },
              paperSize,
              letterLayout: layout,
            }}
          />
        );
      } else if (activeGroup === "contractor_work_order") {
        const { default: ContractorWorkOrderPdfTemplate } = await import(
          "@/components/documents/ContractorWorkOrderPdfTemplate"
        );
        element = (
          <ContractorWorkOrderPdfTemplate
            data={{
              companySettingsForPreview,
              formData: { order_date: dayjs().format("YYYY-MM-DD"), site_reference: "หน่วยงานตัวอย่าง" },
              selectedContact: SAMPLE_CONTACT,
              items: samplePoGrItems,
              finance: sampleFinance,
              orderNumber: "WO-2608-0000",
              paperSize,
              letterLayout: layout,
            }}
          />
        );
      } else if (activeGroup === "receipt_voucher") {
        const { default: ReceiptVoucherPdfTemplate } = await import(
          "@/components/documents/ReceiptVoucherPdfTemplate"
        );
        element = (
          <ReceiptVoucherPdfTemplate
            data={{
              companySettingsForPreview,
              contract: {
                receipt_voucher_number: "RV-2608-0000",
                guarantee_returned_date: dayjs().format("YYYY-MM-DD"),
                guarantee_amount: sampleFinance.grand_total,
                agency_name: SAMPLE_CONTACT.business_name,
                contract_number: "CT-2608-0000",
              },
              paperSize,
              letterLayout: layout,
            }}
          />
        );
      } else {
        // stock_movement — ใบเบิกสินค้า/ใบคืนสินค้า/ใบคืนสินค้าเช่า (ไม่มีราคาเลย)
        const { default: StockMovementPdfTemplate } = await import(
          "@/components/documents/StockMovementPdfTemplate"
        );
        element = (
          <StockMovementPdfTemplate
            data={{
              companySettingsForPreview,
              documentType: "stock_issue",
              documentNumber: "SI-2608-0000",
              formData: {
                doc_date: dayjs().format("YYYY-MM-DD"),
                note: `ตัวอย่างการจัดวางเอกสารขนาด ${paperSize}`,
                reference_label: "งานเช่า",
                reference_value: "งานตัวอย่าง",
              },
              contactName: SAMPLE_CONTACT.business_name,
              items: samplePoGrItems,
              paperSize,
              letterLayout: layout,
            }}
          />
        );
      }

      // 🩹 element ประกอบจาก template คนละไฟล์กัน 5 แบบ (if/else) TS อนุมาน type แคบเกินไปให้ตรงกับ DocumentProps
      // ที่ pdf() ต้องการเป๊ะ ทั้งที่จริงเป็น <Document> ทุกแบบ — cast ตรงนี้ที่เดียวพอ
      const blob = await pdf(element as React.ReactElement<any>).toBlob();
      setPreviewUrl(URL.createObjectURL(blob));
      toast.dismiss(toastId);
    } catch (e) {
      toast.error("สร้างตัวอย่าง PDF ไม่สำเร็จ", { id: toastId });
    }
  };

  // 🖱️ ใช้ window-level listener แทนการพึ่ง setPointerCapture บนกล่องเดียว — ถ้าลากเร็วจนเมาส์หลุดออกนอกกล่อง
  // (กล่องเล็กบางอันแคบกว่าระยะขยับเมาส์ต่อเฟรม) การฟังแค่บนตัว element เดิมจะทำให้ลากค้าง ไม่ขยับต่อ
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const dxPt = (e.clientX - drag.startX) / zoom;
      const dyPt = (e.clientY - drag.startY) / zoom;

      setLayouts((prevLayouts) => {
        const prevGroups = prevLayouts[paperSize];
        const prev = prevGroups[activeGroup];
        const box = prev[drag.key] || drag.startBox;
        const next = { ...box };
        if (drag.mode === "move") {
          next.x = clamp(drag.startBox.x + dxPt, 0, PAGE_WIDTH - box.width);
          next.y = clamp(drag.startBox.y + dyPt, 0, PAGE_HEIGHT - box.height);
        } else {
          next.width = clamp(drag.startBox.width + dxPt, MIN_WIDTH, PAGE_WIDTH - box.x);
          next.height = clamp(drag.startBox.height + dyPt, MIN_HEIGHT, PAGE_HEIGHT - box.y);
        }
        return { ...prevLayouts, [paperSize]: { ...prevGroups, [activeGroup]: { ...prev, [drag.key]: next } } };
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
  }, [activeGroup, zoom, paperSize, PAGE_WIDTH, PAGE_HEIGHT]);

  // ⌨️ กด Esc ปิดโหมดขยายเต็มจอ
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

  // 🖱️ Ctrl+scroll ซูมบน canvas — ไม่กด Ctrl ปล่อยให้ scroll ปกติ
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
    dragStateRef.current = {
      key,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ...layout[key] },
    };
  };

  const updateSelectedBox = (field: keyof LetterLayoutBox, value: number) => {
    if (!selectedKey) return;
    setLayouts((prevLayouts) => {
      const prevGroups = prevLayouts[paperSize];
      const prev = prevGroups[activeGroup];
      const box = prev[selectedKey];
      if (!box) return prevLayouts;
      const next = { ...box, [field]: value };
      if (field === "x") next.x = clamp(value, 0, PAGE_WIDTH - next.width);
      if (field === "y") next.y = clamp(value, 0, PAGE_HEIGHT - next.height);
      if (field === "width") next.width = clamp(value, MIN_WIDTH, PAGE_WIDTH - next.x);
      if (field === "height") next.height = clamp(value, MIN_HEIGHT, PAGE_HEIGHT - next.y);
      return { ...prevLayouts, [paperSize]: { ...prevGroups, [activeGroup]: { ...prev, [selectedKey]: next } } };
    });
  };

  const toggleVisible = (key: string) => {
    setLayouts((prevLayouts) => {
      const prevGroups = prevLayouts[paperSize];
      const prev = prevGroups[activeGroup];
      const box = prev[key];
      if (!box) return prevLayouts;
      return {
        ...prevLayouts,
        [paperSize]: { ...prevGroups, [activeGroup]: { ...prev, [key]: { ...box, visible: box.visible === false } } },
      };
    });
  };

  // 🧩 ปุ่ม "+ เพิ่มจุดวันที่" — เหมือน print-layouts (มีผลเฉพาะกลุ่มที่มีฟิลด์ metaDate คือ delivery_note)
  const addDateBox = () => {
    setLayouts((prevLayouts) => {
      const prevGroups = prevLayouts[paperSize];
      const current = prevGroups[activeGroup];
      const keys = getRepeatableDateKeys(current);
      const anchor = current[keys[0]] || current.metaDate;
      if (!anchor) return prevLayouts;
      const nextNum = keys.length + 1;
      const newKey = `metaDate_${nextNum}`;
      const newBox: LetterLayoutBox = {
        x: anchor.x,
        y: clamp(anchor.y + anchor.height + 4, 0, PAGE_HEIGHT - anchor.height),
        width: anchor.width,
        height: anchor.height,
        visible: true,
      };
      return { ...prevLayouts, [paperSize]: { ...prevGroups, [activeGroup]: { ...current, [newKey]: newBox } } };
    });
  };

  const removeDateBox = (key: string) => {
    setLayouts((prevLayouts) => {
      const prevGroups = prevLayouts[paperSize];
      const current = { ...prevGroups[activeGroup] };
      delete current[key];
      return { ...prevLayouts, [paperSize]: { ...prevGroups, [activeGroup]: current } };
    });
    if (selectedKey === key) setSelectedKey(null);
  };

  const switchGroup = (group: LetterLayoutGroup) => {
    setActiveGroup(group);
    setSelectedKey(null);
  };

  const switchPaperSize = (size: PaperSize) => {
    setPaperSize(size);
    setSelectedKey(null);
  };

  if (loading) return <AppLoading text="กำลังโหลดข้อมูลการจัดวางเอกสาร..." />;

  const selectedBox = selectedKey ? layout[selectedKey] : null;
  const selectedLabel =
    sections.find((s) => s.key === selectedKey)?.label ||
    (selectedKey?.startsWith("metaDate_") ? `วันที่ (จุดเพิ่ม ${selectedKey.split("_")[1]})` : undefined);
  const backgroundUrl = backgroundUrls[paperSize][activeGroup];

  const SectionRow = ({ boxKey, label, removable }: { boxKey: string; label: string; removable?: boolean }) => {
    const isChecked = layout[boxKey]?.visible !== false;
    return (
      <div
        onClick={() => setSelectedKey(boxKey)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer",
          selectedKey === boxKey ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100",
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
        {removable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeDateBox(boxKey);
            }}
            className={cn("p-0.5 rounded shrink-0 cursor-pointer", selectedKey === boxKey ? "hover:bg-blue-700" : "hover:bg-slate-200")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  const CanvasBox = ({ boxKey, label }: { boxKey: string; label: string }) => {
    const box = layout[boxKey] || DEFAULT_LAYOUTS_BY_PAPER_SIZE[paperSize][activeGroup][boxKey];
    if (!box) return null;
    const isSelected = selectedKey === boxKey;
    const isHidden = box.visible === false;
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          setSelectedKey(boxKey);
        }}
        onPointerDown={(e) => startDrag(e, boxKey, "move")}
        className={cn(
          "absolute border-2 rounded-md p-1.5 overflow-hidden cursor-move flex flex-col",
          isHidden
            ? "border-dashed border-slate-300 bg-slate-100/50 opacity-50"
            : isSelected
              ? "border-blue-500 bg-blue-50/70 z-10"
              : "border-blue-200 bg-blue-50/40 hover:border-blue-400",
        )}
        style={{
          left: box.x * zoom,
          top: box.y * zoom,
          width: box.width * zoom,
          height: box.height * zoom,
        }}
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
          {!["title", "customerInfo", "metaInfo", "itemsTable", "notes", "summary", "grandTotalText", "signatureLeft", "signatureRight"].includes(boxKey) && (
            <span className="text-[9px] text-slate-400 leading-tight">{label}</span>
          )}
        </div>
        <div
          onPointerDown={(e) => startDrag(e, boxKey, "resize")}
          className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-blue-500 rounded-tl cursor-nwse-resize"
        />
      </div>
    );
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <LayoutTemplate className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">จัดวางเอกสาร</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              ลากกล่องเพื่อย้ายตำแหน่ง ลากมุมล่างขวาเพื่อย่อ/ขยายขนาด — แต่ละแท็บ/แต่ละขนาดกระดาษมีตำแหน่งแยกอิสระจากกัน
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* 🖨️ สลับขนาดกระดาษที่กำลังจัดวางอยู่ — A4/Letter คนละตำแหน่งกันได้ */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-full">
            {PAPER_SIZES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => switchPaperSize(p.key)}
                className={cn(
                  "h-8 px-4 rounded-full text-sm font-bold transition-all cursor-pointer",
                  paperSize === p.key ? "bg-blue-600 text-white shadow-sm" : "text-slate-500",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handlePreviewPDF}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileText className="w-4 h-4 text-blue-600" /> ดูตัวอย่าง PDF
          </button>
          <AppTooltip label="รีเซ็ตเป็นค่าเริ่มต้น">
            <button
              type="button"
              onClick={() => setIsResetOpen(true)}
              className="flex items-center justify-center h-10 w-10 text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-105"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </AppTooltip>
          <AppTooltip label="ขยายเต็มจอ">
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="flex items-center justify-center h-10 w-10 text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-105"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </AppTooltip>
          <Link href="/company" className="w-full md:w-auto">
            <button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform">
              <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
            </button>
          </Link>
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

      {/* แท็บเลือกกลุ่มเอกสาร */}
      <div className="flex gap-2 mb-6">
        {LETTER_LAYOUT_GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => switchGroup(g.key)}
            className={cn(
              "h-10 px-5 rounded-full text-sm font-bold border transition-all cursor-pointer",
              activeGroup === g.key
                ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {activeGroup === "delivery_note" && paperSize === "Letter" && isNewDeliveryNoteGroup && (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-[11px] text-blue-700 leading-relaxed mb-6 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          ใบส่งสินค้าชั่วคราวย้ายมาจากหน้า &quot;ตั้งค่าจัดวางเอกสาร (Print Layouts)&quot; เดิม — ตำแหน่งกล่องเปลี่ยนโครงสร้างใหม่ทั้งหมด
          กำลังใช้ค่าเริ่มต้น กรุณาตรวจสอบและปรับตำแหน่งอีกครั้งก่อนบันทึก
        </div>
      )}

      {isFullscreen && (
        <AppTooltip label="ปิดโหมดเต็มจอ (Esc)">
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="fixed top-4 right-4 z-[110] p-2.5 text-slate-500 hover:text-red-500 bg-white hover:bg-red-50 rounded-full shadow-lg border border-slate-200 cursor-pointer transition-all"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        </AppTooltip>
      )}

      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-[100] bg-white p-6 overflow-auto flex flex-col lg:flex-row gap-6 items-start"
            : "flex flex-col lg:flex-row gap-6 items-start"
        }
      >
        {/* ฝั่งซ้าย: ส่วนประกอบเอกสาร + ตัวเลขปรับตำแหน่ง + รูปพื้นหลังอ้างอิง — ไม่ scroll ในตัวเอง */}
        <div className="w-full lg:w-1/3 space-y-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-700 mb-3">ส่วนประกอบเอกสาร</h3>
            <div className="space-y-1.5">
              {sections.map(({ key, label }) => (
                <React.Fragment key={key}>
                  <SectionRow boxKey={key} label={label} />
                  {key === "metaDate" && (
                    <>
                      {extraDateKeys.map((extraKey) => (
                        <SectionRow key={extraKey} boxKey={extraKey} label={`วันที่ (จุดเพิ่ม ${extraKey.split("_")[1]})`} removable />
                      ))}
                      <button
                        type="button"
                        onClick={addDateBox}
                        className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> เพิ่มจุดวันที่
                      </button>
                    </>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {selectedBox && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-700 mb-3">{selectedLabel}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">ตำแหน่ง X (pt)</label>
                  <input
                    type="number"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    value={Math.round(selectedBox.x)}
                    onChange={(e) => updateSelectedBox("x", Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">ตำแหน่ง Y (pt)</label>
                  <input
                    type="number"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    value={Math.round(selectedBox.y)}
                    onChange={(e) => updateSelectedBox("y", Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">ความกว้าง (pt)</label>
                  <input
                    type="number"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    value={Math.round(selectedBox.width)}
                    onChange={(e) => updateSelectedBox("width", Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">ความสูง (pt)</label>
                  <input
                    type="number"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    value={Math.round(selectedBox.height)}
                    onChange={(e) => updateSelectedBox("height", Number(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-500" /> รูปพื้นหลังอ้างอิง
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">
              อัปโหลดรูปถ่ายกระดาษตัวจริง เพื่อช่วยจัดตำแหน่งบนจอเท่านั้น (จะยืดรูปให้เต็มพื้นที่หน้ากระดาษ ไม่พิมพ์ลง PDF จริง)
            </p>
            <input
              ref={backgroundInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => handleBackgroundSelect(e.target.files?.[0] || null)}
            />
            {backgroundUrl ? (
              <div className="flex items-center gap-2 flex-wrap">
                <img
                  src={backgroundUrl}
                  alt="รูปพื้นหลังอ้างอิง"
                  className="w-12 h-16 object-cover rounded-lg border border-slate-200 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowBackground((v) => !v)}
                  className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center gap-1.5"
                >
                  {showBackground ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showBackground ? "ซ่อนพื้นหลัง" : "แสดงพื้นหลัง"}
                </button>
                <button
                  type="button"
                  onClick={() => backgroundInputRef.current?.click()}
                  className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  เปลี่ยนรูป
                </button>
                <AppTooltip label="ลบรูปพื้นหลัง">
                  <button
                    type="button"
                    onClick={handleRemoveBackground}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </AppTooltip>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => backgroundInputRef.current?.click()}
                disabled={uploadingBackground}
                className="w-full h-10 px-4 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {uploadingBackground ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                อัปโหลดรูปกระดาษตัวจริง
              </button>
            )}
          </div>

          {activeGroup === "shared" ? (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-[11px] text-amber-700 leading-relaxed">
              หน้ากระดาษ {paperSize} ขนาด {PAGE_WIDTH}×{PAGE_HEIGHT} pt
              {paperSize === "A4"
                ? " (210×297 มม.)"
                : paperSize === "HalfLetter"
                  ? " (8×5.5 นิ้ว แนวนอน)"
                  : " (8×11 นิ้ว)"}{" "}
              — พื้นที่แถบเหลืองด้านบน
              คือบริเวณที่กระดาษหัวจดหมายจริงมีโลโก้/ชื่อบริษัทอยู่แล้ว ระบบจะไม่พิมพ์โลโก้/ชื่อบริษัททับบริเวณนี้
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-[11px] text-blue-700 leading-relaxed">
              เอกสารนี้ระบบวาดข้อมูลบริษัท (ชื่อ/ที่อยู่/เลขผู้เสียภาษี) ให้เองแยกเป็นกล่องอิสระ
              ทุกกลุ่มข้อมูลมีเส้นกรอบแสดงตำแหน่งเสมอ (แม้บางเอกสารจะยังไม่มีข้อมูลเติมในบางช่อง ก็ยังเห็นกรอบว่างไว้ให้ปรับตำแหน่งได้)
            </div>
          )}
        </div>

        {/* ฝั่งขวา: Canvas จำลองหน้ากระดาษ Letter — scroll ได้เฉพาะโซนนี้ */}
        <div
          className={
            isFullscreen
              ? "w-full lg:w-2/3 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex-1"
              : "w-full lg:w-2/3 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:sticky lg:top-4"
          }
        >
          {/* 🔍 แถบควบคุมซูม + สีแถบหัวเอกสาร (เฉพาะ A4) อยู่แถวเดียวกัน */}
          <div className="flex items-center justify-between gap-3 mb-3">
            {/* 🎨 สีแถบหัวเอกสาร (headerDivider) — เฉพาะ A4 แยกต่อกลุ่มเอกสารที่กำลังแก้ไขอยู่ (activeGroup) */}
            {paperSize === "A4" ? (
              <div className="flex items-center gap-2 px-3 h-9 bg-slate-100 rounded-full">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">สีแถบหัวเอกสาร (กลุ่มนี้)</span>
                <input
                  type="color"
                  value={accentColors[activeGroup]}
                  onChange={(e) => setAccentColors((prev) => ({ ...prev, [activeGroup]: e.target.value }))}
                  className="w-6 h-6 rounded-full border border-slate-300 cursor-pointer p-0 overflow-hidden"
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
            ) : (
              <span />
            )}
            <div className="flex items-center gap-1.5">
            <AppTooltip label="ซูมออก">
              <button
                type="button"
                onClick={zoomOut}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
            </AppTooltip>
            <span className="text-xs font-bold text-slate-600 w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <AppTooltip label="ซูมเข้า">
              <button
                type="button"
                onClick={zoomIn}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </AppTooltip>
            <button
              type="button"
              onClick={zoomReset}
              className="h-8 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer ml-1"
            >
              รีเซ็ต 100%
            </button>
            </div>
          </div>
          <div
            className={cn(
              "rounded-xl bg-slate-100 flex justify-center",
              isFullscreen ? "max-h-[calc(100vh-11rem)] overflow-auto p-4" : "max-h-[calc(100vh-180px)] overflow-auto p-4",
            )}
            onWheel={handleCanvasWheel}
          >
            {/* 🎨 พื้นหลังกล่อง scroll เป็นสีอ่อน (bg-slate-100) ตัดกับตัวกระดาษที่เป็นสีขาว ให้เห็นขอบเขตกระดาษชัดเจน
                🛡️ padding (p-4) รอบกล่อง scroll ด้านบน — ให้แถบรูเจาะที่ยื่นออกนอกขอบซ้าย-ขวากระดาษมีที่ว่างให้แสดงผล
                ไม่งั้นจะโดน overflow-auto ของกล่องนี้ตัดหายไปเงียบๆ
                🕳️ แถบรูเจาะสายพานลำเลียง (sprocket hole strip) — เฉพาะ Letter/Half Letter จำลอง "กระดาษต่อเนื่อง"
                (continuous/fanfold stationery) จริงตามภาพอ้างอิงที่ผู้ใช้แนบ: มีแถบขอบยื่นออกนอกขนาดเอกสารจริงข้างละ
                0.5 นิ้ว (HOLE_STRIP_WIDTH=36pt) ทั้งซ้าย-ขวา ไม่ใช่รูคาบขอบกระดาษแบบเดิม — คำนวณ canvas รวม
                กว้างกว่าเอกสารจริง 2×HOLE_STRIP_WIDTH แล้ววางกระดาษ (สีขาว) ไว้ตรงกลาง โดยรูอยู่กึ่งกลางแถบที่เพิ่มมา
                A4 ไม่มีแถบนี้ (ไม่ใช่กระดาษต่อเนื่อง) */}
            {(() => {
              const showHoles = paperSize === "Letter" || paperSize === "HalfLetter";
              const stripW = showHoles ? HOLE_STRIP_WIDTH : 0;
              const holeYs = showHoles
                ? Array.from({ length: Math.floor((PAGE_HEIGHT - 36) / 36) + 1 }, (_, i) => 18 + i * 36)
                : [];
              return (
                <div
                  className="relative bg-white shrink-0"
                  style={{ width: (PAGE_WIDTH + stripW * 2) * zoom, height: PAGE_HEIGHT * zoom }}
                >
                  {showHoles &&
                    holeYs.map((y) => (
                      <React.Fragment key={y}>
                        <div
                          className="absolute rounded-full bg-slate-200 border border-slate-300 shadow-inner pointer-events-none"
                          style={{
                            left: (stripW / 2 - 5) * zoom,
                            top: y * zoom - 5 * zoom,
                            width: 10 * zoom,
                            height: 10 * zoom,
                          }}
                        />
                        <div
                          className="absolute rounded-full bg-slate-200 border border-slate-300 shadow-inner pointer-events-none"
                          style={{
                            left: (stripW + PAGE_WIDTH + stripW / 2 - 5) * zoom,
                            top: y * zoom - 5 * zoom,
                            width: 10 * zoom,
                            height: 10 * zoom,
                          }}
                        />
                      </React.Fragment>
                    ))}
                  <div
                    className="absolute bg-white border border-slate-300 shadow-md select-none"
                    style={{ left: stripW * zoom, top: 0, width: PAGE_WIDTH * zoom, height: PAGE_HEIGHT * zoom }}
                    onClick={() => setSelectedKey(null)}
                  >

              {/* รูปพื้นหลังอ้างอิง — ยืดเต็มพื้นที่หน้ากระดาษ ใช้ดูบนจอเท่านั้น */}
              {backgroundUrl && showBackground && (
                <img
                  src={backgroundUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full opacity-60 pointer-events-none"
                  style={{ objectFit: "fill" }}
                />
              )}

              {/* พื้นที่หัวกระดาษจริง (โลโก้/ชื่อบริษัทที่พิมพ์ไว้แล้วบนกระดาษ) — เฉพาะกลุ่มเอกสารทั่วไปที่สมมติว่ามีกระดาษหัวจดหมายพิมพ์ไว้แล้ว */}
              {activeGroup === "shared" && (
                <div
                  className="absolute top-0 left-0 right-0 border-b-2 border-dashed border-amber-300 bg-amber-50/50 flex items-center justify-center pointer-events-none"
                  style={{ height: 90 * zoom }}
                >
                  <span className="text-[10px] text-amber-600 font-bold">พื้นที่หัวกระดาษจริง (โลโก้ / ชื่อบริษัทบนกระดาษที่พิมพ์ไว้แล้ว)</span>
                </div>
              )}

              {sections.map(({ key, label }) => (
                <React.Fragment key={key}>
                  <CanvasBox boxKey={key} label={label} />
                  {key === "metaDate" &&
                    extraDateKeys.map((extraKey) => (
                      <CanvasBox key={extraKey} boxKey={extraKey} label={`วันที่ (เพิ่ม ${extraKey.split("_")[1]})`} />
                    ))}
                </React.Fragment>
              ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <AppConfirmDialog
        open={isResetOpen}
        onOpenChange={setIsResetOpen}
        icon={AlertTriangle}
        iconColorClass="bg-orange-50 text-orange-600 border-orange-100/50"
        title="รีเซ็ตตำแหน่งจัดวาง?"
        description="ยืนยันรีเซ็ตตำแหน่งจัดวางของแท็บนี้กลับเป็นค่าเริ่มต้นใช่หรือไม่?"
        confirmLabel="ยืนยันรีเซ็ต"
        confirmColorClass="bg-orange-500 hover:bg-orange-600 shadow-orange-500/20"
        onConfirm={executeReset}
      />

      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> ตัวอย่างเอกสารขนาด{" "}
                {PAPER_SIZES.find((p) => p.key === paperSize)?.label || paperSize}
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
              <iframe src={previewUrl} className="w-full h-full rounded-xl border border-slate-200" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
