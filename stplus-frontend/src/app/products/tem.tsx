import Link from "next/link";
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

// กำหนดโครงสร้างข้อมูลให้ตรงกับ JSON ที่ส่งมาจาก Laravel
type Product = {
  id: number;
  sku: string;
  name: string;
  price: number;
  vat_type: string;
  stock_qty: number;
  has_serial_number: boolean;
};

// ฟังก์ชันดึงข้อมูลแบบรับค่า พารามิเตอร์
async function getProducts(search: string, page: string, perPage: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
  const res = await fetch(
    `${apiUrl}/products?search=${search}&page=${page}&per_page=${perPage}`,
    {
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

// Next.js App Router: รับค่า searchParams จาก URL
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const search = searchParams?.search || "";
  const page = searchParams?.page || "1";
  const perPage = searchParams?.per_page || "10";

  const response = await getProducts(search, page, perPage);
  const products = response.data || [];
  const meta = response.meta || {}; // ข้อมูลสำหรับแบ่งหน้า

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          จัดการสินค้า (Products Master)
        </h1>
        <AddProductDialog />
      </div>

      <div className="bg-white p-4 rounded-t-md border border-b-0 flex flex-col gap-4">
        {/* กล่องค้นหา และ ตัวเลือกแสดงจำนวน */}
        <ProductFilters />
      </div>

      <div className="border rounded-b-md bg-white overflow-x-auto">
        {/* ใส่ whitespace-nowrap ที่ Table เพื่อไม่ให้ข้อความตัดขึ้นบรรทัดใหม่ */}
        <Table className="whitespace-nowrap">
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-[50px] text-center">รูปภาพ</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>ชื่อสินค้า</TableHead>
              <TableHead>ยี่ห้อ (Brand)</TableHead>
              <TableHead>รุ่นสินค้า</TableHead>
              <TableHead className="text-right">ราคาขายมาตรฐาน</TableHead>
              <TableHead className="text-center">S/N</TableHead>
              <TableHead className="w-[100px] text-center">แก้ไข</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-10 text-slate-500"
                >
                  ไม่พบข้อมูลสินค้า...
                </TableCell>
              </TableRow>
            ) : (
              products.map((product: any) => (
                <TableRow key={product.id} className="hover:bg-slate-50">
                  <TableCell className="text-center">
                    {/* ปุ่มดวงตาสำหรับกดดูรูปภาพ */}
                    <ProductImageDialog
                      imageUrl={product.image_url}
                      productName={product.name}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">
                    {product.sku}
                  </TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.brand?.name || "-"}</TableCell>
                  <TableCell>{product.model_name || "-"}</TableCell>
                  <TableCell className="text-right text-blue-600 font-medium">
                    {product.price.toLocaleString()} ฿
                  </TableCell>
                  <TableCell className="text-center">
                    {product.has_serial_number ? (
                      <Badge variant="default" className="bg-gray-800">
                        ต้องระบุ S/N
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-slate-500">
                        ไม่ต้องระบุ S/N
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <ProductActions product={product} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ส่วนควบคุมหน้า (Pagination) */}
      {meta.total > 0 && (
        <div className="flex justify-between items-center mt-4 px-2">
          <div className="text-sm text-slate-500">
            แสดง {(meta.current_page - 1) * meta.per_page + 1} ถึง{" "}
            {Math.min(meta.current_page * meta.per_page, meta.total)} จากทั้งหมด{" "}
            {meta.total} รายการ
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.links?.prev}
              asChild
            >
              <Link
                href={
                  meta.links?.prev
                    ? `?search=${search}&per_page=${perPage}&page=${meta.current_page - 1}`
                    : "#"
                }
              >
                ก่อนหน้า
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.links?.next}
              asChild
            >
              <Link
                href={
                  meta.links?.next
                    ? `?search=${search}&per_page=${perPage}&page=${meta.current_page + 1}`
                    : "#"
                }
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
