"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PackageMinus,
  Save,
  ArrowLeft,
  Loader2,
  ListOrdered,
  CheckCircle2,
  AlertCircle,
  FileText,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { SerialPickerDialog } from "@/components/repairs/SerialPickerDialog";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

// 🏠 คืนอุปกรณ์เช่า อ้างอิงใบเบิกสินค้า (stock_issue) เท่านั้น — แยกออกจาก sales/stock-returns/create เดิม
// (ที่เหลือเฉพาะคืนจากใบลดหนี้) เป็น document_type ของตัวเอง (rental_stock_return) ไม่มี toggle สลับโหมดอีกต่อไป
// เพราะหน้านี้มีบริบทเดียวเท่านั้น

interface RentalJobOption {
  id: number;
  name: string;
  contact_id: number | null;
  contact?: { business_name?: string; name?: string } | null;
}

interface IssueDocOption {
  id: number;
  document_number: string;
  issue_date: string;
}

interface ReturnItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  maxQuantity: number;
  unit_name: string;
  unit_price: number;
  has_serial_number: boolean;
  serials: string[];
  included: boolean;
}

export default function RentalStockReturnCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillRentalJobId = searchParams.get("rental_job_id");

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingIssueDoc, setLoadingIssueDoc] = useState(false);

  const [rentalJobs, setRentalJobs] = useState<RentalJobOption[]>([]);
  const [rentalJobLocked, setRentalJobLocked] = useState(false);
  const [issueDocs, setIssueDocs] = useState<IssueDocOption[]>([]);

  const [formData, setFormData] = useState({
    document_type: "rental_stock_return",
    rental_job_id: "",
    contact_id: "",
    reference_document_id: "",
    issue_date: dayjs().format("YYYY-MM-DD"),
    note: "",
  });

  const [items, setItems] = useState<ReturnItem[]>([]);
  const [serialPickerIndex, setSerialPickerIndex] = useState<number | null>(
    null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchCompanySettings = async () => {
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/company`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setCompanySettings(Array.isArray(data) ? data[0] : data.data || data);
      }
    } catch (error) {}
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
          ? p === "create_rental_stock_return"
          : p?.name === "create_rental_stock_return",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        fetchRentalJobs();
        fetchCompanySettings();
      } else {
        toast.error("คุณไม่มีสิทธิ์สร้างเอกสาร");
        router.push("/sales/rental-stock-returns");
      }
    } catch (e) {
      router.push("/");
    }
  }, [router]);

  const fetchRentalJobs = async () => {
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/rental-jobs`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRentalJobs(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {}
  };

  // 🚀 ถ้ามาจากหน้า hub งานเช่า (?rental_job_id=X) ให้ prefill + ล็อกไว้เลย
  useEffect(() => {
    if (
      prefillRentalJobId &&
      rentalJobs.length > 0 &&
      !formData.rental_job_id
    ) {
      const job = rentalJobs.find((j) => String(j.id) === prefillRentalJobId);
      if (job) {
        setFormData((prev) => ({
          ...prev,
          rental_job_id: prefillRentalJobId,
          contact_id: job.contact_id ? String(job.contact_id) : "",
        }));
        setRentalJobLocked(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillRentalJobId, rentalJobs]);

  // 🎪 พอเลือกงานเช่าแล้ว ดึงใบเบิกสินค้าที่อนุมัติแล้วของงานนี้มาให้เลือกอ้างอิง
  useEffect(() => {
    if (!formData.rental_job_id) {
      setIssueDocs([]);
      return;
    }
    (async () => {
      try {
        const token = getToken();
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
        const res = await fetch(
          `${apiUrl}/sale-documents?rental_job_id=${formData.rental_job_id}&type=stock_issue&status=Approved`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          },
        );
        if (res.ok) setIssueDocs(await res.json());
      } catch (error) {}
    })();
  }, [formData.rental_job_id]);

  const handleRentalJobChange = (jobId: string) => {
    const job = rentalJobs.find((j) => String(j.id) === jobId);
    setFormData({
      ...formData,
      rental_job_id: jobId,
      contact_id: job?.contact_id ? String(job.contact_id) : "",
      reference_document_id: "",
    });
    setItems([]);
  };

  // 🎪 เลือกใบเบิกสินค้าที่จะคืนอ้างอิง — copy รายการสินค้า/จำนวนมาตั้งต้นจากใบเบิกนั้นตรงๆ
  const handleIssueDocChange = async (issueId: string) => {
    setFormData((prev) => ({ ...prev, reference_document_id: issueId }));
    setItems([]);
    if (!issueId) return;
    setLoadingIssueDoc(true);
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/sale-documents/${issueId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        const doc = data.data;
        const mapped: ReturnItem[] = (doc.items || []).map((it: any) => ({
          product_id: String(it.product_id),
          product_name: it.product?.name || "",
          sku: it.product?.sku || "",
          quantity: Number(it.quantity),
          maxQuantity: Number(it.quantity),
          unit_name: it.unit_name,
          unit_price: 0,
          has_serial_number: !!it.product?.has_serial_number,
          serials: [],
          included: true,
        }));
        setItems(mapped);
      }
    } catch (error) {
      toast.error("โหลดรายการจากใบเบิกไม่สำเร็จ");
    } finally {
      setLoadingIssueDoc(false);
    }
  };

  const handleQuantityChange = (index: number, value: string) => {
    const newItems = [...items];
    let qty = Number(value) || 0;
    if (qty > newItems[index].maxQuantity) qty = newItems[index].maxQuantity;
    newItems[index] = { ...newItems[index], quantity: qty, serials: [] };
    setItems(newItems);
  };

  const toggleIncluded = (index: number) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      included: !newItems[index].included,
      serials: [],
    };
    setItems(newItems);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.rental_job_id)
      newErrors.rental_job_id = "กรุณาเลือกงานเช่าก่อน";
    if (!formData.reference_document_id)
      newErrors.reference_document_id = "กรุณาเลือกใบเบิกสินค้าที่จะคืนอ้างอิง";
    const includedItems = items.filter((i) => i.included);
    if (includedItems.length === 0)
      newErrors.items = "กรุณาเลือกรายการสินค้าที่จะคืนอย่างน้อย 1 รายการ";
    if (includedItems.some((i) => i.quantity <= 0))
      newErrors.items = "จำนวนที่คืนต้องมากกว่า 0";
    if (
      includedItems.some(
        (i) => i.has_serial_number && i.serials.length !== i.quantity,
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
        tax_type: "none",
        grand_total: 0,
        items: items
          .filter((i) => i.included)
          .map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_name: item.unit_name,
            unit_price: item.unit_price,
            serials: item.serials,
          })),
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
      router.push("/sales/rental-stock-returns");
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // 🖨️ ดูตัวอย่าง PDF — เดิมหน้านี้ไม่มีปุ่มพิมพ์/ดูตัวอย่างเลย เพิ่มตาม pattern เดียวกับเอกสารประเภทอื่นทุกประการ
  const handlePreviewPDF = async () => {
    if (!formData.reference_document_id) {
      toast.error("กรุณาเลือกใบเบิกสินค้าก่อนดูตัวอย่าง");
      return;
    }
    const toastId = toast.loading("กำลังสร้างตัวอย่างเอกสาร...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: StockMovementPdfTemplate } = await import(
        "@/components/documents/StockMovementPdfTemplate"
      );
      const job = rentalJobs.find((j) => String(j.id) === formData.rental_job_id);
      const issueDoc = issueDocs.find(
        (d) => String(d.id) === formData.reference_document_id,
      );
      const { paperSize, letterLayout } = getPaperSizeConfig(
        companySettings,
        "rental_stock_return",
      );
      const blob = await pdf(
        <StockMovementPdfTemplate
          data={{
            companySettings,
            documentType: "rental_stock_return",
            documentNumber: "ตัวอย่าง-XXXX",
            formData: {
              doc_date: formData.issue_date,
              note: formData.note,
              reference_label: "อ้างอิงใบเบิกสินค้า",
              reference_value: issueDoc?.document_number || "-",
            },
            contactName: job?.contact?.business_name || job?.contact?.name || "-",
            items: items.filter((i) => i.included),
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

  if (!isAuthorized) return <div className="min-h-screen bg-slate-50"></div>;

  const hasRentalJob = !!formData.rental_job_id;
  const hasIssueDoc = !!formData.reference_document_id;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <PackageMinus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              สร้างใบคืนสินค้าเช่า
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              รับคืนอุปกรณ์เช่าจากใบเบิกสินค้าของงานเช่า
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={handlePreviewPDF}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileText className="w-4 h-4 text-blue-600" /> ดูตัวอย่าง
          </button>
          <Link href="/sales/rental-stock-returns" className="w-full md:w-auto">
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
            disabled={loading || !hasIssueDoc}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 p-5 border border-slate-100 rounded-xl bg-slate-50/50">
          <div>
            <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              งานเช่า <span className="text-red-500">*</span>
            </label>
            <AppSelect
              value={formData.rental_job_id || "__none__"}
              onValueChange={(v) => v !== "__none__" && handleRentalJobChange(v)}
              disabled={rentalJobLocked}
              error={!!errors.rental_job_id}
              options={[
                { value: "__none__", label: "-- เลือกงานเช่า --" },
                ...rentalJobs.map((j) => ({
                  value: String(j.id),
                  label: `${j.name}${j.contact ? ` (${j.contact.business_name || j.contact.name})` : ""}`,
                })),
              ]}
            />
            {errors.rental_job_id && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.rental_job_id}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              อ้างอิงใบเบิกสินค้า <span className="text-red-500">*</span>
            </label>
            <AppSelect
              value={formData.reference_document_id || "__none__"}
              onValueChange={(v) => v !== "__none__" && handleIssueDocChange(v)}
              disabled={!hasRentalJob}
              error={!!errors.reference_document_id}
              options={[
                {
                  value: "__none__",
                  label: hasRentalJob
                    ? "-- เลือกใบเบิกสินค้า --"
                    : "เลือกงานเช่าก่อน",
                },
                ...issueDocs.map((d) => ({
                  value: String(d.id),
                  label: `${d.document_number} (${dayjs(d.issue_date).format("DD/MM/YYYY")})`,
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
            <label className="block text-xs font-medium text-slate-500 mb-1">
              วันที่ออกเอกสาร
            </label>
            <AppDatePicker
              value={formData.issue_date}
              onChange={(v) => setFormData({ ...formData, issue_date: v })}
            />
          </div>
        </div>

        {!hasIssueDoc ? (
          <div className="py-16 text-center text-slate-400">
            <PackageMinus className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            กรุณาเลือกงานเช่าและใบเบิกสินค้าที่จะคืนอ้างอิงก่อน
            รายการสินค้าจะดึงมาจากใบเบิกนั้นให้อัตโนมัติ
          </div>
        ) : loadingIssueDoc ? (
          <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            กำลังโหลดรายการจากใบเบิก...
          </div>
        ) : (
          <>
            {errors.items && (
              <p className="text-red-500 text-xs font-medium mb-2">
                {errors.items}
              </p>
            )}
            <div className="border border-slate-200 rounded-2xl overflow-hidden mb-6 z-10 relative">
              <div className="overflow-x-auto hide-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center font-bold">
                        คืน
                      </th>
                      <th className="px-4 py-3 font-bold min-w-[280px]">
                        ชื่อสินค้า
                      </th>
                      <th className="px-4 py-3 w-32 text-center font-bold">
                        จำนวนที่คืน
                      </th>
                      <th className="px-4 py-3 w-24 text-center font-bold">
                        หน่วย
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, index) => (
                      <tr
                        key={index}
                        className={cn(
                          "hover:bg-slate-50/50",
                          !item.included && "opacity-40",
                        )}
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.included}
                            onChange={() => toggleIncluded(index)}
                            className="w-4 h-4 accent-blue-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-700">
                            {item.product_name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {item.sku} · เบิกไป {item.maxQuantity}{" "}
                            {item.unit_name}
                          </div>
                          {item.has_serial_number && item.included && (
                            <button
                              type="button"
                              onClick={() => setSerialPickerIndex(index)}
                              className={cn(
                                "mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all",
                                item.serials.length === item.quantity
                                  ? "bg-green-50 text-green-600 hover:bg-green-100"
                                  : "bg-amber-50 text-amber-600 hover:bg-amber-100",
                              )}
                            >
                              {item.serials.length === item.quantity ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <AlertCircle className="w-3 h-3" />
                              )}
                              <ListOrdered className="w-3 h-3" /> S/N:{" "}
                              {item.serials.length}/{item.quantity}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0.1"
                            max={item.maxQuantity}
                            step="1"
                            disabled={!item.included}
                            className="w-full h-10 text-center border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                            value={item.quantity}
                            onChange={(e) =>
                              handleQuantityChange(index, e.target.value)
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500">
                          {item.unit_name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                หมายเหตุ
              </label>
              <textarea
                rows={3}
                className="w-full p-4 rounded-2xl border border-slate-200 outline-none text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50 focus:bg-white"
                value={formData.note}
                onChange={(e) =>
                  setFormData({ ...formData, note: e.target.value })
                }
              />
            </div>
          </>
        )}
      </div>

      {serialPickerIndex !== null && (
        <SerialPickerDialog
          isOpen={serialPickerIndex !== null}
          onClose={() => setSerialPickerIndex(null)}
          productId={items[serialPickerIndex].product_id}
          productName={items[serialPickerIndex].product_name}
          quantity={items[serialPickerIndex].quantity}
          value={items[serialPickerIndex].serials}
          fetchUrl={`${apiUrl}/sale-documents/${formData.reference_document_id}/rented-serials?product_id=${items[serialPickerIndex].product_id}`}
          onConfirm={(serials) => {
            const newItems = [...items];
            newItems[serialPickerIndex] = {
              ...newItems[serialPickerIndex],
              serials,
            };
            setItems(newItems);
          }}
        />
      )}

      {/* 🚀 กรอบพรีวิว PDF ตัวจริงเสียงจริงใต้แอปในหน้าเดิม ปลอดภัยสำหรับ PWA */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> ตัวอย่างเอกสารจริง
              </h3>
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
            <div className="flex-1 bg-slate-100 p-2">
              <iframe src={previewUrl} className="w-full h-full rounded-xl border border-slate-200" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
