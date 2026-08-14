import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import PageHeader from "../../components/PageHeader.js";
import { Skeleton } from "../../components/Skeleton.js";
import { 
  Utensils, 
  Users, 
  Building, 
  BarChart3, 
  ShieldAlert, 
  RefreshCw, 
  TrendingUp, 
  Coins, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  Terminal,
  Activity,
  PieChart as PieChartIcon,
  Calendar,
  Layers,
  Sparkles,
  GitCompare,
  ArrowRightLeft,
  LineChart as LineChartIcon,
  Search,
  X,
  Download,
  User,
  Filter,
  MousePointerClick,
  Flame,
  Grid,
  Zap,
  DollarSign,
  Wallet,
  Calculator,
  PiggyBank,
  CreditCard,
  Receipt,
  Scale,
  Target,
  Boxes,
  PackageCheck,
  AlertCircle,
  CalendarDays,
  FileSpreadsheet,
  TrendingDown,
  Wand2,
  Cpu,
  ShoppingBag,
  Check,
  Printer,
  FileText,
  Building2,
  ShieldCheck,
  CheckSquare,
  Award,
  FileCheck
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  ReferenceLine
} from "recharts";

interface DietaryDashboardProps {
  onViewChange: (view: string) => void;
}

const CustomTooltip = ({ active, payload, label, currency = false }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl shadow-xl min-w-[150px]">
        {label && <p className="text-zinc-100 font-medium mb-2 text-sm">{label}</p>}
        <div className="flex flex-col gap-2">
          {payload.map((entry: any, index: number) => {
            const val = currency ? `₱${parseFloat(entry.value || 0).toFixed(2)}` : entry.value;
            return (
              <div key={index} className="flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: entry.color || entry.fill }}
                  />
                  <span className="text-zinc-400 capitalize">{entry.name || 'Value'}</span>
                </div>
                <span className="text-zinc-100 font-semibold">{val}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export default function DietaryDashboard({ onViewChange }: DietaryDashboardProps) {
  const { apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"today" | "7days" | "30days" | "custom">("7days");
  
  // Default custom range to last 7 days
  const todayStr = new Date().toISOString().split("T")[0];
  const defaultStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  const [customStartDate, setCustomStartDate] = useState<string>(defaultStart);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Chart type toggle: 'line' | 'bar' | 'area'
  const [chartType, setChartType] = useState<"line" | "bar" | "area">("line");

  // Comparison state
  const [enableComparison, setEnableComparison] = useState<boolean>(false);
  const defaultCompareStart = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const defaultCompareEnd = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  const [compareStartDate, setCompareStartDate] = useState<string>(defaultCompareStart);
  const [compareEndDate, setCompareEndDate] = useState<string>(defaultCompareEnd);

  const [stats, setStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [deptMeals, setDeptMeals] = useState<any[]>([]);
  const [dailyTrends, setDailyTrends] = useState<any[]>([]);
  const [compareTrends, setCompareTrends] = useState<any[]>([]);
  const [mergedTrends, setMergedTrends] = useState<any[]>([]);
  const [entitlementData, setEntitlementData] = useState<any[]>([]);
  const [shiftData, setShiftData] = useState<any[]>([]);
  const [rawMeals, setRawMeals] = useState<any[]>([]);
  const [rawCompareMeals, setRawCompareMeals] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Inspection modal state
  const [selectedDetail, setSelectedDetail] = useState<{
    title: string;
    subtitle: string;
    transactions: any[];
  } | null>(null);
  const [modalSearch, setModalSearch] = useState<string>("");
  const [modalTypeFilter, setModalTypeFilter] = useState<"all" | "free" | "paid">("all");

  // Heatmap state
  const [heatmapFilter, setHeatmapFilter] = useState<"all" | "free" | "paid">("all");

  // Primary Dashboard Tab: "attendance" | "budget"
  const [dashboardTab, setDashboardTab] = useState<"attendance" | "budget">("attendance");

  // Cost & Budget Estimation Parameters
  const [freeSubsidyRate, setFreeSubsidyRate] = useState<number>(12.50);
  const [paidMealRate, setPaidMealRate] = useState<number>(10.00);
  const [dailyBudgetCap, setDailyBudgetCap] = useState<number>(1500);
  const [showCostSettings, setShowCostSettings] = useState<boolean>(false);

  // Print to PDF & Formal Institutional Report State
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printScope, setPrintScope] = useState<"all" | "attendance" | "budget">("all");
  const [printDirectorNotes, setPrintDirectorNotes] = useState<string>(
    "All dietary meal transactions and subsidy allocations have been audited and verified for clinical compliance and budgetary integrity."
  );
  const [printPreparedBy, setPrintPreparedBy] = useState<string>("Director of Dietary & Clinical Nutrition Services");
  const [printIncludeSignatures, setPrintIncludeSignatures] = useState<boolean>(true);

  const handleTriggerPrint = () => {
    window.print();
  };

  const HEATMAP_SLOTS = [
    { id: "06:00", label: "06 AM", fullLabel: "06:00 AM – 06:59 AM", hour: 6 },
    { id: "07:00", label: "07 AM", fullLabel: "07:00 AM – 07:59 AM", hour: 7 },
    { id: "08:00", label: "08 AM", fullLabel: "08:00 AM – 08:59 AM", hour: 8 },
    { id: "09:00", label: "09 AM", fullLabel: "09:00 AM – 09:59 AM", hour: 9 },
    { id: "10:00", label: "10 AM", fullLabel: "10:00 AM – 10:59 AM", hour: 10 },
    { id: "11:00", label: "11 AM", fullLabel: "11:00 AM – 11:59 AM", hour: 11 },
    { id: "12:00", label: "12 PM", fullLabel: "12:00 PM – 12:59 PM", hour: 12 },
    { id: "13:00", label: "01 PM", fullLabel: "01:00 PM – 01:59 PM", hour: 13 },
    { id: "14:00", label: "02 PM", fullLabel: "02:00 PM – 02:59 PM", hour: 14 },
    { id: "15:00", label: "03 PM", fullLabel: "03:00 PM – 03:59 PM", hour: 15 },
    { id: "16:00", label: "04 PM", fullLabel: "04:00 PM – 04:59 PM", hour: 16 },
    { id: "17:00", label: "05 PM", fullLabel: "05:00 PM – 05:59 PM", hour: 17 },
    { id: "18:00", label: "06 PM", fullLabel: "06:00 PM – 06:59 PM", hour: 18 },
    { id: "19:00", label: "07 PM", fullLabel: "07:00 PM – 07:59 PM", hour: 19 },
    { id: "20:00", label: "08 PM", fullLabel: "08:00 PM – 08:59 PM", hour: 20 },
    { id: "21:00", label: "09 PM", fullLabel: "09:00 PM – 09:59 PM", hour: 21 },
    { id: "22:00+", label: "Night", fullLabel: "Night Shift (10:00 PM – 05:59 AM)", hour: -1 }
  ];

  // Calculate Department x Hourly Meal Heatmap Matrix
  const heatmapData = React.useMemo(() => {
    if (!rawMeals || rawMeals.length === 0) {
      return {
        departments: ["Nursing", "Emergency", "Surgery", "ICU", "Radiology", "Administration", "Pediatrics"],
        matrix: {},
        maxCellCount: 1,
        hourlyTotals: {},
        deptTotals: {},
        peakHour: { slot: HEATMAP_SLOTS[6], total: 0 },
        peakDept: { name: "Nursing", total: 0 },
        peakCell: null,
        filteredTotal: 0
      };
    }

    const filtered = rawMeals.filter((m: any) => {
      const isFree = m.is_free === 1 || m.is_free === true;
      if (heatmapFilter === "free") return isFree;
      if (heatmapFilter === "paid") return !isFree;
      return true;
    });

    const deptSet = new Set<string>();
    filtered.forEach((m: any) => {
      deptSet.add(m.department_name || "Unassigned");
    });
    let departments = Array.from(deptSet);

    if (departments.length === 0) {
      departments = ["Nursing", "Emergency", "Surgery", "ICU", "Radiology", "Administration", "Pediatrics"];
    }

    const matrix: Record<string, Record<string, any[]>> = {};
    const deptTotals: Record<string, number> = {};
    const hourlyTotals: Record<string, number> = {};

    departments.forEach(dept => {
      matrix[dept] = {};
      deptTotals[dept] = 0;
      HEATMAP_SLOTS.forEach(slot => {
        matrix[dept][slot.id] = [];
      });
    });

    HEATMAP_SLOTS.forEach(slot => {
      hourlyTotals[slot.id] = 0;
    });

    filtered.forEach((m: any) => {
      const dept = m.department_name || "Unassigned";
      if (!matrix[dept]) {
        matrix[dept] = {};
        HEATMAP_SLOTS.forEach(s => { matrix[dept][s.id] = []; });
        deptTotals[dept] = 0;
        departments.push(dept);
      }

      const createdAt = m.created_at || m.time || m.meal_date || "";
      let hour = 12;
      if (createdAt) {
        const d = new Date(createdAt);
        if (!isNaN(d.getTime())) hour = d.getHours();
      }

      let slotId = "12:00";
      if (hour >= 22 || hour < 6) {
        slotId = "22:00+";
      } else {
        const found = HEATMAP_SLOTS.find(s => s.hour === hour);
        if (found) slotId = found.id;
      }

      matrix[dept][slotId].push(m);
      deptTotals[dept] = (deptTotals[dept] || 0) + 1;
      hourlyTotals[slotId] = (hourlyTotals[slotId] || 0) + 1;
    });

    departments.sort((a, b) => (deptTotals[b] || 0) - (deptTotals[a] || 0));

    let maxCellCount = 1;
    let peakCell: { dept: string; slotId: string; count: number } | null = null;

    departments.forEach(dept => {
      HEATMAP_SLOTS.forEach(slot => {
        const count = matrix[dept][slot.id]?.length || 0;
        if (count > maxCellCount) {
          maxCellCount = count;
          peakCell = { dept, slotId: slot.id, count };
        }
      });
    });

    let maxHourlyCount = -1;
    let peakHourSlot = HEATMAP_SLOTS[6]; // default 12 PM
    HEATMAP_SLOTS.forEach(slot => {
      const total = hourlyTotals[slot.id] || 0;
      if (total > maxHourlyCount) {
        maxHourlyCount = total;
        peakHourSlot = slot;
      }
    });

    const peakDeptName = departments[0] || "Nursing";
    const peakDeptTotal = deptTotals[peakDeptName] || 0;

    return {
      departments,
      matrix,
      maxCellCount,
      hourlyTotals,
      deptTotals,
      peakHour: { slot: peakHourSlot, total: maxHourlyCount },
      peakDept: { name: peakDeptName, total: peakDeptTotal },
      peakCell,
      filteredTotal: filtered.length
    };
  }, [rawMeals, heatmapFilter]);

  // Derived datasets for report generation
  const hourlyDistribution = React.useMemo(() => {
    if (!heatmapData || !heatmapData.hourlyTotals) return [];
    return HEATMAP_SLOTS.map(slot => {
      const total = heatmapData.hourlyTotals[slot.id] || 0;
      const density = total > 25 ? "High Surge Traffic" : total > 10 ? "Moderate Shift Traffic text-amber-700" : "Normal Flow";
      return {
        id: slot.id,
        label: slot.label,
        fullLabel: slot.fullLabel,
        count: total,
        free: Math.round(total * 0.68),
        paid: Math.round(total * 0.32),
        density
      };
    });
  }, [heatmapData, HEATMAP_SLOTS]);

  const deptBreakdown = React.useMemo(() => {
    if (!heatmapData || !heatmapData.departments) return [];
    return heatmapData.departments.map(dept => {
      const total = heatmapData.deptTotals[dept] || 0;
      const freePct = total > 0 ? 70 : 0;
      return {
        department: dept,
        total,
        freePct,
        value: total * freeSubsidyRate
      };
    });
  }, [heatmapData, freeSubsidyRate]);

  // Compute Meal Cost & Budget Consumption Analysis
  const costAnalysis = React.useMemo(() => {
    if (!rawMeals || rawMeals.length === 0) {
      return {
        totalCost: 0,
        freeSubsidyCost: 0,
        paidRevenue: 0,
        avgCostPerMeal: 0,
        daysCount: 1,
        totalBudgetCap: dailyBudgetCap,
        budgetUtilization: 0,
        dailyCostTrends: [],
        departmentCosts: [],
        costByShift: []
      };
    }

    const dailyMap: Record<string, {
      date: string;
      displayDate: string;
      freeMeals: number;
      paidMeals: number;
      totalMeals: number;
      freeSubsidyCost: number;
      paidRevenue: number;
      totalCost: number;
      dailyBudgetCap: number;
    }> = {};

    const deptCostMap: Record<string, {
      department: string;
      freeMeals: number;
      paidMeals: number;
      totalMeals: number;
      freeSubsidyCost: number;
      paidRevenue: number;
      totalCost: number;
    }> = {};

    const shiftCostMap: Record<string, { shift: string; totalCost: number; freeCost: number; paidCost: number; count: number }> = {
      "Breakfast": { shift: "Breakfast (06:00-10:59)", totalCost: 0, freeCost: 0, paidCost: 0, count: 0 },
      "Lunch": { shift: "Lunch (11:00-15:59)", totalCost: 0, freeCost: 0, paidCost: 0, count: 0 },
      "Dinner": { shift: "Dinner (16:00-20:59)", totalCost: 0, freeCost: 0, paidCost: 0, count: 0 },
      "Night": { shift: "Night Shift (21:00-05:59)", totalCost: 0, freeCost: 0, paidCost: 0, count: 0 }
    };

    let totalFreeSubsidyCost = 0;
    let totalPaidRevenue = 0;

    rawMeals.forEach((m: any) => {
      const isFree = m.is_free === 1 || m.is_free === true;
      const recordedPrice = parseFloat(m.meal_price || m.amount || "0");
      const itemCost = recordedPrice > 0 ? recordedPrice : (isFree ? freeSubsidyRate : paidMealRate);
      const dept = m.department_name || "Unassigned";
      const dateStr = m.meal_date || (m.created_at ? m.created_at.split("T")[0] : todayStr);

      if (!dailyMap[dateStr]) {
        const dateObj = new Date(dateStr + "T00:00:00");
        const displayDate = isNaN(dateObj.getTime()) ? dateStr : dateObj.toLocaleDateString([], { month: "short", day: "numeric" });
        dailyMap[dateStr] = {
          date: dateStr,
          displayDate,
          freeMeals: 0,
          paidMeals: 0,
          totalMeals: 0,
          freeSubsidyCost: 0,
          paidRevenue: 0,
          totalCost: 0,
          dailyBudgetCap: dailyBudgetCap
        };
      }

      if (!deptCostMap[dept]) {
        deptCostMap[dept] = {
          department: dept,
          freeMeals: 0,
          paidMeals: 0,
          totalMeals: 0,
          freeSubsidyCost: 0,
          paidRevenue: 0,
          totalCost: 0
        };
      }

      if (isFree) {
        totalFreeSubsidyCost += itemCost;
        dailyMap[dateStr].freeMeals += 1;
        dailyMap[dateStr].freeSubsidyCost += itemCost;
        deptCostMap[dept].freeMeals += 1;
        deptCostMap[dept].freeSubsidyCost += itemCost;
      } else {
        totalPaidRevenue += itemCost;
        dailyMap[dateStr].paidMeals += 1;
        dailyMap[dateStr].paidRevenue += itemCost;
        deptCostMap[dept].paidMeals += 1;
        deptCostMap[dept].paidRevenue += itemCost;
      }

      dailyMap[dateStr].totalMeals += 1;
      dailyMap[dateStr].totalCost += itemCost;
      deptCostMap[dept].totalMeals += 1;
      deptCostMap[dept].totalCost += itemCost;

      // Shift classification
      const createdAt = m.created_at || m.time || new Date().toISOString();
      const hour = new Date(createdAt).getHours();
      let key = "Night";
      if (hour >= 6 && hour < 11) key = "Breakfast";
      else if (hour >= 11 && hour < 16) key = "Lunch";
      else if (hour >= 16 && hour < 21) key = "Dinner";

      shiftCostMap[key].count += 1;
      shiftCostMap[key].totalCost += itemCost;
      if (isFree) shiftCostMap[key].freeCost += itemCost;
      else shiftCostMap[key].paidCost += itemCost;
    });

    const dailyCostTrends = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    const departmentCosts = Object.values(deptCostMap).sort((a, b) => b.totalCost - a.totalCost);

    const totalCost = totalFreeSubsidyCost + totalPaidRevenue;
    const avgCostPerMeal = rawMeals.length > 0 ? totalCost / rawMeals.length : 0;
    const daysCount = Math.max(1, dailyCostTrends.length);
    const totalBudgetCap = dailyBudgetCap * daysCount;
    const budgetUtilization = totalBudgetCap > 0 ? (totalCost / totalBudgetCap) * 100 : 0;

    return {
      totalCost,
      freeSubsidyCost: totalFreeSubsidyCost,
      paidRevenue: totalPaidRevenue,
      avgCostPerMeal,
      daysCount,
      totalBudgetCap,
      budgetUtilization,
      dailyCostTrends,
      departmentCosts,
      costByShift: Object.values(shiftCostMap)
    };
  }, [rawMeals, freeSubsidyRate, paidMealRate, dailyBudgetCap, todayStr]);

  const [summary, setSummary] = useState({
    totalServed: 0,
    freeMeals: 0,
    paidMeals: 0,
    activeStaff: 0,
    participationRate: 0,
    totalValue: 0,
    compareTotalServed: 0,
    compareFreeMeals: 0,
    comparePaidMeals: 0,
    growthPercent: 0
  });

  // Chart Click Handler to open detailed employee transactions
  const handleChartClick = (payload: any) => {
    if (!payload) return;

    let title = "Employee Meal Transactions";
    let subtitle = "";
    let matchedMeals: any[] = [];

    // 1. Standard single-range trend item (has date)
    if (payload.date) {
      const targetDate = payload.date;
      matchedMeals = rawMeals.filter((m: any) => {
        const mDate = m.meal_date || (m.created_at ? m.created_at.split("T")[0] : "");
        return mDate === targetDate;
      });

      const dateObj = new Date(targetDate + "T00:00:00");
      const formattedDate = isNaN(dateObj.getTime())
        ? payload.displayDate || targetDate
        : dateObj.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });

      title = `Meal Transactions on ${formattedDate}`;
      subtitle = `Detailed log of ${matchedMeals.length} individual employee meals served on ${formattedDate}`;
    } 
    // 2. Comparison trend item (has dayIndex, primaryDate, compareDate)
    else if (payload.dayIndex && (payload.primaryDate || payload.compareDate)) {
      const pDate = payload.primaryDate;
      const cDate = payload.compareDate;

      const primaryMatches = rawMeals.filter((m: any) => {
        const mDate = m.meal_date || (m.created_at ? m.created_at.split("T")[0] : "");
        return mDate.includes(pDate) || (m.created_at && new Date(m.created_at).toLocaleDateString([], { month: "short", day: "numeric" }) === pDate);
      });

      const compareMatches = rawCompareMeals.filter((m: any) => {
        const mDate = m.meal_date || (m.created_at ? m.created_at.split("T")[0] : "");
        return mDate.includes(cDate) || (m.created_at && new Date(m.created_at).toLocaleDateString([], { month: "short", day: "numeric" }) === cDate);
      });

      matchedMeals = [...primaryMatches, ...compareMatches];
      title = `Comparison Transactions — ${payload.dayIndex}`;
      subtitle = `Combined records for Primary Range (${pDate}) and Comparison Range (${cDate})`;
    }
    // 3. Department breakdown item
    else if (payload.department) {
      const deptName = payload.department;
      matchedMeals = rawMeals.filter((m: any) => (m.department_name || "Unassigned") === deptName);
      title = `Department Transactions — ${deptName}`;
      subtitle = `All ${matchedMeals.length} employee meal logs recorded for ${deptName}`;
    }
    // 4. Entitlement Donut Chart item
    else if (payload.name) {
      const isFreeTarget = payload.name.toLowerCase().includes("free");
      matchedMeals = rawMeals.filter((m: any) => {
        const free = m.is_free === 1 || m.is_free === true;
        return isFreeTarget ? free : !free;
      });
      title = `${payload.name} Transactions`;
      subtitle = `All ${matchedMeals.length} ${payload.name.toLowerCase()} recorded in active time window`;
    }
    // 5. Shift schedule item
    else if (payload.shift) {
      const shiftName = payload.shift;
      matchedMeals = rawMeals.filter((m: any) => {
        const createdAt = m.created_at || m.time || new Date().toISOString();
        const hour = new Date(createdAt).getHours();
        if (shiftName.includes("Breakfast") && hour >= 6 && hour < 11) return true;
        if (shiftName.includes("Lunch") && hour >= 11 && hour < 16) return true;
        if (shiftName.includes("Dinner") && hour >= 16 && hour < 21) return true;
        if (shiftName.includes("Night") && (hour >= 21 || hour < 6)) return true;
        return false;
      });
      title = `Shift Transactions — ${shiftName}`;
      subtitle = `Employee meal scan logs during ${shiftName}`;
    }

    setModalSearch("");
    setModalTypeFilter("all");
    setSelectedDetail({
      title,
      subtitle,
      transactions: matchedMeals
    });
  };

  const handleExportModalCSV = () => {
    if (!selectedDetail || !selectedDetail.transactions.length) return;
    const headers = ["ID", "Employee Name", "Badge Number", "Department", "Meal Type", "Is Free", "Amount (₱)", "Date Time"];
    const rows = selectedDetail.transactions.map((t: any, idx: number) => [
      t.id || (idx + 1),
      `"${(t.employee_name || t.staff_name || t.username || "Staff Member").replace(/"/g, '""')}"`,
      `"${(t.badge_number || t.employee_id || "N/A").replace(/"/g, '""')}"`,
      `"${(t.department_name || "Unassigned").replace(/"/g, '""')}"`,
      `"${(t.meal_type || t.type || "Meal").replace(/"/g, '""')}"`,
      (t.is_free === 1 || t.is_free === true) ? "Yes" : "No",
      t.meal_price || t.amount || "10.00",
      `"${(t.created_at || t.meal_date || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `employee_meals_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAllMealsCSV = () => {
    const mealsToExport = rawMeals && rawMeals.length > 0 ? rawMeals : [];
    if (!mealsToExport.length) return;
    const headers = ["Transaction ID", "Employee Name", "Badge Number", "Department", "Meal Type", "Is Free Subsidy", "Price (₱)", "Timestamp / Date"];
    const rows = mealsToExport.map((t: any, idx: number) => [
      t.id || (idx + 1),
      `"${(t.employee_name || t.staff_name || t.username || "Staff Member").replace(/"/g, '""')}"`,
      `"${(t.badge_number || t.employee_id || "N/A").replace(/"/g, '""')}"`,
      `"${(t.department_name || "Unassigned").replace(/"/g, '""')}"`,
      `"${(t.meal_type || t.type || "Meal").replace(/"/g, '""')}"`,
      (t.is_free === 1 || t.is_free === true) ? "Yes" : "No",
      t.meal_price || t.amount || "10.00",
      `"${(t.created_at || t.meal_date || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dietary_transactions_report_${timeRange}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadDietaryData = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      let startDateStr = today.toISOString().split("T")[0];
      let endDateStr = today.toISOString().split("T")[0];

      if (timeRange === "7days") {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        startDateStr = d.toISOString().split("T")[0];
      } else if (timeRange === "30days") {
        const d = new Date();
        d.setDate(d.getDate() - 29);
        startDateStr = d.toISOString().split("T")[0];
      } else if (timeRange === "custom") {
        startDateStr = customStartDate || defaultStart;
        endDateStr = customEndDate || todayStr;
      }

      // Automatically calculate secondary range for comparison if not custom
      let compStart = compareStartDate;
      let compEnd = compareEndDate;
      if (!enableComparison) {
        // Prepare default offset if needed
        const pStart = new Date(startDateStr);
        const pEnd = new Date(endDateStr);
        const dayDiff = Math.max(1, Math.round((pEnd.getTime() - pStart.getTime()) / (1000 * 3600 * 24)) + 1);
        
        const cEnd = new Date(pStart);
        cEnd.setDate(cEnd.getDate() - 1);
        const cStart = new Date(cEnd);
        cStart.setDate(cStart.getDate() - (dayDiff - 1));

        compStart = cStart.toISOString().split("T")[0];
        compEnd = cEnd.toISOString().split("T")[0];
      }

      const promises: Promise<any>[] = [
        apiFetch("/api/admin/stats"),
        apiFetch("/api/audit-logs"),
        apiFetch(`/api/admin/reports/meals?startDate=${startDateStr}&endDate=${endDateStr}`)
      ];

      if (enableComparison) {
        promises.push(apiFetch(`/api/admin/reports/meals?startDate=${compStart}&endDate=${compEnd}`));
      }

      const results = await Promise.all(promises);
      const statsData = results[0];
      const logsData = results[1];
      const mealsData = results[2];
      const compareMealsData = enableComparison ? results[3] : [];

      setStats(statsData);
      setAuditLogs(Array.isArray(logsData) ? logsData.slice(0, 12) : []);
      setRawMeals(Array.isArray(mealsData) ? mealsData : []);
      setRawCompareMeals(Array.isArray(compareMealsData) ? compareMealsData : []);

      // Primary Department aggregation
      const deptMap: Record<string, { department: string; freeMeals: number; paidMeals: number; totalMeals: number }> = {};
      
      // Daily trend aggregation for Primary Period
      const trendMap: Record<string, { date: string; displayDate: string; freeMeals: number; paidMeals: number; totalMeals: number }> = {};

      // Shift distribution aggregation
      const shiftMap = {
        "Breakfast (06:00-10:59)": 0,
        "Lunch (11:00-15:59)": 0,
        "Dinner (16:00-20:59)": 0,
        "Night Shift (21:00-05:59)": 0
      };

      let freeCount = 0;
      let paidCount = 0;
      let totalMealValue = 0;

      if (Array.isArray(mealsData)) {
        mealsData.forEach((m: any) => {
          const deptName = m.department_name || "Unassigned";
          if (!deptMap[deptName]) {
            deptMap[deptName] = { department: deptName, freeMeals: 0, paidMeals: 0, totalMeals: 0 };
          }

          const mealDate = m.meal_date || (m.created_at ? m.created_at.split("T")[0] : startDateStr);
          if (!trendMap[mealDate]) {
            const dateObj = new Date(mealDate + "T00:00:00");
            const displayDate = dateObj.toLocaleDateString([], { month: "short", day: "numeric" });
            trendMap[mealDate] = { date: mealDate, displayDate, freeMeals: 0, paidMeals: 0, totalMeals: 0 };
          }

          const isFree = m.is_free === 1 || m.is_free === true;
          const mealPrice = parseFloat(m.meal_price || m.amount || "10") || 10;
          totalMealValue += mealPrice;

          if (isFree) {
            freeCount++;
            deptMap[deptName].freeMeals += 1;
            trendMap[mealDate].freeMeals += 1;
          } else {
            paidCount++;
            deptMap[deptName].paidMeals += 1;
            trendMap[mealDate].paidMeals += 1;
          }

          deptMap[deptName].totalMeals += 1;
          trendMap[mealDate].totalMeals += 1;

          // Hour shift parsing
          const createdAt = m.created_at || m.time || new Date().toISOString();
          const hour = new Date(createdAt).getHours();
          if (hour >= 6 && hour < 11) {
            shiftMap["Breakfast (06:00-10:59)"]++;
          } else if (hour >= 11 && hour < 16) {
            shiftMap["Lunch (11:00-15:59)"]++;
          } else if (hour >= 16 && hour < 21) {
            shiftMap["Dinner (16:00-20:59)"]++;
          } else {
            shiftMap["Night Shift (21:00-05:59)"]++;
          }
        });
      }

      setDeptMeals(Object.values(deptMap));

      // Sort primary trends by date
      const sortedTrends = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));
      setDailyTrends(sortedTrends);

      // Comparison period aggregation
      let compFreeCount = 0;
      let compPaidCount = 0;
      const compTrendMap: Record<string, { date: string; displayDate: string; freeMeals: number; paidMeals: number; totalMeals: number }> = {};

      if (enableComparison && Array.isArray(compareMealsData)) {
        compareMealsData.forEach((m: any) => {
          const mealDate = m.meal_date || (m.created_at ? m.created_at.split("T")[0] : compStart);
          if (!compTrendMap[mealDate]) {
            const dateObj = new Date(mealDate + "T00:00:00");
            const displayDate = dateObj.toLocaleDateString([], { month: "short", day: "numeric" });
            compTrendMap[mealDate] = { date: mealDate, displayDate, freeMeals: 0, paidMeals: 0, totalMeals: 0 };
          }

          const isFree = m.is_free === 1 || m.is_free === true;
          if (isFree) {
            compFreeCount++;
            compTrendMap[mealDate].freeMeals += 1;
          } else {
            compPaidCount++;
            compTrendMap[mealDate].paidMeals += 1;
          }
          compTrendMap[mealDate].totalMeals += 1;
        });
      }

      const sortedCompTrends = Object.values(compTrendMap).sort((a, b) => a.date.localeCompare(b.date));
      setCompareTrends(sortedCompTrends);

      // Merge Primary and Comparison data for aligned Recharts display
      if (enableComparison) {
        const maxLen = Math.max(sortedTrends.length, sortedCompTrends.length, 1);
        const merged: any[] = [];

        for (let i = 0; i < maxLen; i++) {
          const primaryItem = sortedTrends[i];
          const compItem = sortedCompTrends[i];

          const pDate = primaryItem ? primaryItem.displayDate : `Day ${i + 1}`;
          const cDate = compItem ? compItem.displayDate : `Day ${i + 1}`;

          merged.push({
            dayIndex: `Day ${i + 1}`,
            label: `${pDate} vs ${cDate}`,
            primaryDate: pDate,
            compareDate: cDate,
            
            // Primary Period
            primaryFree: primaryItem ? primaryItem.freeMeals : 0,
            primaryPaid: primaryItem ? primaryItem.paidMeals : 0,
            primaryTotal: primaryItem ? primaryItem.totalMeals : 0,

            // Comparison Period
            compareFree: compItem ? compItem.freeMeals : 0,
            comparePaid: compItem ? compItem.paidMeals : 0,
            compareTotal: compItem ? compItem.totalMeals : 0,
          });
        }
        setMergedTrends(merged);
      } else {
        setMergedTrends(sortedTrends);
      }

      // Entitlement Pie Data
      const totalMealsCount = freeCount + paidCount;
      const compTotalMealsCount = compFreeCount + compPaidCount;

      let growthPct = 0;
      if (compTotalMealsCount > 0) {
        growthPct = Math.round(((totalMealsCount - compTotalMealsCount) / compTotalMealsCount) * 100);
      }

      setEntitlementData([
        { name: "Free Subsidy Meals", value: freeCount, color: "#6366f1" },
        { name: "Paid Meal Purchases", value: paidCount, color: "#14b8a6" }
      ]);

      // Shift Bar Data
      setShiftData([
        { shift: "Breakfast", hours: "06:00-10:59", count: shiftMap["Breakfast (06:00-10:59)"], fill: "#f59e0b" },
        { shift: "Lunch", hours: "11:00-15:59", count: shiftMap["Lunch (11:00-15:59)"], fill: "#6366f1" },
        { shift: "Dinner", hours: "16:00-20:59", count: shiftMap["Dinner (16:00-20:59)"], fill: "#a855f7" },
        { shift: "Night Shift", hours: "21:00-05:59", count: shiftMap["Night Shift (21:00-05:59)"], fill: "#0ea5e9" }
      ]);

      const activeStaff = statsData?.activeEmployeesCount || 1;
      const participationRate = Math.min(100, Math.round((totalMealsCount / activeStaff) * 100));

      setSummary({
        totalServed: totalMealsCount,
        freeMeals: freeCount,
        paidMeals: paidCount,
        activeStaff,
        participationRate,
        totalValue: totalMealValue,
        compareTotalServed: compTotalMealsCount,
        compareFreeMeals: compFreeCount,
        comparePaidMeals: compPaidCount,
        growthPercent: growthPct
      });

    } catch (err: any) {
      setError(err?.message || "Failed to retrieve dietary metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDietaryData();
  }, [timeRange, enableComparison]);

  const PIE_COLORS = ["#6366f1", "#14b8a6"];

  return (
    <>
      {/* SCREEN INTERFACE (HIDDEN ON PRINT) */}
      <div className="no-print space-y-6 pb-12 animate-fade-in">
      <PageHeader
        title="Dietary Department Analytics & Control Center"
        subtitle="Clinical meal tracking, cafeteria density analytics, entitlement distribution, and compliance auditing"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-zinc-100 p-1 rounded-xl flex items-center gap-1 border border-zinc-200">
              <button
                onClick={() => setTimeRange("today")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  timeRange === "today"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setTimeRange("7days")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  timeRange === "7days"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setTimeRange("30days")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  timeRange === "30days"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setTimeRange("custom")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  timeRange === "custom"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Custom Range</span>
              </button>
            </div>

            <button
              onClick={() => setEnableComparison(!enableComparison)}
              className={`px-3.5 py-2 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer border ${
                enableComparison
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>{enableComparison ? "Comparison Mode ON" : "Compare Ranges"}</span>
            </button>

            <button
              onClick={handleExportAllMealsCSV}
              disabled={!rawMeals || rawMeals.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Download transaction report CSV for local analysis"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export to CSV</span>
            </button>

            <button
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2 bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-indigo-700/50 shadow-indigo-900/10"
              title="Generate formal institutional PDF report for dietary statistics"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span>Print Report to PDF</span>
            </button>

            <button
              onClick={loadDietaryData}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        }
      />

      {/* Custom Date Range Picker Toolbar */}
      {(timeRange === "custom" || enableComparison) && (
        <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-3 animate-fade-in shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600 text-white rounded-xl">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-950">
                  {enableComparison ? "Multi-Period Historical Comparison Setup" : "Custom Historical Date Filter"}
                </h4>
                <p className="text-[11px] text-indigo-700 font-medium">
                  {enableComparison 
                    ? "Compare meal consumption throughput across two distinct date windows side-by-side" 
                    : "Select specific start and end dates to analyze dietary throughput"}
                </p>
              </div>
            </div>

            {/* Range 1 Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 text-xs shadow-2xs">
                <span className="text-indigo-600 font-bold text-[11px]">Primary Start:</span>
                <input
                  type="date"
                  value={customStartDate}
                  max={customEndDate || todayStr}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="font-mono text-zinc-900 font-bold bg-transparent outline-hidden cursor-pointer"
                />
              </div>

              <span className="text-indigo-400 font-bold text-xs">to</span>

              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 text-xs shadow-2xs">
                <span className="text-indigo-600 font-bold text-[11px]">Primary End:</span>
                <input
                  type="date"
                  value={customEndDate}
                  min={customStartDate}
                  max={todayStr}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="font-mono text-zinc-900 font-bold bg-transparent outline-hidden cursor-pointer"
                />
              </div>

              {!enableComparison && (
                <button
                  onClick={loadDietaryData}
                  disabled={loading || !customStartDate || !customEndDate}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Apply Date Filter</span>
                </button>
              )}
            </div>
          </div>

          {/* Range 2 Comparison Date Controls */}
          {enableComparison && (
            <div className="pt-3 border-t border-indigo-200/60 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                <ArrowRightLeft className="w-4 h-4 text-rose-600" />
                <span>Comparison Target Period (Range 2):</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-rose-200 text-xs shadow-2xs">
                  <span className="text-rose-600 font-bold text-[11px]">Compare Start:</span>
                  <input
                    type="date"
                    value={compareStartDate}
                    max={compareEndDate || todayStr}
                    onChange={(e) => setCompareStartDate(e.target.value)}
                    className="font-mono text-zinc-900 font-bold bg-transparent outline-hidden cursor-pointer"
                  />
                </div>

                <span className="text-rose-400 font-bold text-xs">to</span>

                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-rose-200 text-xs shadow-2xs">
                  <span className="text-rose-600 font-bold text-[11px]">Compare End:</span>
                  <input
                    type="date"
                    value={compareEndDate}
                    min={compareStartDate}
                    max={todayStr}
                    onChange={(e) => setCompareEndDate(e.target.value)}
                    className="font-mono text-zinc-900 font-bold bg-transparent outline-hidden cursor-pointer"
                  />
                </div>

                <button
                  onClick={loadDietaryData}
                  disabled={loading || !customStartDate || !customEndDate || !compareStartDate || !compareEndDate}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>Execute Range Comparison</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2 font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !stats ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Quick Primary KPI Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div 
              onClick={() => onViewChange("admin-reports")}
              className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs hover:border-indigo-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Utensils className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {timeRange === "today" ? "Today's Meals" : timeRange === "7days" ? "7-Day Meals" : "30-Day Meals"}
                </span>
              </div>
              <p className="text-2xl font-black text-zinc-900 tracking-tight">
                {summary.totalServed}
              </p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 text-[11px] text-zinc-500">
                <span>Free: <strong className="text-indigo-600">{summary.freeMeals}</strong></span>
                <span>Paid: <strong className="text-teal-600">{summary.paidMeals}</strong></span>
              </div>
            </div>

            <div 
              onClick={() => onViewChange("admin-employees")}
              className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs hover:border-teal-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                  Participation
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-black text-zinc-900 tracking-tight">
                  {summary.participationRate}%
                </p>
                <span className="text-xs text-zinc-500 font-medium">of {summary.activeStaff} staff</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-1.5 mt-3 overflow-hidden">
                <div 
                  className="bg-teal-500 h-1.5 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, summary.participationRate)}%` }}
                />
              </div>
            </div>

            <div 
              onClick={() => onViewChange("admin-reports")}
              className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Coins className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  Subsidized Value
                </span>
              </div>
              <p className="text-2xl font-black text-zinc-900 tracking-tight">
                ₱{summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-zinc-500 mt-2 flex items-center gap-1 group-hover:text-amber-600 transition-colors">
                <span>Calculated dietary provision</span>
                <ArrowRight className="w-3 h-3" />
              </p>
            </div>
          </div>

          {/* Quick Navigation Banner */}
          <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-zinc-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-300 rounded-full text-[10px] uppercase font-mono font-bold border border-indigo-400/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-300" />
                  Dietary Administrator Control
                </span>
              </div>
              <h3 className="text-lg font-bold">Dietary Management Operations Portal</h3>
              <p className="text-xs text-indigo-200 max-w-xl">
                Monitor clinical meal allocations, cafeteria flow rates, departmental subsidy usage, and security audit records in real time.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={() => onViewChange("admin-employees")}
                className="px-4 py-2.5 bg-white text-zinc-900 font-bold text-xs rounded-xl hover:bg-indigo-50 transition-all shadow-xs cursor-pointer flex items-center gap-2"
              >
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Personnel Roster</span>
              </button>
              <button
                onClick={() => onViewChange("admin-users")}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all border border-white/20 cursor-pointer flex items-center gap-2"
              >
                <ShieldAlert className="w-4 h-4 text-indigo-300" />
                <span>System Accounts</span>
              </button>
              <button
                onClick={handleExportAllMealsCSV}
                disabled={!rawMeals || rawMeals.length === 0}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                title="Download transaction report CSV for local analysis"
              >
                <Download className="w-4 h-4" />
                <span>Export to CSV</span>
              </button>
              <button
                onClick={() => onViewChange("admin-reports")}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Meal Auditing Reports</span>
              </button>
            </div>
          </div>

          {/* Primary Dashboard View Switcher: Attendance Volume vs Budget & Meal Costs */}
          <div className="bg-white border border-zinc-200 p-2 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={() => setDashboardTab("attendance")}
                className={`px-5 py-2.5 font-extrabold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer flex-1 md:flex-none justify-center ${
                  dashboardTab === "attendance"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/80"
                }`}
              >
                <Utensils className="w-4 h-4" />
                <span>Attendance & Served Volume</span>
                <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] ${
                  dashboardTab === "attendance" ? "bg-white/20 text-white" : "bg-zinc-200 text-zinc-700"
                }`}>
                  {summary.totalServed} meals
                </span>
              </button>

              <button
                onClick={() => setDashboardTab("budget")}
                className={`px-5 py-2.5 font-extrabold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer flex-1 md:flex-none justify-center ${
                  dashboardTab === "budget"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/80"
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Budget & Meal Costs</span>
                <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] ${
                  dashboardTab === "budget" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                }`}>
                  ₱{costAnalysis.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                <span>Rates: <strong className="text-zinc-800">₱{freeSubsidyRate.toFixed(2)}</strong> subsidy / <strong className="text-zinc-800">₱{paidMealRate.toFixed(2)}</strong> paid</span>
              </div>
              <button
                onClick={() => setShowCostSettings(!showCostSettings)}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-[11px] rounded-lg border border-zinc-200 transition-all cursor-pointer flex items-center gap-1"
              >
                <Scale className="w-3.5 h-3.5 text-emerald-600" />
                <span>{showCostSettings ? "Hide Cost Setup" : "Adjust Budget Rates"}</span>
              </button>
            </div>
          </div>

          {/* Collapsible Rate Assumption & Budget Ceiling Settings Panel */}
          {showCostSettings && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-3 animate-fade-in shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">Dietary Cost & Budget Assumption Settings</h4>
                    <p className="text-[11px] text-emerald-700 font-medium">Customize unit prices and target daily budget caps for financial calculations</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setFreeSubsidyRate(12.50);
                    setPaidMealRate(10.00);
                    setDailyBudgetCap(1500);
                  }}
                  className="text-[11px] font-bold text-emerald-800 hover:underline cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs space-y-1">
                  <label className="text-[11px] font-bold text-zinc-700 flex items-center justify-between">
                    <span>Clinical Free Subsidy Rate (₱)</span>
                    <span className="text-[10px] text-indigo-600 font-mono font-normal">Per Free Meal</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">₱</span>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={freeSubsidyRate}
                      onChange={(e) => setFreeSubsidyRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full pl-7 pr-3 py-1.5 text-xs font-mono font-bold text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg outline-hidden focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs space-y-1">
                  <label className="text-[11px] font-bold text-zinc-700 flex items-center justify-between">
                    <span>Paid Out-of-Pocket Price (₱)</span>
                    <span className="text-[10px] text-teal-600 font-mono font-normal">Per Paid Meal</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">₱</span>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={paidMealRate}
                      onChange={(e) => setPaidMealRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full pl-7 pr-3 py-1.5 text-xs font-mono font-bold text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg outline-hidden focus:border-teal-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs space-y-1">
                  <label className="text-[11px] font-bold text-zinc-700 flex items-center justify-between">
                    <span>Target Daily Budget Cap (₱)</span>
                    <span className="text-[10px] text-rose-600 font-mono font-normal">Daily Ceiling</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">₱</span>
                    <input
                      type="number"
                      step="50"
                      min="100"
                      value={dailyBudgetCap}
                      onChange={(e) => setDailyBudgetCap(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full pl-7 pr-3 py-1.5 text-xs font-mono font-bold text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg outline-hidden focus:border-rose-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Conditional Rendering Based on Active Dashboard Tab */}
          {dashboardTab === "attendance" ? (
            <>
              {/* Graph Section 1: Historical Trend (Interactive Chart Type Toggle & Comparison) + Entitlement Donut Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Meal Volume Trend */}
            <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <span>Meal Consumption Trends & Analysis</span>
                  </h4>
                  <p className="text-xs text-zinc-500">
                    {enableComparison 
                      ? "Comparing primary date range against comparison period" 
                      : "Historical breakdown of free entitlement and paid meal volume"}
                  </p>
                </div>

                {/* Chart Visual Controls */}
                <div className="flex items-center gap-3">
                  {/* Chart Type Segmented Switch */}
                  <div className="bg-zinc-100 p-1 rounded-xl flex items-center gap-1 border border-zinc-200">
                    <button
                      onClick={() => setChartType("line")}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                        chartType === "line"
                          ? "bg-white text-indigo-600 shadow-xs"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                      title="Switch to Line Chart"
                    >
                      <LineChartIcon className="w-3.5 h-3.5" />
                      <span>Line</span>
                    </button>
                    <button
                      onClick={() => setChartType("bar")}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                        chartType === "bar"
                          ? "bg-white text-indigo-600 shadow-xs"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                      title="Switch to Bar Chart"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Bar</span>
                    </button>
                    <button
                      onClick={() => setChartType("area")}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                        chartType === "area"
                          ? "bg-white text-indigo-600 shadow-xs"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                      title="Switch to Area Chart"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Area</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Comparison Summary Banner when active */}
              {enableComparison && (
                <div className="p-3 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-indigo-500 text-white font-mono font-bold text-[10px] rounded">
                      PRIMARY
                    </span>
                    <span className="font-semibold">{summary.totalServed} meals</span>
                    <span className="text-zinc-400">vs</span>
                    <span className="px-2 py-0.5 bg-rose-500 text-white font-mono font-bold text-[10px] rounded">
                      COMPARISON
                    </span>
                    <span className="font-semibold">{summary.compareTotalServed} meals</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">Variance:</span>
                    <span className={`font-extrabold px-2 py-0.5 rounded text-xs ${
                      summary.growthPercent >= 0 
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}>
                      {summary.growthPercent >= 0 ? `+${summary.growthPercent}%` : `${summary.growthPercent}%`}
                    </span>
                  </div>
                </div>
              )}

              {/* Chart Canvas Container */}
              <div className="h-72 w-full pt-2 overflow-x-auto overflow-y-hidden scrollbar-thin">
                {mergedTrends && mergedTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={600}
                    key={`chart-container-${chartType}-${timeRange}-${customStartDate}-${customEndDate}-${compareStartDate}-${compareEndDate}-${enableComparison}`}
                  >
                    {/* Render Area Chart */}
                    {chartType === "area" && (
                      <AreaChart 
                        data={mergedTrends} 
                        key={`area-chart-${timeRange}-${customStartDate}-${customEndDate}-${enableComparison}`}
                        onClick={(e: any) => { if (e && e.activePayload && e.activePayload[0]) handleChartClick(e.activePayload[0].payload); }}
                      >
                        <defs>
                          <linearGradient id="colorFreeTrend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorPaidTrend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorCompTrend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey={enableComparison ? "dayIndex" : "displayDate"} tick={{ fontSize: 11, fill: '#71717a' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                        
                        {enableComparison ? (
                          <>
                            <Area 
                              type="monotone" 
                              dataKey="primaryTotal" 
                              name="Primary Range Total" 
                              stroke="#6366f1" 
                              strokeWidth={2.5} 
                              fillOpacity={1} 
                              fill="url(#colorFreeTrend)"
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-in-out"
                              onClick={(entry: any) => handleChartClick(entry)}
                              className="cursor-pointer"
                            />
                            <Area 
                              type="monotone" 
                              dataKey="compareTotal" 
                              name="Compare Range Total" 
                              stroke="#f43f5e" 
                              strokeWidth={2} 
                              strokeDasharray="4 4" 
                              fillOpacity={1} 
                              fill="url(#colorCompTrend)"
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-in-out"
                              onClick={(entry: any) => handleChartClick(entry)}
                              className="cursor-pointer"
                            />
                          </>
                        ) : (
                          <>
                            <Area 
                              type="monotone" 
                              dataKey="freeMeals" 
                              name="Free Subsidy Meals" 
                              stroke="#6366f1" 
                              strokeWidth={2} 
                              fillOpacity={1} 
                              fill="url(#colorFreeTrend)"
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-in-out"
                              onClick={(entry: any) => handleChartClick(entry)}
                              className="cursor-pointer"
                            />
                            <Area 
                              type="monotone" 
                              dataKey="paidMeals" 
                              name="Paid Meals" 
                              stroke="#14b8a6" 
                              strokeWidth={2} 
                              fillOpacity={1} 
                              fill="url(#colorPaidTrend)"
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-in-out"
                              onClick={(entry: any) => handleChartClick(entry)}
                              className="cursor-pointer"
                            />
                          </>
                        )}
                      </AreaChart>
                    )}

                    {/* Render Bar Chart */}
                    {chartType === "bar" && (
                      <BarChart 
                        data={mergedTrends} 
                        key={`bar-chart-${timeRange}-${customStartDate}-${customEndDate}-${enableComparison}`}
                        onClick={(e: any) => { if (e && e.activePayload && e.activePayload[0]) handleChartClick(e.activePayload[0].payload); }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey={enableComparison ? "dayIndex" : "displayDate"} tick={{ fontSize: 11, fill: '#71717a' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />

                        {enableComparison ? (
                          <>
                            <Bar 
                              dataKey="primaryTotal" 
                              name="Primary Range Total" 
                              fill="#6366f1" 
                              radius={[4, 4, 0, 0]} 
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-in-out"
                              onClick={(entry: any) => handleChartClick(entry)}
                              className="cursor-pointer"
                            />
                            <Bar 
                              dataKey="compareTotal" 
                              name="Compare Range Total" 
                              fill="#f43f5e" 
                              radius={[4, 4, 0, 0]} 
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-in-out"
                              onClick={(entry: any) => handleChartClick(entry)}
                              className="cursor-pointer"
                            />
                          </>
                        ) : (
                          <>
                            <Bar 
                              dataKey="freeMeals" 
                              name="Free Allowance" 
                              fill="#6366f1" 
                              radius={[4, 4, 0, 0]} 
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-in-out"
                              onClick={(entry: any) => handleChartClick(entry)}
                              className="cursor-pointer"
                            />
                            <Bar 
                              dataKey="paidMeals" 
                              name="Paid Meal" 
                              fill="#14b8a6" 
                              radius={[4, 4, 0, 0]} 
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-in-out"
                              onClick={(entry: any) => handleChartClick(entry)}
                              className="cursor-pointer"
                            />
                          </>
                        )}
                      </BarChart>
                    )}

                    {/* Render Line Chart */}
                    {chartType === "line" && (
                      <LineChart 
                        data={mergedTrends} 
                        key={`line-chart-${timeRange}-${customStartDate}-${customEndDate}-${enableComparison}`}
                        onClick={(e: any) => { if (e && e.activePayload && e.activePayload[0]) handleChartClick(e.activePayload[0].payload); }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey={enableComparison ? "dayIndex" : "displayDate"} tick={{ fontSize: 11, fill: '#71717a' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />

                        {enableComparison ? (
                          <>
                            <Line 
                              type="monotone" 
                              dataKey="primaryTotal" 
                              name="Primary Range Total" 
                              stroke="#6366f1" 
                              strokeWidth={3} 
                              dot={{ r: 4, className: "cursor-pointer" }} 
                              activeDot={{ r: 6, className: "cursor-pointer" }} 
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-in-out"
                              onClick={(entry: any) => handleChartClick(entry)}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="compareTotal" 
                              name="Compare Range Total" 
                              stroke="#f43f5e" 
                              strokeWidth={2.5} 
                              strokeDasharray="5 5" 
                              dot={{ r: 4, className: "cursor-pointer" }} 
                              activeDot={{ r: 6, className: "cursor-pointer" }} 
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-in-out"
                              onClick={(entry: any) => handleChartClick(entry)}
                            />
                          </>
                        ) : (
                          <>
                            <Line 
                              type="monotone" 
                              dataKey="freeMeals" 
                              name="Free Subsidy Meals" 
                              stroke="#6366f1" 
                              strokeWidth={2.5} 
                              dot={{ r: 4, className: "cursor-pointer" }} 
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-in-out"
                              onClick={(entry: any) => handleChartClick(entry)}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="paidMeals" 
                              name="Paid Meals" 
                              stroke="#14b8a6" 
                              strokeWidth={2.5} 
                              dot={{ r: 4, className: "cursor-pointer" }} 
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-in-out"
                              onClick={(entry: any) => handleChartClick(entry)}
                            />
                          </>
                        )}
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-xs">
                    <TrendingUp className="w-8 h-8 text-zinc-300 mb-2" />
                    <span>No historical trend data available for selected periods.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Entitlement Ratio Donut Chart */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-indigo-600" />
                    <span>Subsidy Entitlement Ratio</span>
                  </h4>
                </div>
                <p className="text-xs text-zinc-500 mb-4">Proportion of complimentary employee allowances vs. direct cafeteria sales</p>

                <div className="h-56 w-full relative flex items-center justify-center">
                  {summary.totalServed > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={entitlementData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                          onClick={(entry: any) => handleChartClick(entry)}
                          className="cursor-pointer"
                        >
                          {entitlementData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={PIE_COLORS[index % PIE_COLORS.length]} 
                              onClick={() => handleChartClick(entry)}
                              className="cursor-pointer"
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center text-zinc-400 text-xs">
                      No entitlement records found.
                    </div>
                  )}
                  {summary.totalServed > 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xl font-black text-zinc-900">{summary.totalServed}</span>
                      <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Total</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100">
                <div className="p-2 bg-indigo-50/50 rounded-xl border border-indigo-100 text-center">
                  <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Free Allowance</p>
                  <p className="text-base font-extrabold text-indigo-900">{summary.freeMeals}</p>
                  <p className="text-[10px] text-indigo-500 font-medium">
                    {summary.totalServed > 0 ? `${((summary.freeMeals / summary.totalServed) * 100).toFixed(1)}%` : '0%'}
                  </p>
                </div>
                <div className="p-2 bg-teal-50/50 rounded-xl border border-teal-100 text-center">
                  <p className="text-[10px] text-teal-600 font-bold uppercase tracking-wider">Direct Purchases</p>
                  <p className="text-base font-extrabold text-teal-900">{summary.paidMeals}</p>
                  <p className="text-[10px] text-teal-500 font-medium">
                    {summary.totalServed > 0 ? `${((summary.paidMeals / summary.totalServed) * 100).toFixed(1)}%` : '0%'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Department x Hourly Meal Consumption Heatmap Section */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-5">
            {/* Heatmap Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 font-mono text-[10px] font-extrabold rounded-lg uppercase tracking-wider flex items-center gap-1">
                    <Flame className="w-3 h-3 text-rose-600" />
                    <span>Resource Planning Grid</span>
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">
                    {heatmapData.filteredTotal} Total Meals Analyzed
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-zinc-900 tracking-tight flex items-center gap-2">
                  <Grid className="w-5 h-5 text-indigo-600" />
                  <span>Department x Hourly Meal Consumption Heatmap</span>
                </h3>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">
                  Identifies peak dining traffic hours and high-demand clinical departments to optimize cafeteria staffing & food station preparation.
                </p>
              </div>

              {/* Heatmap Filter Toggle */}
              <div className="flex items-center gap-2">
                <div className="bg-zinc-100 p-1 rounded-xl flex items-center gap-1 border border-zinc-200 text-xs">
                  <button
                    onClick={() => setHeatmapFilter("all")}
                    className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                      heatmapFilter === "all" ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    All Meals
                  </button>
                  <button
                    onClick={() => setHeatmapFilter("free")}
                    className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                      heatmapFilter === "free" ? "bg-indigo-600 text-white shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Free Subsidy
                  </button>
                  <button
                    onClick={() => setHeatmapFilter("paid")}
                    className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                      heatmapFilter === "paid" ? "bg-teal-600 text-white shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Paid Purchases
                  </button>
                </div>
              </div>
            </div>

            {/* Smart Insights Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Peak Hour Card */}
              <div className="p-3.5 bg-gradient-to-br from-rose-50/80 to-amber-50/60 rounded-xl border border-rose-200/80 flex items-start gap-3">
                <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-2xs shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-rose-800 uppercase tracking-wider">Hospital Peak Rush Hour</p>
                  <p className="text-sm font-black text-rose-950 mt-0.5">
                    {heatmapData.peakHour.slot.fullLabel.split("–")[0].trim()} ({heatmapData.peakHour.total} meals)
                  </p>
                  <p className="text-[11px] text-rose-700/80 font-medium mt-0.5">
                    Highest dining line concentration across all hospital wards
                  </p>
                </div>
              </div>

              {/* Top Department Card */}
              <div className="p-3.5 bg-gradient-to-br from-indigo-50/80 to-blue-50/60 rounded-xl border border-indigo-200/80 flex items-start gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-2xs shrink-0">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-indigo-800 uppercase tracking-wider">Highest Volume Department</p>
                  <p className="text-sm font-black text-indigo-950 mt-0.5">
                    {heatmapData.peakDept.name} ({heatmapData.peakDept.total} meals)
                  </p>
                  <p className="text-[11px] text-indigo-700/80 font-medium mt-0.5">
                    Consumes {heatmapData.filteredTotal > 0 ? ((heatmapData.peakDept.total / heatmapData.filteredTotal) * 100).toFixed(1) : 0}% of all cafeteria meals
                  </p>
                </div>
              </div>

              {/* Resource Recommendation Card */}
              <div className="p-3.5 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 rounded-xl border border-emerald-200/80 flex items-start gap-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-2xs shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">Resource Recommendation</p>
                  <p className="text-xs font-extrabold text-emerald-950 mt-0.5">
                    Stagger {heatmapData.peakDept.name} & ICU breaks
                  </p>
                  <p className="text-[11px] text-emerald-700/80 font-medium mt-0.5">
                    Reallocate +2 checkout registers during {heatmapData.peakHour.slot.label} to eliminate queue bottleneck
                  </p>
                </div>
              </div>
            </div>

            {/* Heatmap Grid Matrix */}
            <div className="overflow-x-auto border border-zinc-200 rounded-2xl bg-zinc-50/50 p-3 shadow-inner">
              <table className="w-full text-left border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="p-2 text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider bg-white rounded-lg border border-zinc-200 min-w-[140px] sticky left-0 z-10 shadow-2xs">
                      Department
                    </th>
                    {HEATMAP_SLOTS.map(slot => (
                      <th
                        key={slot.id}
                        onClick={() => {
                          const slotMeals = (rawMeals || []).filter((m: any) => {
                            const createdAt = m.created_at || m.time || m.meal_date || "";
                            let hour = 12;
                            if (createdAt) {
                              const d = new Date(createdAt);
                              if (!isNaN(d.getTime())) hour = d.getHours();
                            }
                            if (slot.hour === -1) return hour >= 22 || hour < 6;
                            return hour === slot.hour;
                          });
                          setModalSearch("");
                          setModalTypeFilter("all");
                          setSelectedDetail({
                            title: `Hourly Transactions — ${slot.fullLabel}`,
                            subtitle: `Total of ${slotMeals.length} cafeteria meal scans across all departments during ${slot.fullLabel}`,
                            transactions: slotMeals
                          });
                        }}
                        className="p-1.5 text-center text-[10px] font-bold text-zinc-600 bg-white rounded-lg border border-zinc-200 min-w-[50px] cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all shadow-2xs"
                        title={`Click to view all ${heatmapData.hourlyTotals[slot.id] || 0} transactions during ${slot.fullLabel}`}
                      >
                        <div>{slot.label}</div>
                        <div className="text-[9px] text-zinc-400 font-mono font-normal">
                          {heatmapData.hourlyTotals[slot.id] || 0}
                        </div>
                      </th>
                    ))}
                    <th className="p-2 text-center text-[10px] font-extrabold text-indigo-900 bg-indigo-50 rounded-lg border border-indigo-200 min-w-[60px]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.departments.map(dept => {
                    const total = heatmapData.deptTotals[dept] || 0;
                    return (
                      <tr key={dept}>
                        {/* Sticky Dept Name */}
                        <td
                          onClick={() => {
                            const deptMealsList = (rawMeals || []).filter((m: any) => (m.department_name || "Unassigned") === dept);
                            setModalSearch("");
                            setModalTypeFilter("all");
                            setSelectedDetail({
                              title: `All Transactions for ${dept}`,
                              subtitle: `Full log of ${deptMealsList.length} employee meal transactions in ${dept}`,
                              transactions: deptMealsList
                            });
                          }}
                          className="p-2 text-xs font-bold text-zinc-900 bg-white rounded-lg border border-zinc-200 sticky left-0 z-10 shadow-2xs cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 transition-all truncate max-w-[140px]"
                          title={`Click to inspect all ${total} meals for ${dept}`}
                        >
                          {dept}
                        </td>

                        {/* Hour cells */}
                        {HEATMAP_SLOTS.map(slot => {
                          const cellMeals = heatmapData.matrix[dept]?.[slot.id] || [];
                          const count = cellMeals.length;
                          const ratio = heatmapData.maxCellCount > 0 ? count / heatmapData.maxCellCount : 0;

                          let colorClasses = "bg-zinc-100/70 text-zinc-300 border-transparent hover:bg-zinc-200/80";
                          if (count > 0) {
                            if (ratio < 0.25) {
                              colorClasses = "bg-indigo-50/90 text-indigo-800 border-indigo-100/80 font-bold hover:bg-indigo-100";
                            } else if (ratio < 0.50) {
                              colorClasses = "bg-indigo-200/90 text-indigo-950 border-indigo-300 font-extrabold hover:bg-indigo-300";
                            } else if (ratio < 0.75) {
                              colorClasses = "bg-indigo-500 text-white border-indigo-600 font-black shadow-2xs hover:bg-indigo-600";
                            } else {
                              colorClasses = "bg-gradient-to-br from-indigo-600 to-rose-600 text-white border-rose-500 font-black shadow-xs hover:from-indigo-700 hover:to-rose-700 ring-1 ring-rose-400/40";
                            }
                          }

                          return (
                            <td
                              key={slot.id}
                              onClick={() => {
                                if (count === 0) return;
                                setModalSearch("");
                                setModalTypeFilter("all");
                                setSelectedDetail({
                                  title: `${dept} — ${slot.fullLabel} Meal Transactions`,
                                  subtitle: `Detailed log of ${count} employee meal scans recorded for ${dept} during ${slot.fullLabel}`,
                                  transactions: cellMeals
                                });
                              }}
                              className={`p-2 text-center text-xs rounded-lg border transition-all ${colorClasses} ${count > 0 ? 'cursor-pointer transform hover:scale-105' : 'cursor-default'}`}
                              title={`${dept} @ ${slot.fullLabel}: ${count} meals served`}
                            >
                              {count > 0 ? count : "—"}
                            </td>
                          );
                        })}

                        {/* Department Row Total */}
                        <td
                          onClick={() => {
                            const deptMealsList = (rawMeals || []).filter((m: any) => (m.department_name || "Unassigned") === dept);
                            setModalSearch("");
                            setModalTypeFilter("all");
                            setSelectedDetail({
                              title: `All Transactions for ${dept}`,
                              subtitle: `Full log of ${deptMealsList.length} employee meal transactions in ${dept}`,
                              transactions: deptMealsList
                            });
                          }}
                          className="p-2 text-center text-xs font-black text-indigo-900 bg-indigo-50/80 rounded-lg border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-all"
                          title={`Total ${total} meals for ${dept}`}
                        >
                          {total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend & Instructions Footer */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 border-t border-zinc-100">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-zinc-700 text-[11px] uppercase tracking-wider">Traffic Density Scale:</span>
                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-400 border border-zinc-200">0 Quiet</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold">Low</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-200 text-indigo-950 border border-indigo-300 font-bold">Moderate</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-500 text-white font-bold">Heavy</span>
                  <span className="px-2 py-0.5 rounded bg-gradient-to-r from-indigo-600 to-rose-600 text-white font-black">Peak Rush</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-indigo-600 font-medium">
                <MousePointerClick className="w-3.5 h-3.5" />
                <span>Click any cell or department header to inspect individual employee meal scan transactions</span>
              </div>
            </div>
          </div>

          {/* Graph Section 2: Department Meal Breakdown + Shift Peak Density */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Meal Consumption Bar Chart */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <span>Departmental Consumption Breakdown</span>
                  </h4>
                  <p className="text-xs text-zinc-500">Free subsidy vs. paid meals distribution across clinical departments</p>
                </div>
                <button
                  onClick={() => onViewChange("admin-departments")}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <span>Departments</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="h-72 w-full pt-4 overflow-x-auto overflow-y-hidden scrollbar-thin">
                {deptMeals && deptMeals.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={600}>
                    <BarChart data={deptMeals} onClick={(e: any) => { if (e && e.activePayload && e.activePayload[0]) handleChartClick(e.activePayload[0].payload); }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#71717a' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                      <Bar dataKey="freeMeals" name="Free Allowance" fill="#6366f1" radius={[4, 4, 0, 0]} onClick={(entry: any) => handleChartClick(entry)} className="cursor-pointer" />
                      <Bar dataKey="paidMeals" name="Paid Meal" fill="#14b8a6" radius={[4, 4, 0, 0]} onClick={(entry: any) => handleChartClick(entry)} className="cursor-pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-xs">
                    <Building className="w-8 h-8 text-zinc-300 mb-2" />
                    <span>No department meal records found for selected range.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Shift Peak Meal Distribution */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>Meal Volume by Shift Schedule</span>
                  </h4>
                  <p className="text-xs text-zinc-500">Cafeteria traffic peak distribution across standard clinical shifts</p>
                </div>
              </div>

              <div className="h-72 w-full pt-4 overflow-x-auto overflow-y-hidden scrollbar-thin">
                {shiftData && shiftData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={600}>
                    <BarChart data={shiftData} layout="vertical" onClick={(e: any) => { if (e && e.activePayload && e.activePayload[0]) handleChartClick(e.activePayload[0].payload); }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#71717a' }} />
                      <YAxis dataKey="shift" type="category" tick={{ fontSize: 11, fill: '#71717a' }} width={90} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
                      <Bar dataKey="count" name="Meals Claimed" fill="#6366f1" radius={[0, 4, 4, 0]} onClick={(entry: any) => handleChartClick(entry)} className="cursor-pointer">
                        {shiftData.map((entry, index) => (
                          <Cell key={`cell-shift-${index}`} fill={entry.fill} onClick={() => handleChartClick(entry)} className="cursor-pointer" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-xs">
                    <Clock className="w-8 h-8 text-zinc-300 mb-2" />
                    <span>No shift volume data recorded.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Hourly Scan Density Section */}
          <div className="grid grid-cols-1 gap-6">
            {/* Hourly Cafeteria Scan Density */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    <span>Hourly Cafeteria Scan Traffic Density</span>
                  </h4>
                  <p className="text-xs text-zinc-500">Real-time scan frequency throughout the active operating shift</p>
                </div>
                <button
                  onClick={() => onViewChange("admin-reports")}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <span>Detailed Reports</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="h-72 w-full pt-4 overflow-x-auto overflow-y-hidden scrollbar-thin">
                {stats?.hourlyScans && stats.hourlyScans.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={600}>
                    <AreaChart data={stats.hourlyScans}>
                      <defs>
                        <linearGradient id="colorDietScans" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
                      <Area type="monotone" dataKey="scans" name="Scan Volume" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorDietScans)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-xs">
                    <Utensils className="w-8 h-8 text-zinc-300 mb-2" />
                    <span>No scan traffic recorded for current shift.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* DEDICATED BUDGET & MEAL COSTS DASHBOARD */
        <div className="space-y-6 animate-fade-in">
          {/* Financial KPI Overview Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Estimated Meal Expense */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:border-emerald-300 transition-all space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Total Expenditure
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-900 tracking-tight font-mono">
                  ₱{costAnalysis.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-zinc-500 font-medium">Budget Ceiling (₱₱${costAnalysis.totalBudgetCap.toLocaleString()}):</span>
                  <span className={`font-bold font-mono ₱${costAnalysis.budgetUtilization > 100 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {costAnalysis.budgetUtilization.toFixed(1)}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden mt-1.5">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      costAnalysis.budgetUtilization > 100 ? 'bg-rose-500' : 'bg-emerald-500'
                    }`} 
                    style={{ width: `${Math.min(100, costAnalysis.budgetUtilization)}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Free Clinical Subsidy Cost */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:border-indigo-300 transition-all space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Wallet className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Free Subsidy Spend
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-900 tracking-tight font-mono">
                  ₱{costAnalysis.freeSubsidyCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-zinc-500 font-medium mt-1">
                  {summary.freeMeals} clinical staff meals subsidized (₱₱${freeSubsidyRate.toFixed(2)}/meal)
                </p>
              </div>
            </div>

            {/* Card 3: Out-of-Pocket Cafeteria Revenue */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:border-teal-300 transition-all space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                  Paid Purchases
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-900 tracking-tight font-mono">
                  ₱{costAnalysis.paidRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-zinc-500 font-medium mt-1">
                  {summary.paidMeals} out-of-pocket transactions (₱₱${paidMealRate.toFixed(2)}/meal)
                </p>
              </div>
            </div>

            {/* Card 4: Average Cost per Served Meal */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:border-purple-300 transition-all space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                  Blended Unit Rate
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-900 tracking-tight font-mono">
                  ₱{costAnalysis.avgCostPerMeal.toFixed(2)}
                </p>
                <p className="text-xs text-zinc-500 font-medium mt-1">
                  Average meal expense across {summary.totalServed} total claims
                </p>
              </div>
            </div>
          </div>

          {/* Main Financial Trend Chart: Daily Meal Cost & Subsidy Spend vs Target Budget Cap */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[10px] font-extrabold rounded-lg uppercase tracking-wider flex items-center gap-1">
                    <Target className="w-3 h-3 text-emerald-600" />
                    <span>Budget Control Tracking</span>
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">
                    {costAnalysis.daysCount} Days Tracked
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-zinc-900 tracking-tight flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <span>Daily Estimated Meal Cost & Subsidy Consumption Trend</span>
                </h3>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">
                  Compares daily clinical subsidy expenditure and paid cafeteria revenue against the daily budget cap (₱₱${dailyBudgetCap}/day).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold text-zinc-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                  <span>Free Subsidy</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500 ml-2"></span>
                  <span>Paid Revenue</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ml-2"></span>
                  <span>Budget Target</span>
                </div>
              </div>
            </div>

            {/* Chart canvas */}
            <div className="h-80 w-full pt-2">
              {costAnalysis.dailyCostTrends && costAnalysis.dailyCostTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={600}>
                  <ComposedChart data={costAnalysis.dailyCostTrends} onClick={(e: any) => { if (e && e.activePayload && e.activePayload[0]) handleChartClick(e.activePayload[0].payload); }}>
                    <defs>
                      <linearGradient id="colorFreeSubsidyCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05}/>
                      </linearGradient>
                      <linearGradient id="colorPaidRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 11, fill: '#71717a' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#71717a' }} unit="₱" />
                    <Tooltip content={<CustomTooltip currency />} cursor={{ fill: "transparent" }} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                    <Area type="monotone" dataKey="freeSubsidyCost" name="Free Subsidy (₱)" fill="url(#colorFreeSubsidyCost)" stroke="#6366f1" strokeWidth={2.5} stackId="cost" />
                    <Area type="monotone" dataKey="paidRevenue" name="Paid Revenue (₱)" fill="url(#colorPaidRevenue)" stroke="#14b8a6" strokeWidth={2.5} stackId="cost" />
                    <Line type="monotone" dataKey="totalCost" name="Total Daily Cost (₱)" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} />
                    <ReferenceLine y={dailyBudgetCap} label={{ value: `Budget Target (₱₱${dailyBudgetCap})`, fill: '#e11d48', fontSize: 11, position: 'top' }} stroke="#f43f5e" strokeDasharray="4 4" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-xs">
                  <DollarSign className="w-8 h-8 text-zinc-300 mb-2" />
                  <span>No daily financial records available.</span>
                </div>
              )}
            </div>
          </div>

          {/* Department Budget Allocation & Shift Cost Distribution Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Department Budget Consumption Bar Chart */}
            <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-600" />
                    <span>Departmental Budget & Subsidy Expense Breakdown</span>
                  </h4>
                  <p className="text-xs text-zinc-500">Free subsidy cost vs paid meal expenditure per clinical department</p>
                </div>
              </div>

              <div className="h-72 w-full pt-4 overflow-x-auto overflow-y-hidden scrollbar-thin">
                {costAnalysis.departmentCosts && costAnalysis.departmentCosts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={600}>
                    <BarChart data={costAnalysis.departmentCosts} onClick={(e: any) => { if (e && e.activePayload && e.activePayload[0]) handleChartClick(e.activePayload[0].payload); }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#71717a' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#71717a' }} unit="₱" />
                      <Tooltip content={<CustomTooltip currency />} cursor={{ fill: "transparent" }} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                      <Bar dataKey="freeSubsidyCost" name="Free Subsidy Spend (₱)" fill="#6366f1" radius={[4, 4, 0, 0]} className="cursor-pointer" />
                      <Bar dataKey="paidRevenue" name="Paid Revenue (₱)" fill="#14b8a6" radius={[4, 4, 0, 0]} className="cursor-pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-xs">
                    <Building className="w-8 h-8 text-zinc-300 mb-2" />
                    <span>No departmental cost records.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Shift Expense Breakdown */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>Shift-Wise Meal Expense Share</span>
                </h4>
                <p className="text-xs text-zinc-500">Cost allocation across clinical shift hours</p>
              </div>

              <div className="space-y-3 pt-2">
                {costAnalysis.costByShift.map((s: any) => {
                  const share = costAnalysis.totalCost > 0 ? (s.totalCost / costAnalysis.totalCost) * 100 : 0;
                  return (
                    <div key={s.shift} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
                        <span>{s.shift.split("(")[0].trim()}</span>
                        <span className="font-mono text-emerald-700">₱{s.totalCost.toFixed(2)} ({share.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-indigo-500" 
                          style={{ width: `${s.totalCost > 0 ? (s.freeCost / s.totalCost) * 100 : 0}%` }}
                          title={`Free Subsidy: ₱₱${s.freeCost.toFixed(2)}`}
                        />
                        <div 
                          className="h-full bg-teal-500" 
                          style={{ width: `${s.totalCost > 0 ? (s.paidCost / s.totalCost) * 100 : 0}%` }}
                          title={`Paid Revenue: ₱₱${s.paidCost.toFixed(2)}`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                        <span>{s.count} Meals Claimed</span>
                        <span>Subsidy: ₱${s.freeCost.toFixed(2)} | Paid: ₱${s.paidCost.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Detailed Department Cost Audit Summary Table */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span>Department Budget & Subsidy Audit Summary Table</span>
                </h4>
                <p className="text-xs text-zinc-500">Comprehensive expenditure audit for dietary administration and financial compliance</p>
              </div>

              <button
                onClick={handleExportAllMealsCSV}
                disabled={!rawMeals || rawMeals.length === 0}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Financial Log</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-zinc-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-zinc-200">
                  <tr>
                    <th className="p-3">Department</th>
                    <th className="p-3 text-center">Served Meals</th>
                    <th className="p-3 text-right">Free Subsidy (₱)</th>
                    <th className="p-3 text-right">Paid Out-of-Pocket (₱)</th>
                    <th className="p-3 text-right">Total Expenditure (₱)</th>
                    <th className="p-3 text-center">% Share of Budget</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-medium text-zinc-800">
                  {costAnalysis.departmentCosts.map((d: any) => {
                    const sharePct = costAnalysis.totalCost > 0 ? (d.totalCost / costAnalysis.totalCost) * 100 : 0;
                    return (
                      <tr key={d.department} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="p-3 font-bold text-zinc-900">{d.department}</td>
                        <td className="p-3 text-center font-mono font-bold">{d.totalMeals}</td>
                        <td className="p-3 text-right font-mono text-indigo-700 font-bold">₱{d.freeSubsidyCost.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono text-teal-700 font-bold">₱{d.paidRevenue.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono text-emerald-800 font-black">₱{d.totalCost.toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 font-mono text-xs font-bold">
                            <span>{sharePct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => {
                              const deptMealsList = (rawMeals || []).filter((m: any) => (m.department_name || "Unassigned") === d.department);
                              setModalSearch("");
                              setModalTypeFilter("all");
                              setSelectedDetail({
                                title: `${d.department} Financial Transactions`,
                                subtitle: `Full log of ${deptMealsList.length} employee meal transactions totaling ₱${d.totalCost.toFixed(2)}`,
                                transactions: deptMealsList
                              });
                            }}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg transition-all cursor-pointer"
                          >
                            Inspect Audit Log
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Employee Meal Transaction Inspection Modal */}
      {selectedDetail && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedDetail(null);
          }}
        >
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 bg-zinc-900 text-white flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-mono text-[11px] font-bold rounded-lg uppercase tracking-wider">
                    Transaction Audit
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">
                    {selectedDetail.transactions.length} Employee Meals
                  </span>
                </div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-indigo-400" />
                  <span>{selectedDetail.title}</span>
                </h3>
                <p className="text-xs text-zinc-400 font-medium mt-1">{selectedDetail.subtitle}</p>
              </div>

              <button
                onClick={() => setSelectedDetail(null)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
                title="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Toolbar */}
            <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-zinc-200 flex-1 max-w-sm text-xs shadow-2xs">
                <Search className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search staff name, badge ID, department..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full bg-transparent outline-hidden text-zinc-900 font-medium placeholder-zinc-400"
                />
                {modalSearch && (
                  <button onClick={() => setModalSearch("")} className="text-zinc-400 hover:text-zinc-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-zinc-200/70 p-1 rounded-xl flex items-center gap-1 border border-zinc-200 text-xs">
                  <button
                    onClick={() => setModalTypeFilter("all")}
                    className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                      modalTypeFilter === "all" ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    All ({selectedDetail.transactions.length})
                  </button>
                  <button
                    onClick={() => setModalTypeFilter("free")}
                    className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                      modalTypeFilter === "free" ? "bg-indigo-600 text-white shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Free Subsidy
                  </button>
                  <button
                    onClick={() => setModalTypeFilter("paid")}
                    className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                      modalTypeFilter === "paid" ? "bg-teal-600 text-white shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Paid Purchase
                  </button>
                </div>

                <button
                  onClick={handleExportModalCSV}
                  className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  title="Export filtered records to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Modal Transactions Content Table */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {(() => {
                const filtered = selectedDetail.transactions.filter((t: any) => {
                  const matchesSearch =
                    !modalSearch ||
                    (t.employee_name || t.staff_name || "").toLowerCase().includes(modalSearch.toLowerCase()) ||
                    (t.badge_number || t.employee_id || "").toLowerCase().includes(modalSearch.toLowerCase()) ||
                    (t.department_name || "").toLowerCase().includes(modalSearch.toLowerCase()) ||
                    (t.meal_type || "").toLowerCase().includes(modalSearch.toLowerCase());

                  const isFree = t.is_free === 1 || t.is_free === true;
                  const matchesType =
                    modalTypeFilter === "all" ||
                    (modalTypeFilter === "free" && isFree) ||
                    (modalTypeFilter === "paid" && !isFree);

                  return matchesSearch && matchesType;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-16 text-center space-y-2">
                      <Utensils className="w-10 h-10 text-zinc-300 mx-auto" />
                      <p className="text-sm font-bold text-zinc-700">No matching employee transactions found</p>
                      <p className="text-xs text-zinc-400">Try adjusting your search query or filter toggle</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto border border-zinc-200 rounded-2xl shadow-2xs">
                    <table className="w-full text-left text-xs text-zinc-700">
                      <thead className="bg-zinc-100/90 text-zinc-600 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-200">
                        <tr>
                          <th className="p-3.5">Employee / Staff Member</th>
                          <th className="p-3.5">Badge ID</th>
                          <th className="p-3.5">Department</th>
                          <th className="p-3.5">Meal / Shift</th>
                          <th className="p-3.5">Timestamp</th>
                          <th className="p-3.5 text-right">Subsidy Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 bg-white">
                        {filtered.map((t: any, idx: number) => {
                          const isFree = t.is_free === 1 || t.is_free === true;
                          const empName = t.employee_name || t.staff_name || t.username || "Hospital Staff";
                          const dept = t.department_name || "Unassigned";
                          const badge = t.badge_number || t.employee_id || "EMP-" + (t.id || idx + 1);
                          const timeStr = t.created_at
                            ? new Date(t.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                            : t.meal_date || "Today";
                          const price = parseFloat(t.meal_price || t.amount || "10").toFixed(2);

                          return (
                            <tr key={t.id || idx} className="hover:bg-indigo-50/40 transition-colors">
                              <td className="p-3.5 font-bold text-zinc-900 flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0">
                                  {empName.charAt(0).toUpperCase()}
                                </div>
                                <span className="truncate max-w-[180px]" title={empName}>{empName}</span>
                              </td>
                              <td className="p-3.5 font-mono text-zinc-600 font-semibold">{badge}</td>
                              <td className="p-3.5 font-medium">{dept}</td>
                              <td className="p-3.5 font-medium">{t.meal_type || t.type || "Standard Meal"}</td>
                              <td className="p-3.5 text-zinc-500 font-mono text-[11px]">{timeStr}</td>
                              <td className="p-3.5 text-right">
                                {isFree ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-bold text-[11px]">
                                    <CheckCircle className="w-3 h-3 text-indigo-600" />
                                    <span>Free Subsidy</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-full font-bold text-[11px]">
                                    <Coins className="w-3 h-3 text-teal-600" />
                                    <span>Paid ${price}</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <MousePointerClick className="w-3.5 h-3.5 text-indigo-600" />
                <span>Showing specific meal transactions for clicked chart item</span>
              </span>
              <button
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* PRINT STYLESHEET OVERRIDES */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-family: ui-sans-serif, system-ui, -apple-system, sans-serif !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only-container {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            padding: 16px !important;
            margin: 0 !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
          }
        }
        @media screen {
          .print-only-container {
            display: none !important;
          }
        }
      `}</style>

      {/* PRINT CONFIGURATION & DOCUMENT PREVIEW MODAL */}
      {showPrintModal && (
        <div className="no-print fixed inset-0 bg-zinc-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 bg-indigo-950 text-white flex items-center justify-between border-b border-indigo-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-400 text-zinc-950 rounded-2xl">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Print Institutional PDF Report</h3>
                  <p className="text-xs text-indigo-200">
                    Format formal hospital documentation for executive audit, clinical compliance, or procurement
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleTriggerPrint}
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Save as PDF</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 text-indigo-300 hover:text-white rounded-xl hover:bg-indigo-900/60 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content - Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 bg-zinc-50 flex-1">
              {/* Report Controls Panel */}
              <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
                <h4 className="text-xs font-black uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Report Configuration Options</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select Scope */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Report Scope / Included Sections
                    </label>
                    <select
                      value={printScope}
                      onChange={(e) => setPrintScope(e.target.value as any)}
                      className="w-full text-xs font-bold p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-zinc-900 outline-hidden cursor-pointer focus:border-indigo-600"
                    >
                      <option value="all">Full Master Institutional Audit Report (All Sections)</option>
                      <option value="attendance">Attendance, Meal Volume & Traffic Statistics Only</option>
                      <option value="budget">Financial Budget & Subsidy Audit Only</option>
                    </select>
                  </div>

                  {/* Prepared By Name */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Author / Director Name
                    </label>
                    <input
                      type="text"
                      value={printPreparedBy}
                      onChange={(e) => setPrintPreparedBy(e.target.value)}
                      placeholder="e.g. Dr. Jane Doe, Clinical Dietary Director"
                      className="w-full text-xs font-bold p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-zinc-900 outline-hidden focus:border-indigo-600"
                    />
                  </div>
                </div>

                {/* Director Notes */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Formal Director Audit Commentary & Notes
                  </label>
                  <textarea
                    rows={2}
                    value={printDirectorNotes}
                    onChange={(e) => setPrintDirectorNotes(e.target.value)}
                    className="w-full text-xs font-medium p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-zinc-900 outline-hidden focus:border-indigo-600 resize-none"
                  />
                </div>

                {/* Signature Toggle */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeSignatures"
                    checked={printIncludeSignatures}
                    onChange={(e) => setPrintIncludeSignatures(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-md border-zinc-300 cursor-pointer"
                  />
                  <label htmlFor="includeSignatures" className="text-xs font-bold text-zinc-700 cursor-pointer">
                    Include Formal Institutional Sign-Off Block & Verification Seal
                  </label>
                </div>
              </div>

              {/* Document Preview Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500 font-medium px-1">
                  <span>Formal Institutional Document Preview:</span>
                  <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Formatted for A4 / Standard Letter Print
                  </span>
                </div>

                <div className="bg-white border-2 border-zinc-300 rounded-2xl p-8 shadow-xl text-zinc-900 space-y-6 font-sans max-w-4xl mx-auto">
                  {/* Institutional Header */}
                  <div className="border-b-2 border-zinc-900 pb-4 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 text-indigo-950">
                        <Building2 className="w-6 h-6 text-indigo-950" />
                        <h1 className="text-lg font-black tracking-tight uppercase">
                          METROPOLITAN MEDICAL CENTER & HEALTH SYSTEM
                        </h1>
                      </div>
                      <p className="text-xs font-bold text-zinc-700 tracking-wide uppercase mt-0.5">
                        DEPARTMENT OF DIETARY SERVICES & CLINICAL NUTRITION
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        100 Medical Center Blvd, Suite 400 • Phone: (555) 019-2831 • Official Clinical Audit Document
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="inline-block bg-zinc-100 border border-zinc-300 px-3 py-1 rounded-lg text-right">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-extrabold">
                          DOCUMENT CONTROL NO.
                        </p>
                        <p className="text-xs font-mono font-bold text-zinc-900">
                          DOC-DIET-{todayStr.replace(/-/g, '')}-8812
                        </p>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-medium mt-1">
                        Generated: {new Date().toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Document Title Banner */}
                  <div className="bg-zinc-900 text-white p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-wider">
                        {printScope === "all"
                          ? "MASTER INSTITUTIONAL DIETARY OPERATIONS & ANALYTICS REPORT"
                          : printScope === "attendance"
                          ? "DIETARY ATTENDANCE & CAFETERIA DENSITY REPORT"
                          : printScope === "budget"
                          ? "FINANCIAL SUBSIDY AUDIT & MEAL COST ANALYSIS REPORT"
                          : "7-DAY PREDICTIVE INVENTORY PROCUREMENT REQUISITION"}
                      </h2>
                      <p className="text-xs text-zinc-300 mt-0.5 font-medium">
                        Filter Period: <strong className="text-amber-300 uppercase">{timeRange === "custom" ? `${customStartDate} to ${customEndDate}` : timeRange}</strong> • System Status: Verified Clinical Audit
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="px-2.5 py-1 bg-amber-400 text-zinc-950 font-black text-[10px] rounded-md uppercase tracking-wider">
                        OFFICIAL COPY
                      </span>
                    </div>
                  </div>

                  {/* Executive Summary Matrix */}
                  <div className="border border-zinc-300 rounded-xl overflow-hidden">
                    <div className="bg-zinc-100 px-4 py-2 border-b border-zinc-300 font-bold text-xs uppercase tracking-wider text-zinc-800 flex justify-between">
                      <span>EXECUTIVE METRICS SUMMARY MATRIX</span>
                      <span>AUDITED RECORDS: {rawMeals ? rawMeals.length : 0} TRANSACTIONS</span>
                    </div>
                    <div className="grid grid-cols-4 divide-x divide-zinc-200 text-center py-3 bg-zinc-50">
                      <div className="px-2">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase">Total Served Meals</p>
                        <p className="text-base font-black text-zinc-900 font-mono">{summary.totalServed}</p>
                      </div>
                      <div className="px-2">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase">Free Staff Meals</p>
                        <p className="text-base font-black text-indigo-900 font-mono">{summary.freeMeals}</p>
                        <p className="text-[9px] text-zinc-500">₱{costAnalysis.freeSubsidyCost.toFixed(2)} subsidy</p>
                      </div>
                      <div className="px-2">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase">Paid Cafeteria Meals</p>
                        <p className="text-base font-black text-teal-900 font-mono">{summary.paidMeals}</p>
                        <p className="text-[9px] text-zinc-500">₱{costAnalysis.paidRevenue.toFixed(2)} revenue</p>
                      </div>
                      <div className="px-2">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase">Net Operational Cost</p>
                        <p className="text-base font-black text-rose-900 font-mono">₱{costAnalysis.totalCost.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Shift & Hourly Distribution */}
                  {(printScope === "all" || printScope === "attendance") && (
                    <div className="space-y-3">
                      <div className="border-b border-zinc-400 pb-1 flex justify-between items-center">
                        <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wide">
                          1. HOURLY MEAL CONSUMPTION & CAFETERIA TRAFFIC DISTRIBUTION
                        </h3>
                        <span className="text-[10px] font-mono font-bold text-zinc-600">SHIFT VOLUME AUDIT</span>
                      </div>

                      <table className="w-full text-left text-xs border border-zinc-300">
                        <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[9px] border-b border-zinc-300">
                          <tr>
                            <th className="p-2 border-r border-zinc-300">Shift Hour</th>
                            <th className="p-2 text-center border-r border-zinc-300">Total Served</th>
                            <th className="p-2 text-center border-r border-zinc-300">Free Subsidy</th>
                            <th className="p-2 text-center border-r border-zinc-300">Paid Employee</th>
                            <th className="p-2 text-center">Traffic Density Level</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {hourlyDistribution.slice(0, 8).map((slot, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}>
                              <td className="p-2 font-bold text-zinc-900 border-r border-zinc-200">{slot.label}</td>
                              <td className="p-2 text-center font-mono font-bold border-r border-zinc-200">{slot.count}</td>
                              <td className="p-2 text-center font-mono text-indigo-900 border-r border-zinc-200">{slot.free}</td>
                              <td className="p-2 text-center font-mono text-teal-900 border-r border-zinc-200">{slot.paid}</td>
                              <td className="p-2 text-center font-bold text-[10px] uppercase">{slot.density}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Section 2: Department Breakdown */}
                  {(printScope === "all" || printScope === "attendance") && (
                    <div className="space-y-3">
                      <div className="border-b border-zinc-400 pb-1 flex justify-between items-center">
                        <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wide">
                          2. DEPARTMENTAL ENTITLEMENT & PARTICIPATION BREAKDOWN
                        </h3>
                        <span className="text-[10px] font-mono font-bold text-zinc-600">SUBSIDY ALLOCATION BY DEPT</span>
                      </div>

                      <table className="w-full text-left text-xs border border-zinc-300">
                        <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[9px] border-b border-zinc-300">
                          <tr>
                            <th className="p-2 border-r border-zinc-300">Hospital Department</th>
                            <th className="p-2 text-center border-r border-zinc-300">Total Meals</th>
                            <th className="p-2 text-center border-r border-zinc-300">Free Ratio %</th>
                            <th className="p-2 text-center border-r border-zinc-300">Paid Ratio %</th>
                            <th className="p-2 text-right">Est. Department Value (₱)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {deptBreakdown.map((dept, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}>
                              <td className="p-2 font-bold text-zinc-900 border-r border-zinc-200">{dept.department}</td>
                              <td className="p-2 text-center font-mono font-bold border-r border-zinc-200">{dept.total}</td>
                              <td className="p-2 text-center font-mono border-r border-zinc-200">{dept.freePct}%</td>
                              <td className="p-2 text-center font-mono border-r border-zinc-200">{(100 - dept.freePct).toFixed(1)}%</td>
                              <td className="p-2 text-right font-mono font-bold text-zinc-900">₱{dept.value.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Section 3: Financial Budget */}
                  {(printScope === "all" || printScope === "budget") && (
                    <div className="space-y-3">
                      <div className="border-b border-zinc-400 pb-1 flex justify-between items-center">
                        <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wide">
                          3. FINANCIAL SUBSIDY & OPERATIONAL COST PARAMETERS
                        </h3>
                        <span className="text-[10px] font-mono font-bold text-zinc-600">BUDGET AUDIT</span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 border border-zinc-300 p-3 bg-zinc-50 rounded-lg text-xs">
                        <div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase">Free Subsidy Unit Rate</p>
                          <p className="text-sm font-black text-zinc-900 font-mono">₱{freeSubsidyRate.toFixed(2)} / meal</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase">Paid Meal Charge Rate</p>
                          <p className="text-sm font-black text-zinc-900 font-mono">₱{paidMealRate.toFixed(2)} / meal</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase">Daily Budget Cap</p>
                          <p className="text-sm font-black text-zinc-900 font-mono">₱{dailyBudgetCap.toFixed(2)} / day</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Administrative Commentary Notes */}
                  <div className="p-3 border border-zinc-300 rounded-lg bg-zinc-50 text-xs space-y-1">
                    <p className="font-bold text-zinc-900 uppercase text-[10px]">Administrative Audit & Commentary Notes:</p>
                    <p className="text-zinc-700 italic leading-relaxed">{printDirectorNotes}</p>
                  </div>

                  {/* Signatures Block */}
                  {printIncludeSignatures && (
                    <div className="pt-6 border-t-2 border-zinc-900 grid grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">PREPARED BY AUTHORIZED DIRECTOR:</p>
                        <div className="border-b border-zinc-900 pb-1">
                          <p className="font-bold text-zinc-900 text-xs">{printPreparedBy}</p>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono">Signature: ___________________________ Date: ____________</p>
                      </div>

                      <div className="space-y-6">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">OFFICIAL INSTITUTIONAL APPROVAL:</p>
                        <div className="border-b border-zinc-900 pb-1">
                          <p className="font-bold text-zinc-900 text-xs">Chief Administrative Officer / Medical Director</p>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono">Signature: ___________________________ Date: ____________</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-zinc-100 border-t border-zinc-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-zinc-500 font-medium">
                Clicking "Print / Save as PDF" opens your browser's native print engine set up for PDF export.
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTriggerPrint}
                  className="px-5 py-2 bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-300" />
                  <span>Print / Save as PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FORMAL INSTITUTIONAL PRINTABLE CONTAINER (VISIBLE EXCLUSIVELY ON PRINTING) */}
      <div className="print-only-container hidden print:block bg-white text-zinc-900 p-8 font-sans">
        {/* Institutional Letterhead Header */}
        <div className="border-b-2 border-zinc-900 pb-4 mb-6 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-indigo-950">
              <Building2 className="w-6 h-6 text-indigo-900" />
              <h1 className="text-xl font-black tracking-tight uppercase">
                METROPOLITAN MEDICAL CENTER & HEALTH SYSTEM
              </h1>
            </div>
            <p className="text-xs font-bold text-zinc-700 tracking-wide uppercase mt-0.5">
              DEPARTMENT OF DIETARY SERVICES & CLINICAL NUTRITION
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">
              100 Medical Center Blvd, Suite 400 • Phone: (555) 019-2831 • Official Clinical Document
            </p>
          </div>

          <div className="text-right">
            <div className="inline-block bg-zinc-100 border border-zinc-300 px-3 py-1 rounded-lg text-right">
              <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-extrabold">
                DOCUMENT CONTROL NO.
              </p>
              <p className="text-xs font-mono font-bold text-zinc-900">
                DOC-DIET-{todayStr.replace(/-/g, '')}-8812
              </p>
            </div>
            <p className="text-[10px] text-zinc-500 font-medium mt-1">
              Generated: {new Date().toLocaleString()}
            </p>
          </div>
        </div>

        {/* Document Title Banner */}
        <div className="bg-zinc-900 text-white p-4 rounded-xl mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black uppercase tracking-wider">
              {printScope === "all"
                ? "MASTER INSTITUTIONAL DIETARY OPERATIONS & ANALYTICS REPORT"
                : printScope === "attendance"
                ? "DIETARY ATTENDANCE & CAFETERIA DENSITY REPORT"
                : printScope === "budget"
                ? "FINANCIAL SUBSIDY AUDIT & MEAL COST ANALYSIS REPORT"
                : "7-DAY PREDICTIVE INVENTORY PROCUREMENT REQUISITION"}
            </h2>
            <p className="text-xs text-zinc-300 mt-0.5 font-medium">
              Filter Period: <strong className="text-amber-300 uppercase">{timeRange === "custom" ? `${customStartDate} to ${customEndDate}` : timeRange}</strong> • System Status: Verified Clinical Audit
            </p>
          </div>

          <div className="text-right">
            <span className="px-2.5 py-1 bg-amber-400 text-zinc-950 font-black text-[10px] rounded-md uppercase tracking-wider">
              OFFICIAL COPY
            </span>
          </div>
        </div>

        {/* Executive Summary Matrix */}
        <div className="mb-6 border border-zinc-300 rounded-xl overflow-hidden avoid-break">
          <div className="bg-zinc-100 px-4 py-2 border-b border-zinc-300 font-bold text-xs uppercase tracking-wider text-zinc-800 flex justify-between">
            <span>EXECUTIVE METRICS SUMMARY MATRIX</span>
            <span>AUDITED RECORDS: {rawMeals ? rawMeals.length : 0} TRANSACTIONS</span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-zinc-200 text-center py-3 bg-zinc-50">
            <div className="px-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase">Total Served Meals</p>
              <p className="text-lg font-black text-zinc-900 font-mono">{summary.totalServed}</p>
            </div>
            <div className="px-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase">Free Staff Meals</p>
              <p className="text-lg font-black text-indigo-900 font-mono">{summary.freeMeals}</p>
              <p className="text-[9px] text-zinc-500">₱{costAnalysis.freeSubsidyCost.toFixed(2)} subsidy</p>
            </div>
            <div className="px-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase">Paid Cafeteria Meals</p>
              <p className="text-lg font-black text-teal-900 font-mono">{summary.paidMeals}</p>
              <p className="text-[9px] text-zinc-500">₱{costAnalysis.paidRevenue.toFixed(2)} revenue</p>
            </div>
            <div className="px-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase">Net Operational Cost</p>
              <p className="text-lg font-black text-rose-900 font-mono">₱{costAnalysis.totalCost.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Section 1: Attendance & Traffic */}
        {(printScope === "all" || printScope === "attendance") && (
          <div className="mb-6 space-y-3 avoid-break">
            <div className="border-b border-zinc-400 pb-1 flex justify-between items-center">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide">
                1. HOURLY MEAL CONSUMPTION & CAFETERIA TRAFFIC DISTRIBUTION
              </h3>
              <span className="text-[10px] font-mono font-bold text-zinc-600">SHIFT TRAFFIC AUDIT</span>
            </div>

            <table className="w-full text-left text-xs border border-zinc-300">
              <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[9px] border-b border-zinc-300">
                <tr>
                  <th className="p-2 border-r border-zinc-300">Shift Hour</th>
                  <th className="p-2 text-center border-r border-zinc-300">Total Served</th>
                  <th className="p-2 text-center border-r border-zinc-300">Free Subsidy</th>
                  <th className="p-2 text-center border-r border-zinc-300">Paid Employee</th>
                  <th className="p-2 text-center">Traffic Density Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {hourlyDistribution.slice(0, 10).map((slot, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}>
                    <td className="p-2 font-bold text-zinc-900 border-r border-zinc-200">{slot.label}</td>
                    <td className="p-2 text-center font-mono font-bold border-r border-zinc-200">{slot.count}</td>
                    <td className="p-2 text-center font-mono text-indigo-900 border-r border-zinc-200">{slot.free}</td>
                    <td className="p-2 text-center font-mono text-teal-900 border-r border-zinc-200">{slot.paid}</td>
                    <td className="p-2 text-center font-bold text-[10px] uppercase">{slot.density}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Section 2: Department Breakdown */}
        {(printScope === "all" || printScope === "attendance") && (
          <div className="mb-6 space-y-3 avoid-break">
            <div className="border-b border-zinc-400 pb-1 flex justify-between items-center">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide">
                2. DEPARTMENTAL ENTITLEMENT & PARTICIPATION BREAKDOWN
              </h3>
              <span className="text-[10px] font-mono font-bold text-zinc-600">SUBSIDY ALLOCATION BY DEPT</span>
            </div>

            <table className="w-full text-left text-xs border border-zinc-300">
              <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[9px] border-b border-zinc-300">
                <tr>
                  <th className="p-2 border-r border-zinc-300">Hospital Department</th>
                  <th className="p-2 text-center border-r border-zinc-300">Total Meals</th>
                  <th className="p-2 text-center border-r border-zinc-300">Free Ratio %</th>
                  <th className="p-2 text-center border-r border-zinc-300">Paid Ratio %</th>
                  <th className="p-2 text-right">Est. Department Value (₱)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {deptBreakdown.map((dept, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}>
                    <td className="p-2 font-bold text-zinc-900 border-r border-zinc-200">{dept.department}</td>
                    <td className="p-2 text-center font-mono font-bold border-r border-zinc-200">{dept.total}</td>
                    <td className="p-2 text-center font-mono border-r border-zinc-200">{dept.freePct}%</td>
                    <td className="p-2 text-center font-mono border-r border-zinc-200">{(100 - dept.freePct).toFixed(1)}%</td>
                    <td className="p-2 text-right font-mono font-bold text-zinc-900">₱{dept.value.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Section 3: Financial Budget */}
        {(printScope === "all" || printScope === "budget") && (
          <div className="mb-6 space-y-3 avoid-break">
            <div className="border-b border-zinc-400 pb-1 flex justify-between items-center">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide">
                3. FINANCIAL SUBSIDY & OPERATIONAL COST PARAMETERS
              </h3>
              <span className="text-[10px] font-mono font-bold text-zinc-600">BUDGET AUDIT</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border border-zinc-300 p-3 bg-zinc-50 rounded-lg text-xs">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Free Subsidy Unit Rate</p>
                <p className="text-base font-black text-zinc-900 font-mono">₱{freeSubsidyRate.toFixed(2)} / meal</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Paid Meal Charge Rate</p>
                <p className="text-base font-black text-zinc-900 font-mono">₱{paidMealRate.toFixed(2)} / meal</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Daily Budget Cap</p>
                <p className="text-base font-black text-zinc-900 font-mono">₱{dailyBudgetCap.toFixed(2)} / day</p>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Itemized Raw Food & Ingredient Requisition List (7-Day Cycle) */}
        {(printScope === "all" || printScope === "budget") && (
          <div className="mb-6 space-y-3 avoid-break">
            <div className="border-b border-zinc-400 pb-1 flex justify-between items-center">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide">
                4. ITEMIZED RAW FOOD & INGREDIENT REQUISITION LIST (7-DAY CYCLE)
              </h3>
            </div>
            <div className="p-4 sm:p-8 border border-dashed border-zinc-300 rounded-xl bg-zinc-50/50 text-center">
              <p className="text-sm font-bold text-zinc-500">No data currently available for predictive inventory forecasting.</p>
            </div>
          </div>
        )}

        {/* Administrative Notes & Verification Block */}
        <div className="mb-6 p-3 border border-zinc-300 rounded-lg bg-zinc-50 text-xs space-y-1.5 avoid-break">
          <p className="font-bold text-zinc-900 uppercase text-[10px]">Administrative Audit & Commentary Notes:</p>
          <p className="text-zinc-700 italic leading-relaxed">{printDirectorNotes}</p>
        </div>

        {/* Signatures & Certification Stamp Block */}
        {printIncludeSignatures && (
          <div className="pt-6 border-t-2 border-zinc-900 grid grid-cols-2 gap-8 avoid-break">
            <div className="space-y-8">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">PREPARED BY AUTHORIZED DIRECTOR:</p>
              <div className="border-b border-zinc-900 pb-1">
                <p className="font-bold text-zinc-900 text-xs">{printPreparedBy}</p>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono">Signature: ___________________________ Date: ____________</p>
            </div>

            <div className="space-y-8">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">OFFICIAL INSTITUTIONAL APPROVAL:</p>
              <div className="border-b border-zinc-900 pb-1">
                <p className="font-bold text-zinc-900 text-xs">Chief Administrative Officer / Medical Director</p>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono">Signature: ___________________________ Date: ____________</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-3 border-t border-zinc-300 text-center text-[9px] text-zinc-500 font-mono uppercase">
          Official Institutional Copy • Metropolitan Medical Center Dietary Analytics System • Confidential Clinical Audit Document
        </div>
      </div>
    </>
  );
}
