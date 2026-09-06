"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PackagePlus,
  Plus,
  Trash2,
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
import { ProductSearchDropdown } from "@/components/products/ProductSearchDropdown";
import { SerialPickerDialog } from "@/components/repairs/SerialPickerDialog";
import { RelatedProductPromptDialog } from "@/components/products/RelatedProductPromptDialog";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

interface RentalJobOption {
  id: number;
  name: string;
  contact_id: number | null;
  contact?: { business_name?: string; name?: string } | null;
}

export default function StockIssueCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillRentalJobId = searchParams.get("rental_job_id");

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);

  const [rentalJobs, setRentalJobs] = useState<RentalJobOption[]>([]);
  const [rentalJobLocked, setRentalJobLocked] = useState(false);

  const [formData, setFormData] = useState({
    document_type: "stock_issue",
    rental_job_id: "",
    contact_id: "",
    issue_date: dayjs().format("YYYY-MM-DD"),
    note: "",
  });

  const [items, setItems] = useState([
    {
      product_id: "",
      product_name: "",
      sku: "",
      quantity: 1,
      unit_name: "ชิ้น",
      unit_price: 0,
      has_serial_number: false,
      serials: [] as string[],
    },
  ]);

  const [serialPickerIndex, setSerialPickerIndex] = useState<number | null>(
    null,
  );
  const [relatedPrompt, setRelatedPrompt] = useState<{
    sourceProductName: string;
    products: any[];
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
          ? p === "create_stock_issue"
          : p?.name === "create_stock_issue",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        fetchRentalJobs();
        fetchCompanySettings();
      } else {
        toast.error("คุณไม่มีสิทธิ์สร้างเอกสาร");
        router.push("/sales/stock-issues");
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

  // 🖨️ ดูตัวอย่าง PDF — เดิมหน้านี้ไม่มีปุ่มพิมพ์/ดูตัวอย่างเลย เพิ่มตาม pattern เดียวกับเอกสารประเภทอื่นทุกประการ
  const handlePreviewPDF = async () => {
    if (!formData.rental_job_id) {
      toast.error("กรุณาเลือกงานเช่าก่อนดูตัวอย่าง");
      return;
    }
    const toastId = toast.loading("กำลังสร้างตัวอย่างเอกสาร...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: StockMovementPdfTemplate } = await import(
        "@/components/documents/StockMovementPdfTemplate"
      );
      const job = rentalJobs.find((j) => String(j.id) === formData.rental_job_id);
      const { paperSize, letterLayout } = getPaperSizeConfig(companySettings, "stock_issue");
      const blob = await pdf(
        <StockMovementPdfTemplate
          data={{
            companySettings,
            documentType: "stock_issue",
            documentNumber: "ตัวอย่าง-XXXX",
            formData: {
              doc_date: formData.issue_date,
              note: formData.note,
              reference_label: "งานเช่า",
              reference_value: job?.name || "-",
            },
            contactName: job?.contact?.business_name || job?.contact?.name || "-",
            items,
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

  const handleRentalJobChange = (jobId: string) => {
    const job = rentalJobs.find((j) => String(j.id) === jobId);
    setFormData({
      ...formData,
      rental_job_id: jobId,
      contact_id: job?.contact_id ? String(job.contact_id) : "",
    });
  };

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
    if (field === "quantity" && newItems[index].has_serial_number) {
      newItems[index].serials = [];
    }
    setItems(newItems);
  };

  const handleProductSelect = async (
    index: number,
    productId: string,
    productData: any,
  ) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      product_id: productId,
      product_name: productData.name,
      sku: productData.sku,
      unit_price: 0,
      has_serial_number: !!productData.has_serial_number,
      serials: [],
    };
    setItems(newItems);
    setErrors((prev) => ({ ...prev, items: "" }));

    // 🎪 เช็คสินค้าที่มักใช้คู่กัน — เด้ง popup บังคับให้เลือก
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/products/${productId}/related`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        const related = (data.data || []).filter(
          (rp: any) => rp.can_rent || rp.is_install_job,
        );
        if (related.length > 0) {
          setRelatedPrompt({
            sourceProductName: productData.name,
            products: related,
          });
        }
      }
    } catch (error) {
      // ไม่ critical ถ้าเช็คสินค้าคู่กันไม่สำเร็จ
    }
  };

  const addRelatedAsNewItem = (product: any) => {
    setItems((prev) => [
      ...prev,
      {
        product_id: String(product.id),
        product_name: product.name,
        sku: product.sku,
        quantity: 1,
        unit_name: "ชิ้น",
        unit_price: 0,
        has_serial_number: !!product.has_serial_number,
        serials: [],
      },
    ]);
    toast.success(`เพิ่ม "${product.name}" เข้ารายการแล้ว`);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.rental_job_id)
      newErrors.rental_job_id = "กรุณาเลือกงานเช่าก่อน";
    if (items.some((i) => !i.product_id))
      newErrors.items = "กรุณาเลือกสินค้าให้ครบทุกแถว";
    if (
      items.some((i) => i.has_serial_number && i.serials.length !== i.quantity)
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
        items: items.map((item) => ({ ...item })),
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
      router.push("/sales/stock-issues");
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) return <div className="min-h-screen bg-slate-50"></div>;

  const hasRentalJob = !!formData.rental_job_id;

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <PackagePlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              สร้างใบเบิกสินค้าเช่า
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              เบิกสินค้าเช่า/งานติดตั้งสำหรับงานเช่า
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
          <Link href="/sales/stock-issues" className="w-full md:w-auto">
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
            disabled={loading || !hasRentalJob}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5 p-5 border border-slate-100 rounded-xl bg-slate-50/50">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              งานเช่า <span className="text-red-500">*</span>
            </label>
            <AppSelect
              value={formData.rental_job_id || "__none__"}
              onValueChange={(v) =>
                v !== "__none__" && handleRentalJobChange(v)
              }
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
            <label className="block text-xs font-medium text-slate-500 mb-1">
              วันที่ออกเอกสาร
            </label>
            <AppDatePicker
              value={formData.issue_date}
              onChange={(v) => setFormData({ ...formData, issue_date: v })}
            />
          </div>
        </div>

        {!hasRentalJob ? (
          <div className="py-16 text-center text-slate-400">
            <PackagePlus className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            กรุณาเลือกงานเช่าก่อน จึงจะเริ่มเลือกสินค้าที่จะเบิกได้
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
                      <th className="px-4 py-3 w-10 text-center font-bold">
                        #
                      </th>
                      <th className="px-4 py-3 font-bold min-w-[280px]">
                        ชื่อสินค้า (เช่า/งานติดตั้งเท่านั้น)
                      </th>
                      <th className="px-4 py-3 w-24 text-center font-bold">
                        จำนวน
                      </th>
                      <th className="px-4 py-3 w-24 text-center font-bold">
                        หน่วย
                      </th>
                      <th className="px-4 py-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-center text-slate-400">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <ProductSearchDropdown
                            value={item.product_id}
                            selectedSku={item.sku}
                            selectedName={item.product_name}
                            hasError={!!errors.items && !item.product_id}
                            typeFilter="rent,install"
                            onChange={(val, productData) =>
                              handleProductSelect(index, val, productData)
                            }
                          />
                          {item.has_serial_number && (
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
                            min="1"
                            step="1"
                            className="w-full h-10 text-center border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "quantity",
                                e.target.value,
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            className="w-full h-10 text-center border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={item.unit_name}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "unit_name",
                                e.target.value,
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() =>
                              setItems(items.filter((_, i) => i !== index))
                            }
                            disabled={items.length === 1}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-slate-100 bg-slate-50/50">
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
                        has_serial_number: false,
                        serials: [],
                      },
                    ])
                  }
                  className="text-blue-600 text-sm font-bold flex items-center gap-1.5 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> เพิ่มแถวสินค้า
                </button>
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

      {relatedPrompt && (
        <RelatedProductPromptDialog
          isOpen={!!relatedPrompt}
          sourceProductName={relatedPrompt.sourceProductName}
          relatedProducts={relatedPrompt.products}
          onAdd={addRelatedAsNewItem}
          onClose={() => setRelatedPrompt(null)}
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
