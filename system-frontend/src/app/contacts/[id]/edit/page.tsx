"use client";

import React, { useState, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, Save, Info, Loader2, SquareUser, X, ArrowLeft} from "lucide-react";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { BankSelect } from "@/components/contacts/BankSelect";
import { cn } from "@/lib/utils";
import { AppLoading } from "@/components/ui/app-loading";

export default function EditContactForm() {
  const router = useRouter();
  const params = useParams();
  const contactId = params.id;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [branchType, setBranchType] = useState("head_office");
  const [hasForeignBank, setHasForeignBank] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    reset,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    if (contactId) {
      fetchContactData();
    }
  }, [contactId]);

  const fetchContactData = async () => {
    try {
      const data = await apiFetch(`/contacts/${contactId}`);

      reset({
        ...data,
        is_customer: Boolean(data.is_customer),
        is_vendor: Boolean(data.is_vendor),
      });

      setBranchType(data.branch_type || "head_office");
      if (data.swift_code || data.bank_address) {
        setHasForeignBank(true);
      }
    } catch (error) {
      toast.error("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      router.push("/contacts");
    } finally {
      setFetching(false);
    }
  };

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

      formData.append("_method", "PUT");

      await apiFetch(`/contacts/${contactId}`, {
        method: "POST",
        body: formData,
      });

      toast.success("อัปเดตข้อมูลผู้ติดต่อสำเร็จ!");
      router.push("/contacts");
    } catch (error: any) {
      if (error.errors) {
        Object.keys(error.errors).forEach((key) => {
          setError(key as any, {
            type: "manual",
            message: error.errors[key][0],
          });
        });
      } else if (error.message) {
        toast.error(error.message);
      } else {
        toast.error("เกิดข้อผิดพลาดในการอัปเดต");
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <AppLoading minHeight="min-h-[60vh]" />;
  }

  return (
    <div className="w-full max-w-full px-4 py-4 overflow-x-hidden text-foreground">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-50 text-yellow-600 rounded-xl border border-yellow-100 dark:border-blue-800/50 shadow-sm">
            <SquareUser className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              แก้ไขข้อมูลผู้ติดต่อ
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
          <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold">ประเภทผู้ติดต่อ:</Label>
                <Controller
                  control={control}
                  name="contact_type"
                  render={({ field }) => (
                    <RadioGroup
                      className="flex gap-6"
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem id="company" value="company" />
                        <Label className="font-normal" htmlFor="company">
                          นิติบุคคล
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem id="individual" value="individual" />
                        <Label className="font-normal" htmlFor="individual">
                          บุคคลธรรมดา
                        </Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold">ประเภท:</Label>
                <div className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <Controller
                      control={control}
                      name="is_customer"
                      render={({ field }) => (
                        <Checkbox
                          checked={field.value}
                          id="is_customer"
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label className="font-normal" htmlFor="is_customer">
                      ลูกค้า
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Controller
                      control={control}
                      name="is_vendor"
                      render={({ field }) => (
                        <Checkbox
                          checked={field.value}
                          id="is_vendor"
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label className="font-normal" htmlFor="is_vendor">
                      ผู้จำหน่าย
                    </Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold">เครดิต (วัน):</Label>
                <Input
                  className="h-10 rounded-md"
                  type="number"
                  {...register("credit_days")}
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold flex items-center gap-1">
                  ที่ตั้งธุรกิจ: <Info className="w-3.5 h-3.5 text-blue-500" />
                </Label>
                <Controller
                  control={control}
                  name="business_location"
                  render={({ field }) => (
                    <RadioGroup
                      className="flex gap-6"
                      onValueChange={field.onChange}
                      value={field.value || "domestic"}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem id="domestic" value="domestic" />
                        <Label className="font-normal" htmlFor="domestic">
                          ไทย
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          id="international"
                          value="international"
                        />
                        <Label className="font-normal" htmlFor="international">
                          ต่างประเทศ
                        </Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                <Label className="font-bold pt-2">รหัสผู้ติดต่อ:</Label>
                <div className="flex flex-col gap-1 w-full">
                  <Input
                    disabled
                    className={cn(
                      "h-10 rounded-md bg-slate-50 text-slate-500",
                      errors.contact_code &&
                        "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                    )}
                    {...register("contact_code", {
                      required: "กรุณาระบุรหัสผู้ติดต่อ",
                    })}
                  />
                  {errors.contact_code && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.contact_code.message as string}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                <Label className="font-bold pt-2 flex items-center gap-1">
                  ชื่อธุรกิจ:
                </Label>
                <div className="flex flex-col gap-1 w-full">
                  <Input
                    className={cn(
                      "h-10 rounded-md",
                      errors.business_name &&
                        "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                    )}
                    {...register("business_name", {
                      required: "กรุณาระบุชื่อธุรกิจ",
                    })}
                    autoComplete="organization"
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
                    className={cn(
                      "h-10 rounded-md",
                      errors.tax_id &&
                        "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                    )}
                    {...register("tax_id", {
                      minLength: { value: 10, message: "อย่างน้อย 10 หลัก" },
                      maxLength: { value: 13, message: "ไม่เกิน 13 หลัก" },
                      pattern: {
                        value: /^[0-9]+$/,
                        message: "เฉพาะตัวเลขเท่านั้น",
                      },
                    })}
                    autoComplete="off"
                  />
                  {errors.tax_id && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.tax_id.message as string}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                <Label className="font-bold pt-2">สำนักงาน/สาขา:</Label>
                <div className="flex flex-col gap-1 w-full">
                  <div className="flex gap-4 items-center h-10">
                    <Controller
                      control={control}
                      name="branch_type"
                      render={({ field }) => (
                        <RadioGroup
                          onValueChange={(v) => {
                            setBranchType(v);
                            field.onChange(v);
                          }}
                          value={field.value || branchType}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              id="head_office"
                              value="head_office"
                            />
                            <Label
                              className="font-normal"
                              htmlFor="head_office"
                            >
                              สำนักงานใหญ่
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem id="branch" value="branch" />
                            <Label className="font-normal" htmlFor="branch">
                              สาขา
                            </Label>
                          </div>
                        </RadioGroup>
                      )}
                    />
                    {branchType === "branch" && (
                      <Input
                        className="h-9 w-32 text-sm"
                        placeholder="รหัสสาขา"
                        {...register("branch_code")}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                <Label className="font-bold pt-2">ที่อยู่:</Label>
                <Textarea
                  className="min-h-[80px] rounded-md"
                  {...register("address")}
                  autoComplete="street-address"
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold">รหัสไปรษณีย์:</Label>
                <Input
                  className="h-10 rounded-md"
                  {...register("zipcode")}
                  autoComplete="postal-code"
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                <Label className="font-bold pt-2">ข้อมูลจัดส่ง:</Label>
                <Textarea
                  className="min-h-[80px] rounded-md"
                  {...register("delivery_address")}
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold">เบอร์สำนักงาน:</Label>
                <Input
                  className="h-10 rounded-md"
                  {...register("office_phone")}
                  autoComplete="tel"
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold">เบอร์โทรสาร:</Label>
                <Input
                  className="h-10 rounded-md"
                  {...register("fax")}
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="font-bold">เว็บไซต์:</Label>
                <Input
                  className="h-10 rounded-md"
                  {...register("website")}
                  autoComplete="url"
                />
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="font-bold">ชื่อผู้ติดต่อ:</Label>
                  <Input
                    className="h-10 rounded-md"
                    {...register("contact_person_name")}
                    autoComplete="name"
                  />
                </div>
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="font-bold">อีเมล:</Label>
                  <Input
                    className="h-10 rounded-md"
                    type="email"
                    {...register("email")}
                    autoComplete="email"
                  />
                </div>
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="font-bold">เบอร์มือถือ:</Label>
                  <Input
                    className="h-10 rounded-md"
                    {...register("mobile")}
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 relative">
                <span className="absolute -top-3 left-0 bg-white dark:bg-slate-900 pr-2 text-blue-500 font-bold">
                  ข้อมูลธนาคาร
                </span>
                <div className="grid grid-cols-[120px_1fr] items-center gap-4 pt-2">
                  <Label className="font-bold">ธนาคาร:</Label>
                  <Controller
                    control={control}
                    name="bank_name"
                    render={({ field }) => (
                      <BankSelect
                        onChange={field.onChange}
                        value={field.value}
                      />
                    )}
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="font-bold">ชื่อบัญชี:</Label>
                  <Input
                    className="h-10 rounded-md"
                    {...register("account_name")}
                    autoComplete="off"
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="font-bold">เลขที่บัญชี:</Label>
                  <Input
                    className="h-10 rounded-md"
                    {...register("account_number")}
                    autoComplete="off"
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="font-bold">รหัสสาขา/ชื่อสาขา:</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input className="h-10 rounded-md" placeholder="รหัสสาขา" />
                    <Input
                      className="h-10 rounded-md"
                      placeholder="ชื่อสาขา"
                      {...register("branch_name")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="font-bold">ประเภทบัญชี:</Label>
                  <Controller
                    control={control}
                    name="account_type"
                    render={({ field }) => (
                      <RadioGroup
                        className="flex gap-6"
                        onValueChange={field.onChange}
                        value={field.value || "savings"}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem id="savings" value="savings" />
                          <Label className="font-normal" htmlFor="savings">
                            ออมทรัพย์
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem id="current" value="current" />
                          <Label className="font-normal" htmlFor="current">
                            กระแสรายวัน
                          </Label>
                        </div>
                      </RadioGroup>
                    )}
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-start gap-4">
                  <Label className="font-bold pt-2">คิวอาร์ชำระเงิน:</Label>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl w-32 h-32 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer relative overflow-hidden transition-colors">
                    <Upload className="w-6 h-6 mb-2" />
                    <span className="text-[10px] text-center px-2">
                      คลิกเพื่ออัปโหลดรูปใหม่
                    </span>
                    <input
                      type="file"
                      {...register("qr_code_image")}
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 relative">
                <div className="absolute -top-4 left-0 bg-white dark:bg-slate-900 pr-2 flex items-center gap-2">
                  <Checkbox
                    checked={hasForeignBank}
                    id="has_foreign_bank"
                    onCheckedChange={(c) => setHasForeignBank(!!c)}
                  />
                  <Label
                    className="text-blue-500 font-bold cursor-pointer"
                    htmlFor="has_foreign_bank"
                  >
                    ข้อมูลเพิ่มเติมสำหรับธนาคารต่างประเทศ
                  </Label>
                </div>

                {hasForeignBank && (
                  <div className="pt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                      <Label className="font-bold">Swift Code:</Label>
                      <Input
                        className="h-10 rounded-md"
                        {...register("swift_code")}
                      />
                    </div>
                    <div className="grid grid-cols-[120px_1fr] items-start gap-4">
                      <Label className="font-bold pt-2">ที่อยู่ธนาคาร:</Label>
                      <Textarea
                        className="min-h-[80px] rounded-md"
                        {...register("bank_address")}
                      />
                    </div>
                  </div>
                )}
              </div>

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
                      className="pl-10 h-10 pt-2"
                      type="file"
                      {...register("attachment")}
                    />
                    <Upload className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  </div>
                </div>
                <div className="grid grid-cols-[120px_1fr] items-start gap-4">
                  <Label className="font-bold pt-2">โน้ต:</Label>
                  <Textarea
                    className="min-h-[80px] rounded-md"
                    {...register("note")}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 px-4 py-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/contacts")}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
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
                  <span>กำลังอัปเดต...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>บันทึกการแก้ไข</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
