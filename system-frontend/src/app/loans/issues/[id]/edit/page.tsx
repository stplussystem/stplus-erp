"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  PackageOpen,
  Save,
  ArrowLeft,
  Loader2,
  FileText,
  XCircle,
  User,
  Users,
  Plus,
  Trash2,
  ListOrdered,
  CheckCircle2,
  AlertCircle,
  Lock,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { ProductSearchDropdown } from "@/components/products/ProductSearchDropdown";
import { SerialPickerDialog } from "@/components/repairs/SerialPickerDialog";
import { ReservationDetailsDialog } from "@/components/products/ReservationDetailsDialog";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

type LoanDirection = "lend_out" | "borrow_in";
type PartyMode = "contact" | "manual";

interface LendItemRow {
  product_id: string;
  product_name: string;
  sku: string;
  has_serial_number: boolean;
  unit_name: string;
  quantity: number;
  serials: string[];
  stockQty: number;
  reservedQty: number;
}

interface BorrowItemRow {
  item_name: string;
  quantity: number;
  unit_name: string;
}

const emptyLendItem = (): LendItemRow => ({
  product_id: "",
  product_name: "",
  sku: "",
  has_serial_number: false,
  unit_name: "ชิ้น",
  quantity: 1,
  serials: [],
  stockQty: 0,
  reservedQty: 0,
});

const emptyBorrowItem = (): BorrowItemRow => ({
  item_name: "",
  quantity: 1,
  unit_name: "ชิ้น",
});

export default function LoanIssueEditPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id;

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  const [direction, setDirection] = useState<LoanDirection>("lend_out");
  const [partyMode, setPartyMode] = useState<PartyMode>("contact");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    document_number: "",
    contact_id: "",
    borrower_name: "",
    borrower_phone: "",
    warehouse_id: "",
    issue_date: dayjs().format("YYYY-MM-DD"),
    due_date: "",
    note: "",
  });

  const [lendItems, setLendItems] = useState<LendItemRow[]>([emptyLendItem()]);
  const [borrowItems, setBorrowItems] = useState<BorrowItemRow[]>([emptyBorrowItem()]);

  const [serialPickerIndex, setSerialPickerIndex] = useState<number | null>(null);
  const [reservationPopup, setReservationPopup] = useState<{ productId: string; productName: string } | null>(null);

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
        actualUser?.is_platform_admin === 1 || actualUser?.is_platform_admin === true;
      const roles = Array.isArray(actualUser?.roles) ? actualUser.roles : [];
      const perms = Array.isArray(actualUser?.permissions) ? actualUser.permissions : [];
      const isSuper = roles.some((role: any) =>
        typeof role === "string" ? role.includes("Super Admin") : role?.name?.includes("Super Admin"),
      );
      const hasPermission = perms.some((p: any) =>
        typeof p === "string" ? p === "edit_loan_issue" : p?.name === "edit_loan_issue",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        fetchMasterData();
        fetchDocumentData();
      } else {
        toast.error("คุณไม่มีสิทธิ์แก้ไขเอกสาร");
        router.push("/loans/issues");
      }
    } catch (e) {
      router.push("/");
    }
  }, [router, documentId]);

  const fetchMasterData = async () => {
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const [warehousesRes, companyRes] = await Promise.all([
        fetch(`${apiUrl}/warehouses`, { headers }),
        fetch(`${apiUrl}/company`, { headers }),
      ]);
      if (warehousesRes.ok) {
        const wData = await warehousesRes.json();
        setWarehouses(Array.isArray(wData) ? wData : wData?.data || []);
      }
      if (companyRes.ok) {
        const compData = await companyRes.json();
        setCompanySettings(Array.isArray(compData) ? compData[0] : compData.data || compData);
      }
    } catch (error) {}
  };

  const fetchDocumentData = async () => {
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      const res = await fetch(`${apiUrl}/sale-documents/${documentId}`, { headers });
      if (!res.ok) {
        toast.error("ไม่พบข้อมูลเอกสาร");
        router.push("/loans/issues");
        return;
      }
      const doc = (await res.json()).data;

      setFormData({
        document_number: doc.document_number,
        contact_id: doc.contact_id?.toString() || "",
        borrower_name: doc.borrower_name || "",
        borrower_phone: doc.borrower_phone || "",
        warehouse_id: doc.warehouse_id?.toString() || "",
        issue_date: doc.issue_date ? dayjs(doc.issue_date).format("YYYY-MM-DD") : "",
        due_date: doc.due_date ? dayjs(doc.due_date).format("YYYY-MM-DD") : "",
        note: doc.note || "",
      });
      const dir: LoanDirection = doc.loan_direction === "borrow_in" ? "borrow_in" : "lend_out";
      setDirection(dir);
      setPartyMode(doc.contact_id ? "contact" : "manual");
      if (doc.contact) setSelectedContact(doc.contact);

      const items = doc.items || [];
      if (dir === "lend_out") {
        const mapped: LendItemRow[] = await Promise.all(
          items.map(async (item: any) => {
            let stockQty = 0;
            let reservedQty = 0;
            try {
              const pRes = await fetch(`${apiUrl}/products/${item.product_id}`, { headers });
              if (pRes.ok) {
                const pData = (await pRes.json()).data;
                stockQty = Number(pData?.stock_balance?.qty || 0);
                reservedQty = Number(pData?.stock_balance?.reserved_qty || 0);
              }
            } catch (e) {}
            return {
              product_id: item.product_id?.toString() || "",
              product_name: item.product?.name || "",
              sku: item.product?.sku || "",
              has_serial_number: !!item.product?.has_serial_number,
              unit_name: item.unit_name || "ชิ้น",
              quantity: Number(item.quantity) || 1,
              serials: (item.serials || []).map((s: any) => s.serial_number || s),
              stockQty,
              reservedQty,
            };
          }),
        );
        setLendItems(mapped.length > 0 ? mapped : [emptyLendItem()]);
      } else {
        const mapped: BorrowItemRow[] = items.map((item: any) => ({
          item_name: item.item_name || "",
          quantity: Number(item.quantity) || 1,
          unit_name: item.unit_name || "ชิ้น",
        }));
        setBorrowItems(mapped.length > 0 ? mapped : [emptyBorrowItem()]);
      }
    } catch (error) {
      toast.error("ข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setFetching(false);
    }
  };

  const partyLabel = direction === "borrow_in" ? "ยืมจาก" : "ผู้ยืม";

  const handleLendProductSelect = (index: number, productId: string, productData: any) => {
    const newItems = [...lendItems];
    newItems[index] = {
      ...newItems[index],
      product_id: productId,
      product_name: productData.name,
      sku: productData.sku,
      has_serial_number: !!productData.has_serial_number,
      unit_name: productData.unit?.name || "ชิ้น",
      quantity: productData.has_serial_number ? 0 : 1,
      serials: [],
      stockQty: Number(productData.stock_balance?.qty || 0),
      reservedQty: Number(productData.stock_balance?.reserved_qty || 0),
    };
    setLendItems(newItems);
    setErrors((prev) => ({ ...prev, items: "" }));
  };

  const handleLendQuantityChange = (index: number, value: string) => {
    const newItems = [...lendItems];
    newItems[index] = { ...newItems[index], quantity: Number(value) || 0 };
    setLendItems(newItems);
  };

  const finance = { subtotal: 0, discount: 0, after_discount: 0, vat_amount: 0, wht_amount: 0, grand_total: 0, net_payable: 0 };

  const handlePreviewPDF = async () => {
    const toastId = toast.loading("กำลังสร้างตัวอย่างเอกสาร...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: SalesPdfTemplate } = await import("@/components/documents/SalesPdfTemplate");
      const { paperSize, letterLayout } = getPaperSizeConfig(companySettings, "loan_issue");
      const items =
        direction === "lend_out"
          ? lendItems.map((i) => ({ product_name: i.product_name, quantity: i.quantity, unit_name: i.unit_name, total_price: 0, wht_rate: 0, discount_amount: 0 }))
          : borrowItems.map((i) => ({ product_name: i.item_name, quantity: i.quantity, unit_name: i.unit_name, total_price: 0, wht_rate: 0, discount_amount: 0 }));
      const blob = await pdf(
        <SalesPdfTemplate
          data={{
            companySettings,
            formData: { ...formData, document_type: "loan_issue" },
            selectedContact:
              partyMode === "contact" ? selectedContact : { business_name: formData.borrower_name, mobile: formData.borrower_phone },
            items,
            finance,
            documentNumber: formData.document_number,
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
    if (partyMode === "contact" && !formData.contact_id)
      newErrors.contact_id = direction === "borrow_in" ? "กรุณาเลือกลูกค้าที่ยืมจาก" : "กรุณาเลือกลูกค้า";
    if (partyMode === "manual" && !formData.borrower_name.trim())
      newErrors.borrower_name = direction === "borrow_in" ? "กรุณาระบุชื่อผู้ให้ยืม" : "กรุณาระบุชื่อผู้ยืม";

    if (direction === "lend_out") {
      if (lendItems.some((i) => !i.product_id)) newErrors.items = "กรุณาเลือกสินค้าให้ครบทุกแถว";
      else if (lendItems.some((i) => i.has_serial_number && i.serials.length === 0))
        newErrors.items = "กรุณาเลือก S/N ที่จะยืมให้ครบทุกแถวที่คุม S/N";
      else if (lendItems.some((i) => i.quantity <= 0)) newErrors.items = "กรุณาระบุจำนวนที่ยืมให้ถูกต้อง";
    } else {
      if (borrowItems.some((i) => !i.item_name.trim())) newErrors.items = "กรุณาระบุชื่อสินค้าที่ยืมมาให้ครบทุกแถว";
      else if (borrowItems.some((i) => i.quantity <= 0)) newErrors.items = "กรุณาระบุจำนวนให้ถูกต้อง";
    }
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const payload = {
        contact_id: partyMode === "contact" ? formData.contact_id : null,
        borrower_name: partyMode === "manual" ? formData.borrower_name : null,
        borrower_phone: partyMode === "manual" ? formData.borrower_phone : null,
        warehouse_id: direction === "lend_out" ? formData.warehouse_id || null : null,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        note: formData.note,
        tax_type: "none",
        items:
          direction === "lend_out"
            ? lendItems.map((i) => ({
                product_id: i.product_id,
                quantity: i.quantity,
                unit_name: i.unit_name,
                unit_price: 0,
                serials: i.serials,
              }))
            : borrowItems.map((i) => ({
                item_name: i.item_name,
                quantity: i.quantity,
                unit_name: i.unit_name,
                unit_price: 0,
              })),
      };
      const res = await fetch(`${apiUrl}/sale-documents/${documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error("อัปเดตไม่สำเร็จ", { id: toastId, description: (await res.json()).message });
        return;
      }
      toast.success("อัปเดตเอกสารสำเร็จ!", { id: toastId });
      router.push("/loans/issues");
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) return <div className="min-h-screen bg-muted/50"></div>;
  if (fetching) return <AppLoading text="กำลังโหลดข้อมูลเอกสาร..." />;

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 dark:border-amber-800/50 shadow-sm">
            <PackageOpen className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight flex items-center gap-2">
              แก้ไข <span className="text-amber-600">{formData.document_number}</span>
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              {direction === "lend_out" ? "แก้ไขรายละเอียดใบยืมสินค้า" : "แก้ไขรายละเอียดใบยืมของจากลูกค้า"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={handlePreviewPDF}
            className="h-10 px-4 rounded-full text-sm font-bold text-foreground bg-background border border-border hover:bg-muted/50 flex items-center gap-2 shadow-sm cursor-pointer transition-all hover:border-border"
          >
            <FileText className="w-4 h-4 text-amber-600" /> ตัวอย่าง PDF
          </button>
          <Link href="/loans/issues" className="w-full md:w-auto">
            <button
              type="button"
              className="h-10 px-4 rounded-full text-sm font-bold text-foreground bg-background border border-border hover:bg-muted/50 flex items-center gap-2 shadow-sm cursor-pointer transition-all hover:border-border"
            >
              <ArrowLeft className="w-4 h-4" /> ยกเลิก
            </button>
          </Link>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={loading}
            className="h-10 px-6 rounded-full text-white text-sm font-bold bg-amber-600 hover:bg-amber-700 gap-2 shadow-lg shadow-amber-600/20 flex items-center cursor-pointer transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} อัปเดตเอกสาร
          </button>
        </div>
      </div>

      <div className="bg-card p-6 rounded-2xl shadow-sm border border-border min-h-[500px]">
        <div className="mb-6">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{partyLabel}</label>
          {partyMode === "contact" ? (
            <div>
              <ContactSearchDropdown
                value={formData.contact_id}
                selectedName={selectedContact?.business_name || selectedContact?.name}
                selectedCode={selectedContact?.contact_code}
                hasError={!!errors.contact_id}
                onChange={(contactId, contactData) => {
                  setFormData({ ...formData, contact_id: contactId });
                  setSelectedContact(contactData);
                  setErrors((prev) => ({ ...prev, contact_id: "" }));
                }}
              />
              {errors.contact_id && <p className="text-red-500 text-xs font-medium mt-1">{errors.contact_id}</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  ชื่อ{direction === "borrow_in" ? "ผู้ให้ยืม" : "ผู้ยืม"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={cn(
                    "w-full h-11 px-4 text-sm rounded-xl border outline-none focus:ring-2",
                    errors.borrower_name
                      ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                      : "border-border focus:border-amber-500 focus:ring-amber-100",
                  )}
                  placeholder="ชื่อ-นามสกุล"
                  value={formData.borrower_name}
                  onChange={(e) => {
                    setFormData({ ...formData, borrower_name: e.target.value });
                    setErrors((prev) => ({ ...prev, borrower_name: "" }));
                  }}
                />
                {errors.borrower_name && <p className="text-red-500 text-xs font-medium mt-1">{errors.borrower_name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">เบอร์โทร</label>
                <input
                  type="text"
                  className="w-full h-11 px-4 text-sm rounded-xl border border-border outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  placeholder="เช่น 0812345678"
                  value={formData.borrower_phone}
                  onChange={(e) => setFormData({ ...formData, borrower_phone: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        <div
          className={cn(
            "grid grid-cols-1 gap-5 mb-8 p-5 border border-border rounded-xl bg-muted/50",
            direction === "lend_out" ? "md:grid-cols-3" : "md:grid-cols-2",
          )}
        >
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่ยืม</label>
            <AppDatePicker
              value={formData.issue_date}
              onChange={(v) => setFormData({ ...formData, issue_date: v })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่ต้องคืน</label>
            <AppDatePicker
              value={formData.due_date}
              onChange={(v) => setFormData({ ...formData, due_date: v })}
            />
          </div>
          {direction === "lend_out" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">คลังสินค้า (ถ้ามี)</label>
              <AppSelect
                value={formData.warehouse_id || "__none__"}
                onValueChange={(v) => setFormData({ ...formData, warehouse_id: v === "__none__" ? "" : v })}
                options={[
                  { value: "__none__", label: "-- ไม่ระบุ --" },
                  ...warehouses.map((w) => ({ value: String(w.id), label: w.name })),
                ]}
              />
            </div>
          )}
        </div>

        {errors.items && <p className="text-red-500 text-xs font-medium mb-2">{errors.items}</p>}

        {direction === "lend_out" ? (
          <div className="border border-border rounded-2xl overflow-hidden mb-6 z-10 relative">
            <div className="overflow-x-auto hide-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                  <tr>
                    <th className="px-4 py-3 w-10 text-center font-bold">#</th>
                    <th className="px-4 py-3 font-bold min-w-[240px]">ชื่อสินค้า</th>
                    <th className="px-4 py-3 w-32 text-center font-bold">ใช้ได้ไม่ติดจอง</th>
                    <th className="px-4 py-3 w-32 text-center font-bold">ติดจอง/ติดยืม</th>
                    <th className="px-4 py-3 w-28 text-center font-bold">จำนวนที่ยืม</th>
                    <th className="px-4 py-3 w-24 text-center font-bold">หน่วย</th>
                    <th className="px-4 py-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lendItems.map((item, index) => {
                    const availableQty = item.stockQty - item.reservedQty;
                    return (
                      <tr key={index} className="hover:bg-muted/50">
                        <td className="px-4 py-3 text-center text-muted-foreground">{index + 1}</td>
                        <td className="px-4 py-3">
                          <ProductSearchDropdown
                            value={item.product_id}
                            selectedSku={item.sku}
                            selectedName={item.product_name}
                            hasError={!!errors.items && !item.product_id}
                            onChange={(val, productData) => handleLendProductSelect(index, val, productData)}
                          />
                          {item.has_serial_number && item.product_id && (
                            <button
                              type="button"
                              onClick={() => setSerialPickerIndex(index)}
                              className={cn(
                                "mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all",
                                item.serials.length > 0
                                  ? "bg-green-50 text-green-600 hover:bg-green-100"
                                  : "bg-amber-50 text-amber-600 hover:bg-amber-100",
                              )}
                            >
                              {item.serials.length > 0 ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <AlertCircle className="w-3 h-3" />
                              )}
                              <ListOrdered className="w-3 h-3" /> เลือก S/N ({item.serials.length})
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-muted-foreground">
                          {item.product_id ? availableQty : "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.product_id ? (
                            <button
                              type="button"
                              onClick={() =>
                                setReservationPopup({ productId: item.product_id, productName: item.product_name })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 cursor-pointer transition-all"
                            >
                              <Lock className="w-3 h-3" /> {item.reservedQty}
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            readOnly={item.has_serial_number}
                            className={cn(
                              "w-full h-10 text-center border border-border rounded-xl text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100",
                              item.has_serial_number && "bg-muted/50 text-muted-foreground",
                            )}
                            value={item.quantity}
                            onChange={(e) => handleLendQuantityChange(index, e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            className="w-full h-10 text-center border border-border rounded-xl text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                            value={item.unit_name}
                            onChange={(e) => {
                              const newItems = [...lendItems];
                              newItems[index] = { ...newItems[index], unit_name: e.target.value };
                              setLendItems(newItems);
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setLendItems(lendItems.filter((_, i) => i !== index))}
                            disabled={lendItems.length === 1}
                            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border bg-muted/50">
              <button
                onClick={() => setLendItems([...lendItems, emptyLendItem()])}
                className="text-amber-600 text-sm font-bold flex items-center gap-1.5 hover:bg-amber-100 px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> เพิ่มแถวสินค้า
              </button>
            </div>
          </div>
        ) : (
          <div className="border border-border rounded-2xl overflow-hidden mb-6 z-10 relative">
            <div className="overflow-x-auto hide-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                  <tr>
                    <th className="px-4 py-3 w-10 text-center font-bold">#</th>
                    <th className="px-4 py-3 font-bold min-w-[280px]">รายการสินค้า (ของลูกค้า)</th>
                    <th className="px-4 py-3 w-28 text-center font-bold">จำนวน</th>
                    <th className="px-4 py-3 w-24 text-center font-bold">หน่วย</th>
                    <th className="px-4 py-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {borrowItems.map((item, index) => (
                    <tr key={index} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-center text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          className={cn(
                            "w-full h-10 px-3 border rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
                            errors.items && !item.item_name ? "border-red-500" : "border-border",
                          )}
                          placeholder="เช่น จอโปรเจคเตอร์ยี่ห้อ X (ของลูกค้า)"
                          value={item.item_name}
                          onChange={(e) => {
                            const newItems = [...borrowItems];
                            newItems[index] = { ...newItems[index], item_name: e.target.value };
                            setBorrowItems(newItems);
                            setErrors((prev) => ({ ...prev, items: "" }));
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className="w-full h-10 text-center border border-border rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...borrowItems];
                            newItems[index] = { ...newItems[index], quantity: Number(e.target.value) || 0 };
                            setBorrowItems(newItems);
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          className="w-full h-10 text-center border border-border rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          value={item.unit_name}
                          onChange={(e) => {
                            const newItems = [...borrowItems];
                            newItems[index] = { ...newItems[index], unit_name: e.target.value };
                            setBorrowItems(newItems);
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setBorrowItems(borrowItems.filter((_, i) => i !== index))}
                          disabled={borrowItems.length === 1}
                          className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border bg-muted/50">
              <button
                onClick={() => setBorrowItems([...borrowItems, emptyBorrowItem()])}
                className="text-indigo-600 text-sm font-bold flex items-center gap-1.5 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> เพิ่มแถวสินค้า
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-foreground mb-2">หมายเหตุ</label>
          <textarea
            rows={3}
            className="w-full p-4 rounded-2xl border border-border outline-none text-sm resize-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all bg-muted/50 focus:bg-background"
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
                <FileText className="w-5 h-5 text-amber-500" /> พรีวิวตัวอย่างเอกสาร ({formData.document_number})
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

      {serialPickerIndex !== null && (
        <SerialPickerDialog
          isOpen={serialPickerIndex !== null}
          onClose={() => setSerialPickerIndex(null)}
          productId={lendItems[serialPickerIndex].product_id}
          productName={lendItems[serialPickerIndex].product_name}
          quantity={Math.max(1, lendItems[serialPickerIndex].stockQty - lendItems[serialPickerIndex].reservedQty)}
          value={lendItems[serialPickerIndex].serials}
          flexible
          onConfirm={(serials) => {
            const newItems = [...lendItems];
            newItems[serialPickerIndex] = { ...newItems[serialPickerIndex], serials, quantity: serials.length };
            setLendItems(newItems);
          }}
        />
      )}

      {reservationPopup && (
        <ReservationDetailsDialog
          isOpen={!!reservationPopup}
          onClose={() => setReservationPopup(null)}
          productId={reservationPopup.productId}
          productName={reservationPopup.productName}
        />
      )}
    </div>
  );
}
