"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Search, Plus, X, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";

interface UserRow {
  id: number;
  name: string;
  email: string;
  username: string;
  is_platform_admin?: boolean | number;
}

interface CompanyRow {
  id: number;
  name: string;
  logo: string | null;
}

// หน้านี้เฉพาะ Super Admin (is_platform_admin) เท่านั้น — มอบ/ถอนสิทธิ์เข้าใช้งานหลายบริษัทให้ user
// สิทธิ์นี้ hardcode ไว้กับ is_platform_admin ตรงๆ ไม่ใช่ permission ทั่วไปที่ company admin มอบกันเองได้
export default function CompanyAccessPage() {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

  const [isMePlatformAdmin, setIsMePlatformAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [allCompanies, setAllCompanies] = useState<CompanyRow[]>([]);
  const [search, setSearch] = useState("");

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [userCompanies, setUserCompanies] = useState<CompanyRow[] | null>(null);
  const [companyToGrant, setCompanyToGrant] = useState("");
  const [granting, setGranting] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  useEffect(() => {
    const storedUser = getUserRaw();
    const parsed = storedUser ? JSON.parse(storedUser) : null;
    const isPlatformAdmin =
      parsed?.user?.is_platform_admin === true || parsed?.user?.is_platform_admin === 1;
    setIsMePlatformAdmin(isPlatformAdmin);
    if (!isPlatformAdmin) return;

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

      const [usersRes, companiesRes] = await Promise.all([
        fetch(`${apiUrl}/users`, { headers }),
        fetch(`${apiUrl}/companies`, { headers }),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(Array.isArray(data) ? data : data.data || []);
      }
      if (companiesRes.ok) {
        const data = await companiesRes.json();
        setAllCompanies(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      toast.error("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (user: UserRow) => {
    setSelectedUser(user);
    setUserCompanies(null);
    setCompanyToGrant("");
    try {
      const token = getToken();
      const res = await fetch(`${apiUrl}/users/${user.id}/companies`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setUserCompanies(data.data || []);
      } else {
        toast.error("โหลดสิทธิ์บริษัทของผู้ใช้ไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    }
  };

  const handleGrant = async () => {
    if (!selectedUser || !companyToGrant) return;
    setGranting(true);
    try {
      const token = getToken();
      const res = await fetch(`${apiUrl}/users/${selectedUser.id}/companies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ company_id: Number(companyToGrant) }),
      });
      const data = await res.json();
      if (res.ok) {
        setUserCompanies(data.data || []);
        setCompanyToGrant("");
        toast.success("มอบสิทธิ์เข้าบริษัทเรียบร้อยแล้ว");
      } else {
        toast.error(data.message || "มอบสิทธิ์ไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setGranting(false);
    }
  };

  const handleRevoke = async (companyId: number) => {
    if (!selectedUser) return;
    setRevokingId(companyId);
    try {
      const token = getToken();
      const res = await fetch(`${apiUrl}/users/${selectedUser.id}/companies/${companyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        setUserCompanies(data.data || []);
        toast.success("ถอดสิทธิ์เรียบร้อยแล้ว");
      } else {
        toast.error(data.message || "ถอดสิทธิ์ไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setRevokingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q)
    );
  });

  const grantedIds = new Set((userCompanies || []).map((c) => c.id));
  const grantableCompanies = allCompanies.filter((c) => !grantedIds.has(c.id));

  if (isMePlatformAdmin === false) {
    return (
      <div className="w-full max-w-full px-4 py-4 text-foreground">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 text-center text-slate-400">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          หน้านี้สำหรับ Super Admin ของระบบเท่านั้น
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 py-2 overflow-x-hidden text-foreground mx-auto space-y-6 antialiased">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">สิทธิ์เข้าใช้งานหลายบริษัท</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              มอบ/ถอนสิทธิ์ให้ผู้ใช้เข้าใช้งานได้มากกว่า 1 บริษัท (เฉพาะ Super Admin เท่านั้นที่ทำได้)
            </p>
          </div>
        </div>
      </div>

      {loading || isMePlatformAdmin === null ? (
        <AppLoading />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 lg:sticky lg:top-4">
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, อีเมล, username..."
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
                    selectedUser?.id === u.id
                      ? "bg-blue-50 text-blue-700 font-bold"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="font-medium truncate">{u.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                </button>
              ))}
              {filteredUsers.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">ไม่พบผู้ใช้งาน</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            {!selectedUser ? (
              <div className="text-center py-16 text-slate-400">
                <Building2 className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                เลือกผู้ใช้งานทางซ้ายเพื่อจัดการสิทธิ์เข้าบริษัท
              </div>
            ) : userCompanies === null ? (
              <AppLoading />
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedUser.name}</h3>
                  <p className="text-xs text-slate-400">{selectedUser.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    บริษัทที่มีสิทธิ์เข้าใช้งาน
                  </label>
                  <div className="space-y-2">
                    {userCompanies.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50"
                      >
                        <span className="text-sm font-medium text-slate-700">{c.name}</span>
                        <button
                          onClick={() => handleRevoke(c.id)}
                          disabled={revokingId !== null || userCompanies.length <= 1}
                          title={
                            userCompanies.length <= 1
                              ? "ต้องมีอย่างน้อย 1 บริษัทเสมอ"
                              : "ถอดสิทธิ์"
                          }
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {revokingId === c.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {grantableCompanies.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      มอบสิทธิ์เข้าบริษัทเพิ่ม
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <AppSelect
                          value={companyToGrant}
                          onValueChange={setCompanyToGrant}
                          placeholder="-- เลือกบริษัท --"
                          options={grantableCompanies.map((c) => ({ value: String(c.id), label: c.name }))}
                        />
                      </div>
                      <button
                        onClick={handleGrant}
                        disabled={!companyToGrant || granting}
                        className="h-10 px-5 rounded-full bg-blue-600 hover:bg-blue-800 text-white text-sm font-medium flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                      >
                        {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        มอบสิทธิ์
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
