<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds Spatie permission's `team_id` column to roles/model_has_roles/model_has_permissions
 * so a user can hold different roles in different companies (needed for multi-company
 * access — config('permission.teams') is flipped to true alongside this migration).
 *
 * roles.company_id already exists and is treated as the source of truth for team_id.
 * Any role with a null company_id (a data anomaly pre-dating this feature — the seeded
 * "Super Admin" role has none) is backfilled to company_id 1, matching what
 * RolesAndPermissionsSeeder originally intended for that row.
 *
 * Note: role_id/permission_id keep a permanent secondary index (in addition to the new
 * team_id-led primary key) because MySQL/MariaDB requires an index with the FK column as
 * its leftmost member to support the existing foreign key — the new primary key leads
 * with team_id instead, so it can't serve that purpose on its own.
 */
return new class extends Migration
{
    public function up(): void
    {
        // config('permission.teams') is read live by the original create_permission_tables
        // migration — on a database that never existed before this feature (e.g. a fresh
        // install, or the test database), that migration already creates team_id columns
        // and team-scoped keys by itself, with no legacy rows to backfill. This migration
        // is only needed as a delta on a database that was migrated back when teams was
        // still off (e.g. the existing dev/prod database) — skip entirely otherwise.
        if (Schema::hasColumn('roles', 'team_id')) {
            return;
        }

        // --- roles.team_id ---
        Schema::table('roles', function (Blueprint $table) {
            $table->unsignedBigInteger('team_id')->nullable()->after('company_id');
        });

        DB::statement('UPDATE roles SET company_id = 1 WHERE company_id IS NULL');
        DB::statement('UPDATE roles SET team_id = company_id');

        Schema::table('roles', function (Blueprint $table) {
            $table->unsignedBigInteger('team_id')->nullable(false)->change();
            $table->index('team_id', 'roles_team_id_index');
            $table->dropUnique('roles_name_guard_name_unique');
            $table->unique(['team_id', 'name', 'guard_name'], 'roles_team_id_name_guard_name_unique');
        });

        // --- model_has_roles.team_id (derived from the role's team_id) ---
        Schema::table('model_has_roles', function (Blueprint $table) {
            $table->unsignedBigInteger('team_id')->nullable()->after('role_id');
        });

        // Correlated subquery instead of a MySQL-style JOIN-UPDATE so this also runs
        // against SQLite (used by the automated test suite).
        DB::statement(
            'UPDATE model_has_roles SET team_id = ' .
            '(SELECT team_id FROM roles WHERE roles.id = model_has_roles.role_id)'
        );

        Schema::table('model_has_roles', function (Blueprint $table) {
            $table->unsignedBigInteger('team_id')->nullable(false)->change();
            $table->index('role_id', 'model_has_roles_role_id_index');
        });
        Schema::table('model_has_roles', function (Blueprint $table) {
            $table->dropPrimary();
        });
        Schema::table('model_has_roles', function (Blueprint $table) {
            $table->primary(
                ['team_id', 'role_id', 'model_id', 'model_type'],
                'model_has_roles_role_model_type_primary'
            );
            $table->index('team_id', 'model_has_roles_team_foreign_key_index');
        });

        // --- model_has_permissions.team_id (direct permission grants: derive from the
        // assignee user's home company, since these are not attached to any role) ---
        Schema::table('model_has_permissions', function (Blueprint $table) {
            $table->unsignedBigInteger('team_id')->nullable()->after('permission_id');
        });

        // Correlated subquery instead of a MySQL-style JOIN-UPDATE so this also runs
        // against SQLite (used by the automated test suite).
        DB::statement(
            "UPDATE model_has_permissions SET team_id = COALESCE(" .
            "(SELECT company_id FROM users WHERE users.id = model_has_permissions.model_id " .
            "AND model_has_permissions.model_type = 'App\\\\Models\\\\User'), 1)"
        );
        // Any row that isn't a User (shouldn't exist today, but guard anyway) falls back to company 1.
        DB::statement('UPDATE model_has_permissions SET team_id = 1 WHERE team_id IS NULL');

        Schema::table('model_has_permissions', function (Blueprint $table) {
            $table->unsignedBigInteger('team_id')->nullable(false)->change();
            $table->index('permission_id', 'model_has_permissions_permission_id_index');
        });
        Schema::table('model_has_permissions', function (Blueprint $table) {
            $table->dropPrimary();
        });
        Schema::table('model_has_permissions', function (Blueprint $table) {
            $table->primary(
                ['team_id', 'permission_id', 'model_id', 'model_type'],
                'model_has_permissions_permission_model_type_primary'
            );
            $table->index('team_id', 'model_has_permissions_team_foreign_key_index');
        });

        app('cache')
            ->store(config('permission.cache.store') != 'default' ? config('permission.cache.store') : null)
            ->forget(config('permission.cache.key'));
    }

    public function down(): void
    {
        // Note: on a database where up() no-op'd (fresh install — see the guard above),
        // this unconditionally tears down the base create_permission_tables migration's
        // own teams schema too, since there's no reliable way to tell them apart here.
        // Acceptable for this additive feature's rollback path; not exercised in normal use.
        Schema::table('model_has_permissions', function (Blueprint $table) {
            $table->dropPrimary();
            $table->dropIndex('model_has_permissions_team_foreign_key_index');
            $table->dropColumn('team_id');
        });
        Schema::table('model_has_permissions', function (Blueprint $table) {
            $table->primary(
                ['permission_id', 'model_id', 'model_type'],
                'model_has_permissions_permission_model_type_primary'
            );
        });
        Schema::table('model_has_permissions', function (Blueprint $table) {
            $table->dropIndex('model_has_permissions_permission_id_index');
        });

        Schema::table('model_has_roles', function (Blueprint $table) {
            $table->dropPrimary();
            $table->dropIndex('model_has_roles_team_foreign_key_index');
            $table->dropColumn('team_id');
        });
        Schema::table('model_has_roles', function (Blueprint $table) {
            $table->primary(
                ['role_id', 'model_id', 'model_type'],
                'model_has_roles_role_model_type_primary'
            );
        });
        Schema::table('model_has_roles', function (Blueprint $table) {
            $table->dropIndex('model_has_roles_role_id_index');
        });

        Schema::table('roles', function (Blueprint $table) {
            $table->dropUnique('roles_team_id_name_guard_name_unique');
            $table->dropIndex('roles_team_id_index');
            $table->unique(['name', 'guard_name'], 'roles_name_guard_name_unique');
            $table->dropColumn('team_id');
        });
    }
};
