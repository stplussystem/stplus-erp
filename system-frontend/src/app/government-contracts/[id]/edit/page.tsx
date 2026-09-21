"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { FileLock2, Save, ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";
import { RECEIPT_VOUCHER_DEFAULT_TEXT } from "@/lib/receiptVoucherText";

// 📋 ใบคุมสัญญาราชการ — หน้าแก้ไข โครงเดียวกับหน้าสร้าง แต่โหลดข้อมูลเดิมมาเติมก่อน
export default function GovernmentContractEditPage() {
  const router = useRouter();
  const params = useParams();
  const contractId = params.id as string;

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    project_id: "",
    agency_name: "",
    contract_number: "",
    contract_date: "",
    contract_amount: 0,
    guarantee_number: "",
    guarantee_amount: 0,
    guarantee_date: "",
    guarantee_return_requested_date: "",
    guarantee_returned_date: "",
    receipt_voucher_text: RECEIPT_VOUCHER_DEFAULT_TEXT,
    note: "",
  });
  const [receiptVoucherNumber, setReceiptVoucherNumber] = useState<
    string | null
  >(null);

  // 📅 วันครบสัญญา/ส่งมอบงาน — 1 สัญญามีได้หลายงวด (ดู GovernmentContractDueDate ฝั่ง backend)
  const [dueDates, setDueDates] = useState<{ due_date: string; note: string }[]>([
    { due_date: "", note: "" },
  ]);

  const addDueDateRow = () => setDueDates((prev) => [...prev, { due_date: "", note: "" }]);
  const removeDueDateRow = (index: number) =>
    setDueDates((prev) => prev.filter((_, i) => i !== index));
  const updateDueDateRow = (index: number, field: "due_date" | "note", value: string) =>
    setDueDates((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );

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
          ? p === "edit_government_contracts"
          : p?.name === "edit_government_contracts",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        fetchProjects();
        fetchContract();
      } else {
        toast.error("คุณไม่มีสิทธิ์แก้ไขข้อมูล");
        router.push("/government-contracts");
      }
    } catch (e) {
      router.push("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, contractId]);

  const fetchProjects = async () => {
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/projects`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : data?.data || []);
      }
    } catch (e) {}
  };

  const fetchContract = async () => {
    setFetching(true);
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/government-contracts/${contractId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const doc = (await res.json()).data;
        setFormData({
          project_id: String(doc.project_id || ""),
          agency_name: doc.agency_name || "",
          contract_number: doc.contract_number || "",
          contract_date: doc.contract_date || "",
          contract_amount: Number(doc.contract_amount) || 0,
          guarantee_number: doc.guarantee_number || "",
          guarantee_amount: Number(doc.guarantee_amount) || 0,
          guarantee_date: doc.guarantee_date || "",
          guarantee_return_requested_date:
            doc.guarantee_return_requested_date || "",
          guarantee_returned_date: doc.guarantee_returned_date || "",
          receipt_voucher_text: doc.receipt_voucher_text || RECEIPT_VOUCHER_DEFAULT_TEXT,
          note: doc.note || "",
        });
        setReceiptVoucherNumber(doc.receipt_voucher_number || null);
        const loadedDueDates = (doc.due_dates || []).map((d: any) => ({
          due_date: d.due_date || "",
          note: d.note || "",
        }));
        setDueDates(loadedDueDates.length > 0 ? loadedDueDates : [{ due_date: "", note: "" }]);
      } else {
        toast.error("ไม่พบข้อมูลสัญญานี้");
        router.push("/government-contracts");
      }
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ");
    } finally {
      setFetching(false);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.project_id) newErrors.project_id = "กรุณาเลือกโครงการ";
    if (!formData.agency_name.trim())
      newErrors.agency_name = "กรุณากรอกชื่อหน่วยงาน";
    if (!formData.contract_number.trim())
      newErrors.contract_number = "กรุณากรอกเลขที่สัญญา";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    setLoading(true);
    const toastId = toast.loading("กำลังบันทึกข้อมูล...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const payload = {
        ...formData,
        contract_date: formData.contract_date || null,
        guarantee_date: formData.guarantee_date || null,
        guarantee_return_requested_date:
          formData.guarantee_return_requested_date || null,
        guarantee_returned_date: formData.guarantee_returned_date || null,
        due_dates: dueDates
          .filter((row) => row.due_date || row.note)
          .map((row) => ({ due_date: row.due_date || null, note: row.note || null })),
      };
      const res = await fetch(`${apiUrl}/government-contracts/${contractId}`, {
        method: "PUT",
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
      const result = await res.json();
      setReceiptVoucherNumber(result?.data?.receipt_voucher_number || null);
      toast.success("บันทึกสำเร็จ!", { id: toastId });
      router.push("/government-contracts");
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) return <AppLoading text="กำลังตรวจสอบสิทธิ์การเข้าใช้งาน..." variant="bar" minHeight="min-h-screen" className="bg-muted/50" />;
  if (fetching) return <AppLoading minHeight="min-h-screen" />;

  return (
    <div className="w-full mx-auto px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileLock2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              แก้ไขสัญญาราชการ
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              {formData.contract_number} — {formData.agency_name}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
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

      <div className="bg-card p-6 rounded-2xl shadow-sm border border-border space-y-6">
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
            ข้อมูลสัญญา
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                โครงการ <span className="text-red-500">*</span>
              </label>
              <AppSelect
                value={formData.project_id || undefined}
                onValueChange={(v) => {
                  // 🆕 [2026-09-20] เปลี่ยนโครงการ → โหลดชื่อหน่วยงานจากลูกค้าของโครงการใหม่ (ยังแก้ไขเองได้)
                  const pj = projects.find((p) => String(p.id) === v);
                  const agency = pj?.contact?.business_name || pj?.contact?.contact_person_name || "";
                  setFormData({ ...formData, project_id: v, agency_name: agency || formData.agency_name });
                  setErrors((prev) => ({ ...prev, project_id: "", ...(agency ? { agency_name: "" } : {}) }));
                }}
                options={projects.map((pj) => ({
                  value: String(pj.id),
                  label: pj.name,
                }))}
                placeholder="-- เลือกโครงการ --"
                error={!!errors.project_id}
              />
              {errors.project_id && (
                <p className="text-red-500 text-xs font-medium mt-1">
                  {errors.project_id}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                ชื่อหน่วยงาน <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`w-full h-10 px-4 rounded-xl border outline-none text-sm ${
                  errors.agency_name
                    ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                }`}
                value={formData.agency_name}
                onChange={(e) => {
                  setFormData({ ...formData, agency_name: e.target.value });
                  setErrors((prev) => ({ ...prev, agency_name: "" }));
                }}
              />
              {errors.agency_name && (
                <p className="text-red-500 text-xs font-medium mt-1">
                  {errors.agency_name}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                เลขที่สัญญา <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`w-full h-10 px-4 rounded-xl border outline-none text-sm ${
                  errors.contract_number
                    ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                }`}
                value={formData.contract_number}
                onChange={(e) => {
                  setFormData({ ...formData, contract_number: e.target.value });
                  setErrors((prev) => ({ ...prev, contract_number: "" }));
                }}
              />
              {errors.contract_number && (
                <p className="text-red-500 text-xs font-medium mt-1">
                  {errors.contract_number}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                วันที่ทำสัญญา
              </label>
              <AppDatePicker
                value={formData.contract_date}
                onChange={(v) => setFormData({ ...formData, contract_date: v })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                จำนวนเงินตามสัญญา
              </label>
              <input
                type="number"
                min="0"
                className="w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                value={formData.contract_amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contract_amount: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-muted-foreground">
                วันครบสัญญา / ส่งมอบงาน{" "}
                <span className="text-muted-foreground font-normal normal-case">
                  (เพิ่มได้หลายงวดถ้ามีการต่ออายุ/ส่งมอบเป็นเฟส)
                </span>
              </label>
              <button
                type="button"
                onClick={addDueDateRow}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-3.5 h-3.5" /> เพิ่มงวด
              </button>
            </div>
            <div className="space-y-2">
              {dueDates.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-48">
                    <AppDatePicker
                      value={row.due_date}
                      onChange={(v) => updateDueDateRow(index, "due_date", v)}
                      placeholder="เลือกวันครบกำหนด"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="เช่น งวดที่ 1"
                    className="flex-1 h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    value={row.note}
                    onChange={(e) => updateDueDateRow(index, "note", e.target.value)}
                  />
                  {dueDates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDueDateRow(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
            หลักประกันสัญญา
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                เลขที่หนังสือค้ำประกัน
              </label>
              <input
                type="text"
                className="w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                value={formData.guarantee_number}
                onChange={(e) =>
                  setFormData({ ...formData, guarantee_number: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                จำนวนเงินหลักประกัน
              </label>
              <input
                type="number"
                min="0"
                className="w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                value={formData.guarantee_amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    guarantee_amount: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                วันที่ค้ำประกันถึง
              </label>
              <AppDatePicker
                value={formData.guarantee_date}
                onChange={(v) =>
                  setFormData({ ...formData, guarantee_date: v })
                }
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
            การคืนหลักประกัน
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                วันที่ยื่นขอคืนหลักประกัน
              </label>
              <AppDatePicker
                value={formData.guarantee_return_requested_date}
                onChange={(v) =>
                  setFormData({
                    ...formData,
                    guarantee_return_requested_date: v,
                  })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                วันที่ได้คืนหลักประกัน{" "}
                <span className="text-muted-foreground font-normal normal-case">
                  (ระบุแล้วจะพิมพ์ใบสำคัญรับเงินได้)
                </span>
              </label>
              <AppDatePicker
                value={formData.guarantee_returned_date}
                onChange={(v) =>
                  setFormData({ ...formData, guarantee_returned_date: v })
                }
              />
            </div>
          </div>
          {receiptVoucherNumber && (
            <p className="text-xs text-green-600 font-bold mt-3">
              เลขที่ใบสำคัญรับเงิน: {receiptVoucherNumber} (จองอัตโนมัติแล้ว
              ไม่เปลี่ยนแปลงเมื่อบันทึกซ้ำ)
            </p>
          )}
        </div>

        <div className="border-t border-border pt-6">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            ข้อความในใบสำคัญรับเงิน (ย่อหน้าใต้หัวเอกสาร)
          </label>
          <textarea
            rows={4}
            className="w-full p-4 rounded-2xl border border-border outline-none text-sm resize-y focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-muted/50 focus:bg-background"
            value={formData.receipt_voucher_text}
            onChange={(e) => setFormData({ ...formData, receipt_voucher_text: e.target.value })}
          ></textarea>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            ข้อความนี้ถูกจำไว้เป็น template ใช้กับสัญญาถัดไปได้ และแก้ไขได้เสมอ — ใส่ตัวแปรได้: {"{{company}}"} ชื่อบริษัท,{" "}
            {"{{agency}}"} ชื่อหน่วยงาน, {"{{contract_number}}"} เลขที่สัญญา (แทนค่าอัตโนมัติตอนพิมพ์)
          </p>
        </div>

        <div className="border-t border-border pt-6">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            หมายเหตุ
          </label>
          <textarea
            rows={3}
            className="w-full p-4 rounded-2xl border border-border outline-none text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-muted/50 focus:bg-background"
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          ></textarea>
        </div>
      </div>
    </div>
  );
}
