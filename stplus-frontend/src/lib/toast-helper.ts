import { toast } from "sonner";

// กำหนดประเภทของข้อมูลที่เราสามารถส่งเข้ามาตั้งค่า Toast ได้
interface ToastOptions {
  loading?: string;
  success?: string | ((data: any) => string);
  error?: string | ((err: any) => string);
  onSuccessCallback?: () => void; // คำสั่งที่อยากให้ทำเมื่อสำเร็จ (เช่น ปิดหน้าต่าง, รีเฟรชหน้า)
}

export const withToastPromise = (
  promise: Promise<any>,
  options?: ToastOptions
) => {
  toast.promise(promise, {
    // 1. ข้อความตอนกำลังโหลด
    loading: options?.loading || 'กำลังดำเนินการ...',
    
    // 2. ถ้า API ส่งข้อมูลกลับมาสำเร็จ
    success: (data) => {
      // ถ้ามีการสั่งให้ทำอะไรต่อ (เช่น ปิดหน้าต่าง) ให้ทำตรงนี้
      if (options?.onSuccessCallback) {
        options.onSuccessCallback();
      }
      // คืนค่าข้อความสีเขียว
      return typeof options?.success === 'function' 
        ? options.success(data) 
        : (options?.success || 'ทำรายการสำเร็จ!');
    },

    // 3. ถ้า API แจ้ง Error
    error: (err) => {
      return typeof options?.error === 'function' 
        ? options.error(err) 
        : (options?.error || 'เกิดข้อผิดพลาดในการทำรายการ');
    },
  });
};