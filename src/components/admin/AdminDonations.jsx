import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, DollarSign, Wallet, Construction, Heart, Globe } from "lucide-react";
import { toast } from "sonner";

export default function AdminDonations({ donations = [] }) {
  const [typeFilter, setTypeFilter] = useState("all");

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
    return typeFilter === "all" 
      ? donations 
      : donations.filter(d => d.donation_type === typeFilter);
  }, [donations, typeFilter]);

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
        
        <div className="flex items-center gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px] bg-white">
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
          
          <Button onClick={exportCSV} variant="default" className="bg-[#1a2744] hover:bg-[#25365d] gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
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