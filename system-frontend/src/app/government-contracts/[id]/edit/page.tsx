"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { FileLock2, Save, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";

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
    contract_due_date: "",
    guarantee_return_requested_date: "",
    guarantee_returned_date: "",
    note: "",
  });
  const [receiptVoucherNumber, setReceiptVoucherNumber] = useState<
    string | null
  >(null);

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
          contract_due_date: doc.contract_due_date || "",
          guarantee_return_requested_date:
            doc.guarantee_return_requested_date || "",
          guarantee_returned_date: doc.guarantee_returned_date || "",
          note: doc.note || "",
        });
        setReceiptVoucherNumber(doc.receipt_voucher_number || null);
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

  if (!isAuthorized) return <div className="min-h-screen bg-slate-50"></div>;
  if (fetching) return <AppLoading />;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileLock2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              แก้ไขสัญญาราชการ
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              {formData.contract_number} — {formData.agency_name}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Link href="/government-contracts" className="w-full md:w-auto">
            <button
              type="button"
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
            </button>
          </Link>
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

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            ข้อมูลสัญญา
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                โครงการ <span className="text-red-500">*</span>
              </label>
              <AppSelect
                value={formData.project_id || undefined}
                onValueChange={(v) => {
                  setFormData({ ...formData, project_id: v });
                  setErrors((prev) => ({ ...prev, project_id: "" }));
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
              <label className="block text-xs font-medium text-slate-500 mb-1">
                ชื่อหน่วยงาน <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`w-full h-10 px-4 rounded-xl border outline-none text-sm ${
                  errors.agency_name
                    ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
              <label className="block text-xs font-medium text-slate-500 mb-1">
                เลขที่สัญญา <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`w-full h-10 px-4 rounded-xl border outline-none text-sm ${
                  errors.contract_number
                    ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
              <label className="block text-xs font-medium text-slate-500 mb-1">
                วันที่ทำสัญญา
              </label>
              <AppDatePicker
                value={formData.contract_date}
                onChange={(v) => setFormData({ ...formData, contract_date: v })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                จำนวนเงินตามสัญญา
              </label>
              <input
                type="number"
                min="0"
                className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                value={formData.contract_amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contract_amount: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                วันครบสัญญา{" "}
                <span className="text-slate-400 font-normal normal-case">
                  (กรอกได้หลายวัน คั่นด้วย , ถ้ามีการต่ออายุ)
                </span>
              </label>
              <input
                type="text"
                placeholder="เช่น 6/4/2568 , 13/2/2568"
                className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                value={formData.contract_due_date}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contract_due_date: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            หลักประกันสัญญา
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                เลขที่หนังสือค้ำประกัน
              </label>
              <input
                type="text"
                className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                value={formData.guarantee_number}
                onChange={(e) =>
                  setFormData({ ...formData, guarantee_number: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                จำนวนเงินหลักประกัน
              </label>
              <input
                type="number"
                min="0"
                className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
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
              <label className="block text-xs font-medium text-slate-500 mb-1">
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

        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            การคืนหลักประกัน
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
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
              <label className="block text-xs font-medium text-slate-500 mb-1">
                วันที่ได้คืนหลักประกัน{" "}
                <span className="text-slate-400 font-normal normal-case">
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

        <div className="border-t border-slate-100 pt-6">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            หมายเหตุ
          </label>
          <textarea
            rows={3}
            className="w-full p-4 rounded-2xl border border-slate-200 outline-none text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50 focus:bg-white"
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          ></textarea>
        </div>
      </div>
    </div>
  );
}
