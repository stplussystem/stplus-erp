"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Plus,
  ImagePlus,
  X,
  ChevronsUpDown,
  Check,
  Package,
  Briefcase,
  Box,
} from "lucide-react";
import { withToastPromise } from "@/lib/toast-helper";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AddProductDialog() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [productType, setProductType] = useState("inventory");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [masterData, setMasterData] = useState({
    brands: [],
    categories: [],
    units: [],
  });

  const [openBrand, setOpenBrand] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [searchBrand, setSearchBrand] = useState("");

  const [openCategory, setOpenCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchCategory, setSearchCategory] = useState("");

  const [openUnit, setOpenUnit] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [searchUnit, setSearchUnit] = useState("");

  useEffect(() => {
    if (isOpen) {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      fetch(`${apiUrl}/product-options`)
        .then((res) => res.json())
        .then((data) => setMasterData(data))
        .catch((err) => console.error("โหลดข้อมูลล้มเหลว:", err));
    }
  }, [isOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error("ไฟล์รูปภาพมีขนาดใหญ่เกินไป", {
        description: "กรุณาอัปโหลดไฟล์ขนาดไม่เกิน 500 KB ครับ",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 💡 ฟังก์ชันใหม่! ยิง API ไปบันทึกข้อมูลแบบ Real-time
  const handleAddNewItem = async (
    typeLabel: string,
    typeKey: "brand" | "category" | "unit",
    name: string,
  ) => {
    if (!name) return;
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    try {
      const res = await fetch(`${apiUrl}/master-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: typeKey, name }),
      });

      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
      const result = await res.json();

      // เอาข้อมูลที่เพิ่งสร้าง ยัดกลับเข้าไปใน State เพื่อให้โชว์ใน Dropdown ทันที
      setMasterData((prev: any) => {
        const key =
          typeKey === "brand"
            ? "brands"
            : typeKey === "category"
              ? "categories"
              : "units";
        return { ...prev, [key]: [...prev[key], result.data] };
      });

      // เลือกข้อมูลที่เพิ่งสร้างให้อัตโนมัติ
      if (typeKey === "brand") {
        setSelectedBrand(result.data.name);
        setOpenBrand(false);
      }
      if (typeKey === "category") {
        setSelectedCategory(result.data.name);
        setOpenCategory(false);
      }
      if (typeKey === "unit") {
        setSelectedUnit(result.data.name);
        setOpenUnit(false);
      }

      toast.success(`เพิ่ม${typeLabel} "${name}" เรียบร้อยแล้ว`);
    } catch (error) {
      toast.error(`เกิดข้อผิดพลาดในการเพิ่ม${typeLabel}`);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formElement = e.currentTarget;
    const formData = new FormData(formElement);

    formData.append("product_type", productType);

    const brandId = masterData.brands.find(
      (b: any) => b.name === selectedBrand,
    )?.id;
    if (brandId) formData.append("brand_id", brandId);

    const catId = masterData.categories.find(
      (c: any) => c.name === selectedCategory,
    )?.id;
    if (catId) formData.append("category_id", catId);

    const unitId = masterData.units.find(
      (u: any) => u.name === selectedUnit,
    )?.id;
    if (unitId) formData.append("unit_id", unitId);

    const isSn =
      productType === "inventory"
        ? formData.get("has_serial_number") === "true"
        : false;
    formData.set("has_serial_number", isSn ? "1" : "0");

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    const savePromise = fetch(`${apiUrl}/products`, {
      method: "POST",
      body: formData,
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "Failed to save");
        }
        return res.json();
      })
      .finally(() => setLoading(false));

    withToastPromise(savePromise, {
      loading: "กำลังบันทึกสินค้าใหม่...",
      success: (res) => `เพิ่มสินค้า ${res.data?.name || ""} เรียบร้อยแล้ว!`,
      error: (err) => `บันทึกไม่สำเร็จ: ${err.message}`,
      onSuccessCallback: () => {
        setIsOpen(false);
        router.refresh();
        removeImage();
        setSelectedBrand("");
        setSelectedCategory("");
        setSelectedUnit("");
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer">
          <Plus className="mr-1 h-4 w-4" /> เพิ่มสินค้าใหม่
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4 mb-2">
          <DialogTitle className="text-2xl text-slate-800">
            สร้างบริการหรือสินค้า
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <div className="bg-slate-50 p-4 rounded-lg border">
            <RadioGroup
              value={productType}
              onValueChange={setProductType}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              <div
                className={cn(
                  "flex items-center space-x-2 border p-3 rounded-md transition-colors cursor-pointer",
                  productType === "service"
                    ? "bg-white border-blue-500 shadow-sm"
                    : "bg-transparent",
                )}
              >
                <RadioGroupItem value="service" id="type-service" />
                <Label
                  htmlFor="type-service"
                  className="flex items-center gap-2 cursor-pointer w-full"
                >
                  <Briefcase className="h-4 w-4 text-blue-500" /> บริการ
                </Label>
              </div>
              <div
                className={cn(
                  "flex items-center space-x-2 border p-3 rounded-md transition-colors cursor-pointer",
                  productType === "inventory"
                    ? "bg-white border-blue-500 shadow-sm"
                    : "bg-transparent",
                )}
              >
                <RadioGroupItem value="inventory" id="type-inventory" />
                <Label
                  htmlFor="type-inventory"
                  className="flex items-center gap-2 cursor-pointer w-full"
                >
                  <Box className="h-4 w-4 text-blue-500" /> สินค้านับสต็อก
                </Label>
              </div>
              <div
                className={cn(
                  "flex items-center space-x-2 border p-3 rounded-md transition-colors cursor-pointer",
                  productType === "non-inventory"
                    ? "bg-white border-blue-500 shadow-sm"
                    : "bg-transparent",
                )}
              >
                <RadioGroupItem value="non-inventory" id="type-non-inventory" />
                <Label
                  htmlFor="type-non-inventory"
                  className="flex items-center gap-2 cursor-pointer w-full"
                >
                  <Package className="h-4 w-4 text-blue-500" />{" "}
                  สินค้าไม่นับสต็อก
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 flex flex-col gap-2">
              <Label>รูปภาพสินค้า (ไม่เกิน 500 KB)</Label>
              <div className="relative border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-4 bg-slate-50 min-h-[220px] transition-colors hover:bg-slate-100">
                {imagePreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-[180px] object-contain rounded-md cursor-pointer"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-3 -right-3 h-8 w-8 rounded-full shadow-md"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <div
                    className="text-center cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500 font-medium">
                      คลิกเพื่ออัปโหลดรูปภาพ
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      (JPEG, PNG, WEBP)
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  name="image"
                  accept="image/jpeg, image/png, image/webp"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="sku">
                    รหัสสินค้า / SKU <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="sku"
                    name="sku"
                    required
                    placeholder="ระบุรหัสสินค้า เช่น ABC-0001"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="barcode">บาร์โค้ด (Barcode)</Label>
                  <Input
                    id="barcode"
                    name="barcode"
                    placeholder="สแกนหรือพิมพ์บาร์โค้ด..."
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="name">
                  ชื่อสินค้า <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="ระบุชื่อสินค้า"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>หมวดหมู่สินค้า</Label>
                  <Popover open={openCategory} onOpenChange={setOpenCategory}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCategory}
                        className="w-full justify-between font-normal cursor-pointer"
                      >
                        {selectedCategory || "ระบุหมวดหมู่สินค้า"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="ค้นหาหมวดหมู่..."
                          onValueChange={setSearchCategory}
                        />
                        <CommandList>
                          <CommandEmpty className="py-3 px-2 text-sm text-center">
                            <p className="text-slate-500 mb-2">
                              ไม่พบ "{searchCategory}"
                            </p>
                            {/* 💡 เปลี่ยนมาเรียกใช้ฟังก์ชันจริง */}
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full text-blue-600"
                              onClick={() =>
                                handleAddNewItem(
                                  "หมวดหมู่",
                                  "category",
                                  searchCategory,
                                )
                              }
                            >
                              <Plus className="h-4 w-4 mr-1" /> เพิ่มหมวดหมู่นี้
                            </Button>
                          </CommandEmpty>
                          <CommandGroup>
                            {masterData.categories.map((cat: any) => (
                              <CommandItem
                                key={cat.id}
                                value={cat.name}
                                onSelect={(val) => {
                                  setSelectedCategory(
                                    val === selectedCategory ? "" : val,
                                  );
                                  setOpenCategory(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCategory === cat.name
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {cat.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2">
                  <Label>
                    หน่วยสินค้าหลัก <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={openUnit} onOpenChange={setOpenUnit}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openUnit}
                        className="w-full justify-between font-normal cursor-pointer"
                      >
                        {selectedUnit || "ระบุหน่วยสินค้า"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="ค้นหาหน่วยสินค้า..."
                          onValueChange={setSearchUnit}
                        />
                        <CommandList>
                          <CommandEmpty className="py-3 px-2 text-sm text-center">
                            <p className="text-slate-500 mb-2">
                              ไม่พบ "{searchUnit}"
                            </p>
                            {/* 💡 เปลี่ยนมาเรียกใช้ฟังก์ชันจริง */}
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full text-blue-600"
                              onClick={() =>
                                handleAddNewItem("หน่วยนับ", "unit", searchUnit)
                              }
                            >
                              <Plus className="h-4 w-4 mr-1" />{" "}
                              เพิ่มหน่วยสินค้านี้
                            </Button>
                          </CommandEmpty>
                          <CommandGroup>
                            {masterData.units.map((unit: any) => (
                              <CommandItem
                                key={unit.id}
                                value={unit.name}
                                onSelect={(val) => {
                                  setSelectedUnit(
                                    val === selectedUnit ? "" : val,
                                  );
                                  setOpenUnit(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedUnit === unit.name
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {unit.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>ยี่ห้อ (Brand)</Label>
                  <Popover open={openBrand} onOpenChange={setOpenBrand}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openBrand}
                        className="w-full justify-between font-normal cursor-pointer"
                      >
                        {selectedBrand || "เลือกยี่ห้อ..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="ค้นหายี่ห้อ..."
                          onValueChange={setSearchBrand}
                        />
                        <CommandList>
                          <CommandEmpty className="py-3 px-2 text-sm text-center">
                            <p className="text-slate-500 mb-2">
                              ไม่พบ "{searchBrand}"
                            </p>
                            {/* 💡 เปลี่ยนมาเรียกใช้ฟังก์ชันจริง */}
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full text-blue-600"
                              onClick={() =>
                                handleAddNewItem("ยี่ห้อ", "brand", searchBrand)
                              }
                            >
                              <Plus className="h-4 w-4 mr-1" /> เพิ่มยี่ห้อนี้
                            </Button>
                          </CommandEmpty>
                          <CommandGroup>
                            {masterData.brands.map((brand: any) => (
                              <CommandItem
                                key={brand.id}
                                value={brand.name}
                                onSelect={(val) => {
                                  setSelectedBrand(
                                    val === selectedBrand ? "" : val,
                                  );
                                  setOpenBrand(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedBrand === brand.name
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {brand.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="model_name">รุ่นสินค้า (Model)</Label>
                  <Input
                    id="model_name"
                    name="model_name"
                    placeholder="ระบุรุ่นสินค้า"
                  />
                </div>
              </div>

              <hr className="my-2" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="price" className="text-blue-700 font-medium">
                    ราคาขาย (ยังไม่รวม VAT) ฿{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vat_type">
                    ภาษีมูลค่าเพิ่ม <span className="text-red-500">*</span>
                  </Label>
                  <Select name="vat_type" defaultValue="7">
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">ราคายังไม่รวม VAT (7%)</SelectItem>
                      <SelectItem value="0">VAT 0%</SelectItem>
                      <SelectItem value="exempt">ยกเว้นภาษี</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {productType === "inventory" && (
                <div className="grid gap-2 bg-slate-50 p-3 rounded-md border border-slate-200 mt-2">
                  <Label htmlFor="has_serial_number" className="font-medium">
                    การจัดเก็บ Serial Number (S/N)
                  </Label>
                  <Select name="has_serial_number" defaultValue="false">
                    <SelectTrigger className="bg-white cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">
                        ไม่ระบุ S/N (คำนวณต้นทุนแบบถัวเฉลี่ย)
                      </SelectItem>
                      <SelectItem value="true">
                        ระบุ S/N ทุกชิ้น (ล็อกต้นทุนแบบ FIFO)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-slate-500">
                    *หากเปิดใช้ ระบบจะบังคับให้ยิงบาร์โค้ด S/N
                    ทุกครั้งที่มีการรับเข้า-เบิกออก
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-2">
            <Button
              type="button"
              variant="outline"
              className="min-w-[100px] cursor-pointer"
              onClick={() => setIsOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              className="min-w-[120px] bg-green-600 hover:bg-green-700 text-white cursor-pointer"
              disabled={loading}
            >
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
