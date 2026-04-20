"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AddProductDialog from "@/components/products/AddProductDialog";
import ProductActions from "@/components/products/ProductActions";
import ProductImageDialog from "@/components/products/ProductImageDialog";
import ProductFilters from "@/components/products/ProductFilters";
import ProductExcelActions from "@/components/products/ProductExcelActions";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// 💡 สร้าง Component ย่อยเพื่อทำงานกับข้อมูลฝั่ง Client
function ProductsContent() {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const page = searchParams.get("page") || "1";
  const perPage = searchParams.get("per_page") || "10";

  const [products, setProducts] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("stplus_token");
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const fetchUrl = `${apiUrl}/products?search=${encodeURIComponent(search)}&page=${page}&per_page=${perPage}`;

      const res = await fetch(fetchUrl, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`, // 🔑 ไขกุญแจดึงข้อมูล
        },
      });

      // 💡 1. เช็คก่อนว่าสิ่งที่ Backend ส่งมาคือ JSON จริงๆ หรือไม่
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const response = await res.json();
        if (res.ok) {
          setProducts(response.data || []);
          setMeta(response.meta || {});
        } else {
          console.error("API Error:", response);
        }
      } else {
        // 🚨 2. ถ้าส่ง HTML กลับมา (แสดงว่า Backend พัง) ให้แสดงข้อความ Error
        const htmlText = await res.text();
        console.error(
          "🚨 Backend ไม่ได้ส่ง JSON กลับมา! (ลองนำโค้ดนี้ไปเช็ค):",
          htmlText,
        );
        // * พี่แม็คสามารถเปิด Console (F12) เพื่อดูว่า Laravel แจ้ง Error บรรทัดไหนครับ
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };
  // 💡 โหลดข้อมูลใหม่ทุกครั้งที่ URL (หน้าเพจหรือคำค้นหา) เปลี่ยนไป
  useEffect(() => {
    fetchProducts();
  }, [search, page, perPage]);

  return (
    <div className="w-full max-w-full px-4 md:px-4 py-8 print:py-0 print:p-0 print:m-0 overflow-x-hidden text-foreground">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">
          จัดการสินค้า (Products)
        </h1>
        <div className="flex items-center gap-3">
          <ProductExcelActions />
          <AddProductDialog />
        </div>
      </div>

      <div className="bg-card p-4 rounded-t-md border border-border border-b-0 flex flex-col gap-4 print:hidden">
        <ProductFilters />
      </div>

      <div className="border border-border rounded-b-md bg-card overflow-x-auto print:border-none print:shadow-none">
        <div className="hidden print:block text-center text-xl font-bold mb-4">
          รายงานข้อมูลสินค้า (Products)
        </div>

        <Table className="whitespace-nowrap print:text-sm">
          <TableHeader className="bg-muted/50 dark:bg-slate-800/50 print:bg-transparent">
            <TableRow>
              <TableHead className="w-[80px] text-center print:hidden">
                รูปภาพ
              </TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>บาร์โค้ด</TableHead>
              <TableHead>ชื่อสินค้า</TableHead>
              <TableHead>ยี่ห้อ (Brand)</TableHead>
              <TableHead>รุ่นสินค้า</TableHead>
              <TableHead className="text-right">ราคาขาย</TableHead>
              <TableHead className="text-right">คงเหลือ</TableHead>
              <TableHead className="text-center">S/N</TableHead>
              <TableHead className="w-[100px] text-center print:hidden">
                จัดการ
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                  <p className="text-slate-500 font-medium">
                    กำลังโหลดข้อมูลสินค้า...
                  </p>
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center py-20 text-muted-foreground font-medium"
                >
                  ไม่พบข้อมูลสินค้าในระบบ
                </TableCell>
              </TableRow>
            ) : (
              products.map((product: any) => (
                <TableRow
                  key={product.id}
                  className="hover:bg-muted/30 dark:hover:bg-slate-800/30 border-border print:border-b"
                >
                  <TableCell className="text-center print:hidden">
                    <ProductImageDialog
                      imageUrl={product.image_url}
                      productName={product.name}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{product.sku}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.barcode || "-"}
                  </TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.brand?.name || "-"}</TableCell>
                  <TableCell>{product.model_name || "-"}</TableCell>
                  <TableCell className="text-right text-blue-600 dark:text-blue-400 font-bold">
                    {product.price.toLocaleString()} ฿
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    <span
                      className={cn(
                        "px-2 py-1 rounded-md",
                        (product.stock_balance?.qty || 0) <= 5
                          ? "text-red-600 bg-red-50"
                          : "",
                      )}
                    >
                      {(product.stock_balance?.qty || 0).toLocaleString()} ชิ้น
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {product.has_serial_number ? (
                      <Badge
                        variant="default"
                        className="bg-slate-800 dark:bg-slate-200 dark:text-slate-900"
                      >
                        ต้องระบุ
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-muted-foreground"
                      >
                        ไม่ต้องระบุ
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center print:hidden">
                    <ProductActions product={product} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 💡 ระบบแบ่งหน้า (Pagination) */}
      {!loading && meta.total > 0 && (
        <div className="flex justify-between items-center mt-4 px-2 print:hidden">
          <div className="text-sm text-muted-foreground font-medium">
            แสดง {(meta.current_page - 1) * meta.per_page + 1} ถึง{" "}
            {Math.min(meta.current_page * meta.per_page, meta.total)} จากทั้งหมด{" "}
            {meta.total} รายการ
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="rounded-full px-6 cursor-pointer hover:bg-blue-50 hover:text-blue-600"
            >
              <Link
                href={`?page=${Math.max(1, meta.current_page - 1)}&search=${search}`}
              >
                ก่อนหน้า
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="rounded-full px-6 cursor-pointer hover:bg-blue-50 hover:text-blue-600"
            >
              <Link
                href={`?page=${Math.min(meta.last_page, meta.current_page + 1)}&search=${search}`}
              >
                ถัดไป
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// 💡 ครอบ Suspense เพื่อไม่ให้ Next.js แจ้งเตือน Error ตอน Build
export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-20 text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600" />
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
