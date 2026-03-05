import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, Calendar, BookOpen } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

const COLORS = ["#c8a951", "#1a2744", "#3a7d5c", "#2d5f8a", "#8b5e3c"];

export default function AdminOverview({ members = [], sermons = [], events = [], donations = [] }) {
  
  // 1. Memoized Statistics
  const totals = useMemo(() => {
    const totalDonations = donations.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
    
    // Donation by type for Pie Chart
    const donationByType = donations.reduce((acc, d) => {
      const type = (d.donation_type || "other").replace(/_/g, " ");
      acc[type] = (acc[type] || 0) + (parseFloat(d.amount) || 0);
      return acc;
    }, {});

    const pieData = Object.entries(donationByType).map(([name, value]) => ({ name, value }));

    // Monthly data for Bar Chart (Last 6 Months)
    const monthlyData = Array.from({ length: 6 }).map((_, i) => {
      const monthDate = subMonths(new Date(), 5 - i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      
      const monthlyTotal = donations
        .filter(d => {
          const dDate = new Date(d.created_date);
          return isWithinInterval(dDate, { start, end });
        })
        .reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);

      return {
        month: format(monthDate, "MMM"),
        amount: monthlyTotal
      };
    });

    return { totalDonations, pieData, monthlyData };
  }, [donations]);

  const stats = [
    { title: "Total Members", value: members.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Total Donations", value: `KES ${totals.totalDonations.toLocaleString()}`, icon: DollarSign, color: "text-[#c8a951]", bg: "bg-amber-50" },
    { title: "Active Events", value: events.length, icon: Calendar, color: "text-green-600", bg: "bg-green-50" },
    { title: "Sermon Library", value: sermons.length, icon: BookOpen, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-[#1a2744] tracking-tight">Dashboard Overview</h2>
        <p className="text-muted-foreground italic">Real-time ministry impact and financial health.</p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.title} className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-2xl ${s.bg}`}>
                  <s.icon className={`w-6 h-6 ${s.color}`} />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{s.title}</p>
                  <p className="text-2xl font-bold text-[#1a2744]">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Monthly Bar Chart (60% width) */}
        <Card className="lg:col-span-3 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#1a2744]">Giving Trends (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-100%">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={totals.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `KES ${val/1000}k`} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value) => [`KES ${value.toLocaleString()}`, 'Amount']}
                  />
                  <Bar dataKey="amount" fill="#c8a951" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart (40% width) */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#1a2744]">Donation Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-100%">
              {totals.pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={totals.pieData} 
                      cx="50%" cy="50%" 
                      innerRadius={60} outerRadius={80} 
                      paddingAngle={5} 
                      dataKey="value"
                    >
                      {totals.pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip 
                       contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                       formatter={(value) => `KES ${value.toLocaleString()}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
                  No data available for distribution.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}