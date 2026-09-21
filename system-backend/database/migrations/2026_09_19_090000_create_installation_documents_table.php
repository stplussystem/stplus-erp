<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// 🆕 [2026-09-19] หัวเอกสารงานติดตั้ง 1 ใบต่อใบกำกับภาษี/เอกสารขาย (เดิมมีแค่เลขฐาน + -N ต่อท้ายที่คำนวณตอนบันทึก)
// installation_records ยังเป็นรายการย่อยต่อ S/N เหมือนเดิม แค่เพิ่ม FK ชี้ขึ้นมาที่หัวเอกสารนี้
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('installation_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('installation_number', 50);
            $table->foreignId('project_id')->constrained('projects')->restrictOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained('contacts')->restrictOnDelete();
            $table->foreignId('sale_document_id')->constrained('sale_documents')->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['company_id', 'sale_document_id'], 'installation_documents_company_saledoc_unique');
        });

        Schema::table('installation_records', function (Blueprint $table) {
            $table->foreignId('installation_document_id')->nullable()->after('company_id')
                ->constrained('installation_documents')->nullOnDelete();
        });

        // Backfill: จัดกลุ่มรายการเดิมตามเอกสารขายต้นทาง สร้างหัวเอกสารด้วยเลขฐานของรายการแรกสุด (ตัด -N ออก)
        $records = DB::table('installation_records')
            ->join('sale_document_items', 'sale_document_items.id', '=', 'installation_records.sale_document_item_id')
            ->select(
                'installation_records.id',
                'installation_records.company_id',
                'installation_records.installation_number',
                'installation_records.project_id',
                'installation_records.contact_id',
                'installation_records.created_by',
                'sale_document_items.sale_document_id'
            )
            ->orderBy('installation_records.id')
            ->get()
            ->groupBy(fn ($r) => $r->company_id . ':' . $r->sale_document_id);

        foreach ($records as $group) {
            $first = $group->first();
            $baseNumber = preg_replace('/-\d+$/', '', $first->installation_number);
            $documentId = DB::table('installation_documents')->insertGetId([
                'company_id' => $first->company_id,
                'installation_number' => $baseNumber,
                'project_id' => $first->project_id,
                'contact_id' => $first->contact_id,
                'sale_document_id' => $first->sale_document_id,
                'created_by' => $first->created_by,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('installation_records')
                ->whereIn('id', $group->pluck('id'))
                ->update(['installation_document_id' => $documentId, 'installation_number' => $baseNumber]);
        }
    }

    public function down(): void
    {
        Schema::table('installation_records', function (Blueprint $table) {
            $table->dropConstrainedForeignId('installation_document_id');
        });
        Schema::dropIfExists('installation_documents');
    }
};
