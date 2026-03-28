import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, DollarSign, Wallet, Construction, Heart, Globe, Calendar as CalendarIcon, X, Search } from "lucide-react";
import { toast } from "sonner";

export default function AdminDonations({ donations = [] }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 1. Calculate Fund Summaries (Always based on ALL data)
  const stats = useMemo(() => {
    return donations.reduce((acc, d) => {
      const amt = parseFloat(d.amount) || 0;
      acc.total += amt;
      acc[d.donation_type] = (acc[d.donation_type] || 0) + amt;
      return acc;
    }, { total: 0, tithe: 0, offering: 0, building_fund: 0, mission_fund: 0 });
  }, [donations]);

  // 2. Filter Logic for the Table
  const filtered = useMemo(() => {
    return donations.filter((d) => {
      const matchesType = typeFilter === "all" || d.donation_type === typeFilter;
      if (!matchesType) return false;

      const searchLower = search.toLowerCase();
      const dateStr = d.created_date ? format(new Date(d.created_date), "yyyy-MM-dd").toLowerCase() : "";
      const matchesSearch = !search || 
        (d.donor_name || "").toLowerCase().includes(searchLower) ||
        (d.donor_email || "").toLowerCase().includes(searchLower) ||
        (d.transaction_reference || "").toLowerCase().includes(searchLower) ||
        dateStr.includes(searchLower);
      if (!matchesSearch) return false;

      const dDate = new Date(d.created_date);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (dDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (dDate > end) return false;
      }
      return true;
    });
  }, [donations, typeFilter, startDate, endDate, search]);

  // 3. Current Filter Total
  const currentViewTotal = filtered.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);

  const exportCSV = () => {
    const headers = ["Name", "Email", "Type", "Amount", "Method", "Ref", "Date"];
    const rows = filtered.map(d => [
      d.donor_name || "Anonymous",
      d.donor_email || "N/A",
      d.donation_type,
      d.amount,
      d.payment_method,
      `"${d.transaction_reference || ''}"`, // Wrap in quotes to prevent CSV formatting issues
      d.created_date ? format(new Date(d.created_date), "yyyy-MM-dd") : ""
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `donations_${typeFilter}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Export successful");
  };

  const typeColors = {
    tithe: "bg-blue-100 text-blue-700",
    offering: "bg-green-100 text-green-700",
    building_fund: "bg-amber-100 text-amber-700",
    mission_fund: "bg-purple-100 text-purple-700",
    custom: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Financial Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Collected" value={stats.total} icon={<Wallet className="text-gray-400" />} />
        <StatCard title="Tithes" value={stats.tithe} icon={<DollarSign className="text-blue-500" />} />
        <StatCard title="Building Fund" value={stats.building_fund} icon={<Construction className="text-amber-500" />} />
        <StatCard title="Missions" value={stats.mission_fund} icon={<Globe className="text-purple-500" />} />
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#1a2744]">Financial Records</h2>
          <p className="text-muted-foreground mt-1">
            Showing <span className="font-semibold text-[#c8a951]">KES {currentViewTotal.toLocaleString()}</span> in {typeFilter} receipts.
          </p>
        </div>
        
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label className="text-[10px] uppercase font-bold text-slate-400">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input 
                placeholder="Search name, ref or date..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="h-9 pl-8 bg-white" 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-slate-400">Category</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px] bg-white h-9">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contributions</SelectItem>
                <SelectItem value="tithe">Tithes</SelectItem>
                <SelectItem value="offering">Offerings</SelectItem>
                <SelectItem value="building_fund">Building Fund</SelectItem>
                <SelectItem value="mission_fund">Mission Fund</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-slate-400">From</Label>
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="h-9 w-[140px] bg-white" 
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-slate-400">To</Label>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="h-9 w-[140px] bg-white" 
            />
          </div>

          {(startDate || endDate || typeFilter !== "all" || search) && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setStartDate(""); setEndDate(""); setTypeFilter("all"); setSearch(""); }}
              className="h-9 text-slate-400 hover:text-red-500"
            >
              <X className="w-4 h-4 mr-1" /> Reset
            </Button>
          )}
          
          <Button onClick={exportCSV} variant="default" className="bg-[#1a2744] hover:bg-[#25365d] gap-2 h-9">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-50 shadow-sm">
            <TableRow className="bg-slate-50/50">
              <TableHead className="w-[250px]">Donor Details</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No records found for this category.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d) => (
                <TableRow key={d.id} className="group transition-colors hover:bg-slate-50/50">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{d.donor_name || "Anonymous Giver"}</span>
                      <span className="text-xs text-muted-foreground">{d.donor_email || "No email provided"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`${typeColors[d.donation_type] || typeColors.custom} border-none shadow-none capitalize`}>
                      {d.donation_type?.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono font-bold text-slate-900">
                    KES {parseFloat(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="capitalize">{d.payment_method}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground uppercase tracking-tighter">
                    {d.transaction_reference || "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {d.created_date ? format(new Date(d.created_date), "dd MMM yyyy") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
}

// Helper Component for Stats
function StatCard({ title, value, icon }) {
  return (
    <Card className="border-none shadow-sm bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-[#1a2744]">KES {value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}