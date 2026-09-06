"use client";

import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Upload,
  Save,
  X,
  Info,
  Loader2,
  SquareUser,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { BankSelect } from "@/components/contacts/BankSelect";
import { cn } from "@/lib/utils";

export default function ContactForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // State สำหรับเปิด-ปิด ฟอร์มย่อย
  const [branchType, setBranchType] = useState("head_office");
  const [hasForeignBank, setHasForeignBank] = useState(false);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  // ใช้ React Hook Form จัดการ Data
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    control,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      contact_type: "company",
      is_customer: true,
      is_vendor: false,
      credit_days: 0,
      business_location: "domestic",
      branch_type: "head_office",
      account_type: "savings",
    },
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const formData = new FormData();
      Object.keys(data).forEach((key) => {
        const value = data[key];
        if (value === undefined || value === null || value === "") return;
        if (value instanceof FileList) {
          if (value.length > 0) formData.append(key, value[0]);
        } else if (typeof value === "boolean") {
          formData.append(key, value ? "1" : "0");
        } else {
          formData.append(key, value);
        }
      });

      const response = await apiFetch("/contacts", {
        method: "POST",
        body: formData,
      });

      toast.success("บันทึกข้อมูลผู้ติดต่อสำเร็จ!");
      router.push("/contacts");
    } catch (error: any) {
      // 🚀 1. กรณีที่ API ส่ง Object Errors มาครบทุกช่อง
      if (error.errors) {
        Object.keys(error.errors).forEach((key) => {
          setError(key as any, {
            type: "manual",
            message: error.errors[key][0],
          });
        });
        // 💡 ลบ toast.error ออกแล้วครับ ระบบจะไม่เด้งแจ้งเตือนซ้ำซ้อน
      }

      // 🚀 2. กรณีที่ API ส่งมาแค่ error.message เพียวๆ
      else if (error.message) {
        if (error.message.includes("รหัสผู้ติดต่อนี้มีอยู่")) {
          setError("contact_code", {
            type: "manual",
            message: "รหัสผู้ติดต่อนี้มีอยู่ในระบบแล้ว",
          });
        } else if (error.message.includes("สำนักงานใหญ่ไปแล้ว")) {
          setError("tax_id", {
            type: "manual",
            message: "เลขผู้เสียภาษีนี้ ถูกลงทะเบียนเป็นสำนักงานใหญ่ไปแล้ว",
          });
        } else if (
          error.message.includes("กรุณาระบุรหัสสาขา") ||
          error.message.includes("รหัสสาขานี้ มีอยู่")
        ) {
          setError("branch_code", {
            type: "manual",
            message: error.message,
          });
        } else {
          // 💡 ถ้าเป็น Error อย่างอื่นที่ไม่ได้เกี่ยวกับช่องกรอก (เช่น เน็ตหลุด, เซิร์ฟเวอร์พัง) ค่อยโชว์ Toast ครับ
          toast.error(error.message || "เกิดข้อผิดพลาดในการบันทึก");
        }
      } else {
        toast.error("เกิดข้อผิดพลาดในการบันทึก");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearForm = () => {
    // ล้างค่าที่ลงทะเบียนไว้กับ react-hook-form ทั้งหมด กลับไปเป็นค่าเริ่มต้น
    reset();

    // ล้างค่าที่ควบคุมด้วย local state ของหน้านี้ (ไม่ได้ผูกกับ react-hook-form โดยตรง)
    setBranchType("head_office");
    setHasForeignBank(false);
    setQrPreview(null);
  };

  return (
    <div className="w-full max-w-full px-4 py-4 overflow-x-hidden text-foreground">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <SquareUser className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              สร้างรายชื่อผู้ติดต่อ
            </h1>
            {/* <p className="text-slate-500 text-[11px]">
              จัดการข้อมูลลูกค้าและผู้จำหน่ายทั้งหมด
            </p> */}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/contacts")}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" /> ยกเลิก
          </Button>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800"
        >
          {/* 🚀 Body: แบ่ง Grid 2 คอลัมน์ (ซ้าย-ขวา) */}
          <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* ========================================== */}
            {/* 📍 คอลัมน์ซ้าย: ข้อมูลพื้นฐานองค์กร */}
            {/* ========================================== */}
            <div className="space-y-6">
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold">ประเภทผู้ติดต่อ:</Label>
                <RadioGroup
                  defaultValue="company"
                  onValueChange={(v) => setValue("contact_type", v)}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="company" id="company" />
                    <Label htmlFor="company" className="font-normal">
                      นิติบุคคล
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="individual" id="individual" />
                    <Label htmlFor="individual" className="font-normal">
                      บุคคลธรรมดา
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold">ประเภท:</Label>
                <div className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_customer"
                      defaultChecked
                      onCheckedChange={(c) => setValue("is_customer", !!c)}
                    />
                    <Label htmlFor="is_customer" className="font-normal">
                      ลูกค้า
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_vendor"
                      onCheckedChange={(c) => setValue("is_vendor", !!c)}
                    />
                    <Label htmlFor="is_vendor" className="font-normal">
                      ผู้จำหน่าย
                    </Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold">เครดิต (วัน):</Label>
                <Input
                  type="number"
                  {...register("credit_days")}
                  className="h-10 rounded-md"
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold flex items-center gap-1">
                  ที่ตั้งธุรกิจ: <Info className="w-3.5 h-3.5 text-blue-500" />
                </Label>
                <RadioGroup
                  defaultValue="domestic"
                  onValueChange={(v) => setValue("business_location", v)}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="domestic" id="domestic" />
                    <Label htmlFor="domestic" className="font-normal">
                      ไทย
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="international" id="international" />
                    <Label htmlFor="international" className="font-normal">
                      ต่างประเทศ
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* ช่องรหัสผู้ติดต่อ */}
              <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                <Label className="font-bold pt-2">รหัสผู้ติดต่อ:</Label>
                <div className="flex flex-col gap-1 w-full">
                  <Input
                    {...register("contact_code", {
                      required: "กรุณาระบุรหัสผู้ติดต่อ",
                    })}
                    placeholder="ชื่อบริษัทภาษาอังกฤษ 5 ตัวแรก เช่น ABCDE หรือ ABCDE001(คือเลขสาขา)"
                    className={cn(
                      "h-10 rounded-md",
                      errors.contact_code &&
                        "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                    )}
                  />
                  {errors.contact_code && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.contact_code.message as string}
                    </p>
                  )}
                </div>
              </div>

              {/* ช่องชื่อธุรกิจ */}
              <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                <Label className="font-bold pt-2 flex items-center gap-1">
                  ชื่อธุรกิจ: <Info className="w-3.5 h-3.5 text-blue-500" />
                </Label>
                <div className="flex flex-col gap-1 w-full">
                  <Input
                    {...register("business_name", {
                      required: "กรุณาระบุชื่อธุรกิจ",
                    })}
                    autoComplete="organization"
                    placeholder="ตัวอย่างการกรอก: บริษัท เอบีดีอีเอฟจี จำกัด"
                    className={cn(
                      "h-10 rounded-md",
                      errors.business_name &&
                        "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                    )}
                  />
                  {errors.business_name && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.business_name.message as string}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                <Label className="font-bold pt-2">เลขผู้เสียภาษี:</Label>
                <div className="flex flex-col gap-1 w-full">
                  <Input
                    {...register("tax_id", {
                      // 🚀 โค้ดดี้เพิ่ม Validation ตรงนี้ครับ!
                      minLength: {
                        value: 10,
                        message: "กรุณาระบุเลขผู้เสียภาษีอย่างน้อย 10 หลัก",
                      },
                      maxLength: {
                        value: 13,
                        message: "เลขผู้เสียภาษีต้องไม่เกิน 13 หลัก",
                      },
                      pattern: {
                        value: /^[0-9]+$/,
                        message: "กรุณากรอกเฉพาะตัวเลขเท่านั้น",
                      },
                    })}
                    autoComplete="off"
                    placeholder="ระบุเลขผู้เสียภาษี 10 - 13 หลัก"
                    className={cn(
                      "h-10 rounded-md",
                      errors.tax_id &&
                        "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                    )}
                  />

                  {errors.tax_id && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.tax_id.message as string}
                    </p>
                  )}
                </div>
              </div>

              {/* ช่องสำนักงาน/สาขา */}
              <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                <Label className="font-bold pt-2">สำนักงาน/สาขา:</Label>
                <div className="flex flex-col gap-1 w-full">
                  <div className="flex gap-4 items-center h-10">
                    <RadioGroup
                      defaultValue="head_office"
                      onValueChange={(v) => {
                        setBranchType(v);
                        setValue("branch_type", v);
                      }}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="head_office" id="head_office" />
                        <Label htmlFor="head_office" className="font-normal">
                          สำนักงานใหญ่
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="branch" id="branch" />
                        <Label htmlFor="branch" className="font-normal">
                          สาขา
                        </Label>
                      </div>
                    </RadioGroup>
                    {/* แสดงช่องกรอกรหัสสาขา ถ้าเลือก "สาขา" */}
                    {branchType === "branch" && (
                      <Input
                        {...register("branch_code", {
                          required:
                            branchType === "branch"
                              ? "กรุณาระบุรหัสสาขา"
                              : false,
                        })}
                        placeholder="ระบุรหัสสาขา"
                        className={cn(
                          "h-9 w-32 text-sm",
                          errors.branch_code &&
                            "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                        )}
                      />
                    )}
                  </div>
                  {errors.branch_code && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.branch_code.message as string}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                <Label className="font-bold pt-2">ที่อยู่:</Label>
                <Textarea
                  {...register("address")}
                  autoComplete="street-address"
                  className="min-h-[80px] rounded-md"
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold">รหัสไปรษณีย์:</Label>
                <Input
                  {...register("zipcode")}
                  autoComplete="postal-code"
                  className="h-10 rounded-md"
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                <Label className="font-bold pt-2">ข้อมูลจัดส่ง:</Label>
                <Textarea
                  {...register("delivery_address")}
                  autoComplete="off"
                  className="min-h-[80px] rounded-md"
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold">เบอร์สำนักงาน:</Label>
                <Input
                  {...register("office_phone")}
                  autoComplete="tel"
                  className="h-10 rounded-md"
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold">เบอร์โทรสาร:</Label>
                <Input
                  {...register("fax")}
                  autoComplete="off"
                  className="h-10 rounded-md"
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold">เว็บไซต์:</Label>
                <Input
                  {...register("website")}
                  autoComplete="url"
                  className="h-10 rounded-md"
                />
              </div>
            </div>

            {/* ========================================== */}
            {/* 📍 คอลัมน์ขวา: ข้อมูลบุคคลติดต่อ และ การเงิน */}
            {/* ========================================== */}
            <div className="space-y-8">
              {/* ส่วนบุคคลติดต่อ */}
              <div className="space-y-4">
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="font-bold">ชื่อผู้ติดต่อ:</Label>
                  <Input
                    {...register("contact_person_name")}
                    autoComplete="name"
                    className="h-10 rounded-md"
                  />
                </div>
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="font-bold">อีเมล:</Label>
                  <Input
                    type="email"
                    {...register("email")}
                    autoComplete="email"
                    className="h-10 rounded-md"
                  />
                </div>
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="font-bold">เบอร์มือถือ:</Label>
                  <Input
                    {...register("mobile")}
                    autoComplete="tel"
                    className="h-10 rounded-md"
                  />
                </div>
              </div>

              {/* ข้อมูลธนาคาร */}
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 relative">
                <span className="absolute -top-3 left-0 bg-white dark:bg-slate-900 pr-2 text-blue-500 font-bold">
                  ข้อมูลธนาคาร
                </span>

                {/* <div className="grid grid-cols-[120px_1fr] items-center gap-4 pt-2">
                <Label className="font-bold">ธนาคาร:</Label>
                <select
                  {...register("bank_name")}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">กรุณาเลือกธนาคาร</option>
                  <option value="kbank">ธนาคารกสิกรไทย</option>
                  <option value="scb">ธนาคารไทยพาณิชย์</option>
                  <option value="bbl">ธนาคารกรุงเทพ</option>
                </select>
              </div> */}

                <div className="grid grid-cols-[120px_1fr] items-center gap-4 pt-2">
                  <Label className="font-bold">ธนาคาร:</Label>
                  <Controller
                    name="bank_name"
                    control={control}
                    render={({ field }) => (
                      <BankSelect
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="font-bold">ชื่อบัญชี:</Label>
                  <Input
                    {...register("account_name")}
                    autoComplete="off"
                    className="h-10 rounded-md"
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="font-bold">เลขที่บัญชี:</Label>
                  <Input
                    {...register("account_number")}
                    autoComplete="off"
                    className="h-10 rounded-md"
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="font-bold">รหัสสาขา/ชื่อสาขา:</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="รหัสสาขา" className="h-10 rounded-md" />
                    <Input
                      {...register("branch_name")}
                      placeholder="ชื่อสาขา"
                      className="h-10 rounded-md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="font-bold">ประเภทบัญชี:</Label>
                  <RadioGroup
                    defaultValue="savings"
                    onValueChange={(v) => setValue("account_type", v)}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="savings" id="savings" />
                      <Label htmlFor="savings" className="font-normal">
                        ออมทรัพย์
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="current" id="current" />
                      <Label htmlFor="current" className="font-normal">
                        กระแสรายวัน
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-[120px_1fr] items-start gap-4">
                  <Label className="font-bold pt-2">คิวอาร์ชำระเงิน:</Label>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl w-32 h-32 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer relative overflow-hidden transition-colors">
                    {qrPreview ? (
                      <img
                        src={qrPreview}
                        alt="QR Preview"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <>
                        <Upload className="w-6 h-6 mb-2" />
                        <span className="text-[10px] text-center px-2">
                          คลิกเพื่ออัปโหลดรูป QR code ที่นี่
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      {...register("qr_code_image", {
                        onChange: (e) => {
                          const file = e.target.files?.[0];
                          if (file) setQrPreview(URL.createObjectURL(file));
                        },
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* ข้อมูลต่างประเทศ */}
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 relative">
                <div className="absolute -top-4 left-0 bg-white dark:bg-slate-900 pr-2 flex items-center gap-2">
                  <Checkbox
                    id="has_foreign_bank"
                    onCheckedChange={(c) => setHasForeignBank(!!c)}
                  />
                  <Label
                    htmlFor="has_foreign_bank"
                    className="text-blue-500 font-bold cursor-pointer"
                  >
                    ข้อมูลเพิ่มเติมสำหรับธนาคารต่างประเทศ
                  </Label>
                </div>

                {/* 💡 ถ้า Checkbox ติ๊กถูก ถึงจะโชว์ช่องให้กรอก */}
                {hasForeignBank && (
                  <div className="pt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                      <Label className="font-bold">Swift Code:</Label>
                      <Input
                        {...register("swift_code")}
                        className="h-10 rounded-md"
                      />
                    </div>
                    <div className="grid grid-cols-[120px_1fr] items-start gap-4">
                      <Label className="font-bold pt-2">ที่อยู่ธนาคาร:</Label>
                      <Textarea
                        {...register("bank_address")}
                        className="min-h-[80px] rounded-md"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ข้อมูลเพิ่มเติม */}
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 relative">
                <span className="absolute -top-3 left-0 bg-white dark:bg-slate-900 pr-2 text-blue-500 font-bold">
                  ข้อมูลเพิ่มเติม
                </span>

                <div className="grid grid-cols-[120px_1fr] items-center gap-4 pt-2">
                  <Label className="font-bold flex items-center gap-1">
                    แนบไฟล์: <Info className="w-3.5 h-3.5 text-blue-500" />
                  </Label>
                  <div className="relative">
                    <Input
                      type="file"
                      {...register("attachment")}
                      className="pl-10 h-10 pt-2"
                    />
                    <Upload className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  </div>
                </div>

                <div className="grid grid-cols-[120px_1fr] items-start gap-4">
                  <Label className="font-bold pt-2">โน้ต:</Label>
                  <Textarea
                    {...register("note")}
                    className="min-h-[80px] rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 px-4 py-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleClearForm}
              className="h-10 px-5 rounded-full text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300 flex items-center gap-2 shadow-sm cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              <X className="w-4 h-4" />
              ล้างข้อมูล
            </Button>

            <Button
              type="submit"
              disabled={loading}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>บันทึกแล้วปิด</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
