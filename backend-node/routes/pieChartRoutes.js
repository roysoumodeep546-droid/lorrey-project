const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const moment = require("moment");
const AccountDetail = require("../models/AccountDetail");
const { getBillRegisterData } = require("../utils/billRegisterHelper");

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

// Helper database getters
const getCementCol = () => mongoose.connection.useDb("cement_register").collection("entries");
const getBillRegisterCol = () => mongoose.connection.useDb("cement_register").collection("generated_bills");
const getMainCashCol = () => mongoose.connection.useDb("main_cashbook").collection("entries");
const getPumpPaymentCol = () => mongoose.connection.useDb("pump_payment_register").collection("records");

// Parse any date string into YYYY-MM-DD
function parseToYYYYMMDD(dStr) {
  if (!dStr) return null;
  const clean = String(dStr).trim();
  const parts = clean.split(/[-\/\.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const y = parseInt(parts[0], 10);
      const m = String(parseInt(parts[1], 10)).padStart(2, '0');
      const d = String(parseInt(parts[2], 10)).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } else {
      const d = String(parseInt(parts[0], 10)).padStart(2, '0');
      const m = String(parseInt(parts[1], 10)).padStart(2, '0');
      let y = parseInt(parts[2], 10);
      if (parts[2].length === 2) y += (y >= 70 ? 1900 : 2000);
      return `${y}-${m}-${d}`;
    }
  }
  const iso = new Date(clean);
  if (!isNaN(iso.getTime())) {
    const y = iso.getFullYear();
    const m = String(iso.getMonth() + 1).padStart(2, '0');
    const d = String(iso.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

function parseFY(fyStr) {
  if (!fyStr || !fyStr.includes('-')) {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    const startYear = m >= 3 ? y : y - 1;
    return { startYear, endYear: startYear + 1 };
  }
  const parts = fyStr.split('-');
  const startYear = parseInt(parts[0], 10);
  return { startYear, endYear: startYear + 1 };
}

function getDateRange(period, financialYearStr, monthStr, dateStr) {
  const now = moment();
  const today = now.format('YYYY-MM-DD');

  if (period === 'TODAY') {
    return { start: today, end: today };
  }

  const { startYear, endYear } = parseFY(financialYearStr);

  if (period === 'YEARLY') {
    const start = `${startYear}-04-01`;
    const end = `${endYear}-03-31`;
    return { start, end };
  }

  if (period === 'MONTHLY' || period === 'WEEKLY') {
    const monthIndex = MONTHS.indexOf(monthStr);
    const targetMonthIndex = monthIndex >= 0 ? monthIndex : now.month();
    const targetYear = targetMonthIndex >= 3 ? startYear : endYear;

    let startObj, endObj;
    if (dateStr && dateStr.toUpperCase() !== "ALL") {
      const specificDate = parseInt(dateStr, 10);
      if (!isNaN(specificDate) && specificDate >= 1 && specificDate <= 31) {
        startObj = moment(`${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(specificDate).padStart(2, '0')}`, 'YYYY-MM-DD');
        endObj = startObj.clone();
      }
    }

    if (!startObj) {
      startObj = moment(`${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-01`, 'YYYY-MM-DD');
      endObj = startObj.clone().endOf('month');
    }

    return {
      start: startObj.format('YYYY-MM-DD'),
      end: endObj.format('YYYY-MM-DD')
    };
  }

  return { start: today, end: today };
}

// Master Analytics Query Engine
async function fetchChartData(ledgerName, dateRange, period) {
  const cleanLedger = String(ledgerName || '').trim().toLowerCase();
  const records = [];

  if (cleanLedger === 'loading advance' || cleanLedger === 'tonage' || cleanLedger === 'freight billing' || cleanLedger === 'bill & unbilled') {
    const cementCol = getCementCol();
    const allCement = await cementCol.find({}).toArray();

    allCement.forEach(doc => {
      const rawDate = doc["LOADING DT"] || doc["LOADING DATE"] || doc["BILL DATE"] || doc["RECEIVING DATE"];
      const isoDate = parseToYYYYMMDD(rawDate);
      if (!isoDate || isoDate < dateRange.start || isoDate > dateRange.end) return;

      let amount = 0;
      let category = isoDate;

      if (cleanLedger === 'loading advance') {
        amount = parseFloat(String(doc["ADVANCE"] || 0).replace(/,/g, '')) || 0;
      } else if (cleanLedger === 'tonage') {
        amount = parseFloat(String(doc["MT"] || doc["TONNAGE"] || 0).replace(/,/g, '')) || 0;
      } else if (cleanLedger === 'freight billing') {
        amount = parseFloat(String(doc["Billing Amount"] || doc["BILLING ER 95%"] || doc["AMOUNT"] || 0).replace(/,/g, '')) || 0;
      } else if (cleanLedger === 'bill & unbilled') {
        const freightBill = String(doc["BILL NO"] || doc["FREIGHT BILL NO"] || doc["Freight Bill No"] || '').trim();
        const unloadingBill = String(doc["UNLOADING BILL NO"] || doc["Unloading Bill No"] || '').trim();

        const hasFreight = freightBill && freightBill !== '-';
        const hasUnloading = unloadingBill && unloadingBill !== '-';

        if (hasFreight && hasUnloading) category = "Completed / Billed";
        else if (!hasFreight && hasUnloading) category = "Freight Unbilled";
        else if (hasFreight && !hasUnloading) category = "Unloading Unbilled";
        else category = "Fully Unbilled";

        amount = parseFloat(String(doc["Billing Amount"] || doc["BILLING ER 95%"] || doc["AMOUNT"] || 0).replace(/,/g, '')) || 0;
      }

      if (amount <= 0 && cleanLedger !== 'bill & unbilled') return;

      records.push({
        id: String(doc._id),
        slNo: doc["SL NO"] || "-",
        date: rawDate || isoDate,
        isoDate: isoDate,
        name: doc["PARTY NAME"] || doc["OWNER NAME"] || "-",
        vehicle: doc["VEHICLE NUMBER"] || "-",
        amount: amount,
        reference: doc["INVOICE NO"] || doc["BILL NO"] || doc["E-WAY BILL NO"] || "-",
        site: doc["SITE"] || "-",
        party: doc["PARTY NAME"] || "-",
        source: "Cement Register",
        category: category,
        details: doc
      });
    });
  } else if (cleanLedger === 'main cash' || cleanLedger === 'office exp') {
    const cashCol = getMainCashCol();
    const allCash = await cashCol.find({}).toArray();

    allCash.forEach(doc => {
      const rawDate = doc["P_DATE"] || doc["O_DATE"] || doc.transactionDate;
      const isoDate = parseToYYYYMMDD(rawDate);
      if (!isoDate || isoDate < dateRange.start || isoDate > dateRange.end) return;

      let amount = 0;
      if (cleanLedger === 'office exp') {
        amount = parseFloat(String(doc["P_EXPENSE"] || doc["P_WITHDRAW"] || 0).replace(/,/g, '')) || 0;
      } else {
        const dep = parseFloat(String(doc["P_DEPOSIT"] || doc["O_TOTAL"] || 0).replace(/,/g, '')) || 0;
        const wd = parseFloat(String(doc["P_WITHDRAW"] || doc["P_EXPENSE"] || 0).replace(/,/g, '')) || 0;
        amount = dep + wd;
      }

      if (amount <= 0) return;

      records.push({
        id: String(doc._id),
        slNo: doc["SL NO"] || "-",
        date: rawDate || isoDate,
        isoDate: isoDate,
        name: doc["P_PARTICULARS"] || doc["O_PARTICULARS"] || "Main Cash Txn",
        vehicle: "-",
        amount: amount,
        reference: doc["P_VOUCHER_NO"] || doc["P_REF"] || "-",
        site: "-",
        party: doc["P_PARTICULARS"] || "-",
        source: "Main Cashbook",
        category: isoDate,
        details: doc
      });
    });

    if (cleanLedger === 'office exp') {
      const acctDocs = await AccountDetail.find({
        ledgerName: { $regex: /^office exp$/i },
        transactionDate: { $gte: dateRange.start, $lte: dateRange.end }
      });
      acctDocs.forEach(doc => {
        const wStr = doc.withdraw ? String(doc.withdraw).replace(/,/g, '').trim() : '';
        const amt = parseFloat(wStr) || 0;
        if (amt <= 0) return;
        records.push({
          id: String(doc._id),
          slNo: "-",
          date: doc.transactionDate,
          isoDate: doc.transactionDate,
          name: doc.names || doc.particulars || "Office Exp",
          vehicle: doc.vehicle || "-",
          amount: amt,
          reference: doc.referenceNo || doc.chequeNo || "-",
          site: "-",
          party: doc.names || "-",
          source: "Bank Book",
          category: doc.transactionDate,
          details: doc
        });
      });
    }
  } else if (cleanLedger === 'pump payment') {
    const pumpCol = getPumpPaymentCol();
    const allPump = await pumpCol.find({}).toArray();

    allPump.forEach(doc => {
      const rawDate = doc["DATE"] || doc["BILL DATE"] || doc.createdAt;
      const isoDate = parseToYYYYMMDD(rawDate);
      if (!isoDate || isoDate < dateRange.start || isoDate > dateRange.end) return;

      const amt = parseFloat(String(doc["PAYMENT AMOUNT"] || doc["PAYABLE AMOUNT"] || doc["BILL AMOUNT"] || 0).replace(/,/g, '')) || 0;
      if (amt <= 0) return;

      records.push({
        id: String(doc._id),
        slNo: doc["SL NO"] || "-",
        date: rawDate || isoDate,
        isoDate: isoDate,
        name: doc["PUMP NAME"] || "Pump Payment",
        vehicle: Array.isArray(doc.vehicleNumbers) ? doc.vehicleNumbers.join(", ") : (doc.vehicleNumbers || "-"),
        amount: amt,
        reference: doc["BILL NO"] || doc["REF. NO"] || "-",
        site: "-",
        party: doc["PUMP NAME"] || "-",
        source: "Pump Payment Register",
        category: isoDate,
        details: doc
      });
    });
  } else {
    // AccountDetail Ledgers
    const ledgerRegex = new RegExp(`^\\s*${ledgerName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*$`, 'i');
    const acctDocs = await AccountDetail.find({
      ledgerName: ledgerRegex,
      transactionDate: { $gte: dateRange.start, $lte: dateRange.end }
    });

    acctDocs.forEach(doc => {
      const wStr = doc.withdraw ? String(doc.withdraw).replace(/,/g, '').trim() : '';
      const dStr = doc.deposit ? String(doc.deposit).replace(/,/g, '').trim() : '';
      const w = parseFloat(wStr) || 0;
      const d = parseFloat(dStr) || 0;
      const amt = w + d;

      if (amt <= 0) return;

      records.push({
        id: String(doc._id),
        slNo: "-",
        date: doc.transactionDate,
        isoDate: doc.transactionDate,
        name: doc.names || doc.particulars || ledgerName,
        vehicle: doc.vehicle || "-",
        amount: amt,
        reference: doc.referenceNo || doc.chequeNo || "-",
        site: "-",
        party: doc.names || "-",
        source: "Bank Book",
        category: doc.transactionDate,
        details: doc
      });
    });
  }

  // Calculate Groupings and Aggregations
  let totalAmount = 0;
  const dateMap = {};
  const amounts = [];
  const activeDaysSet = new Set();

  records.forEach(r => {
    totalAmount += r.amount;
    amounts.push(r.amount);
    if (r.isoDate) activeDaysSet.add(r.isoDate);

    let groupKey = r.category;
    if (cleanLedger !== 'bill & unbilled') {
      if (period === 'YEARLY') {
        const mIdx = moment(r.isoDate).month();
        groupKey = MONTHS[mIdx] || r.isoDate;
      } else {
        groupKey = moment(r.isoDate).format('D MMM YYYY');
      }
    }

    if (!dateMap[groupKey]) {
      dateMap[groupKey] = { name: groupKey, value: 0, count: 0, rawDate: r.isoDate };
    }
    dateMap[groupKey].value += r.amount;
    dateMap[groupKey].count += 1;
  });

  let pieData = Object.values(dateMap);
  if (cleanLedger !== 'bill & unbilled') {
    if (period === 'YEARLY') {
      pieData.sort((a, b) => MONTHS.indexOf(a.name) - MONTHS.indexOf(b.name));
    } else {
      pieData.sort((a, b) => moment(a.rawDate).valueOf() - moment(b.rawDate).valueOf());
    }
  }

  // Summary Metrics
  const transactionCount = records.length;
  const avgTransaction = transactionCount > 0 ? totalAmount / transactionCount : 0;
  const highestTransaction = amounts.length > 0 ? Math.max(...amounts) : 0;
  const lowestTransaction = amounts.length > 0 ? Math.min(...amounts) : 0;

  let busiestDate = "N/A";
  let highestSpendingDate = "N/A";
  let maxCount = 0;
  let maxSpend = 0;

  Object.values(dateMap).forEach(item => {
    if (item.count > maxCount) {
      maxCount = item.count;
      busiestDate = item.name;
    }
    if (item.value > maxSpend) {
      maxSpend = item.value;
      highestSpendingDate = item.name;
    }
  });

  return {
    totalAmount,
    transactionCount,
    summary: {
      totalAmount,
      transactionCount,
      avgTransaction,
      highestTransaction,
      lowestTransaction,
      busiestDate,
      highestSpendingDate,
      activeDaysCount: activeDaysSet.size
    },
    pieData: pieData.map(({ name, value, count }) => ({ name, value, count })),
    records
  };
}

// Helper function to resolve exact comparison period date bounds
function resolvePeriodRange(fyStr, periodType, monthStr, customDate, isTargetYear = false) {
  const { startYear, endYear } = parseFY(fyStr);
  const now = moment();
  const todayStr = now.format('YYYY-MM-DD');
  const currentCalYear = now.year();
  const currentMonthIdx = now.month(); // 0-11

  if (periodType === 'DATE') {
    const raw = customDate ? parseToYYYYMMDD(customDate) : todayStr;
    const resolved = (isTargetYear && raw > todayStr) ? todayStr : (raw || todayStr);
    return { start: resolved, end: resolved, display: moment(resolved).format('DD-MM-YYYY') };
  }

  if (periodType === 'MONTH') {
    const mIdx = MONTHS.indexOf(monthStr);
    const targetMonthIdx = mIdx >= 0 ? mIdx : currentMonthIdx;
    const targetCalYear = targetMonthIdx >= 3 ? startYear : endYear;
    const mPadded = String(targetMonthIdx + 1).padStart(2, '0');
    const start = `${targetCalYear}-${mPadded}-01`;
    const lastDay = moment(start).endOf('month').format('YYYY-MM-DD');
    let end = lastDay;

    // If TY and current calendar month/year, cap at today so future dates are not included
    if (isTargetYear && targetCalYear === currentCalYear && targetMonthIdx === currentMonthIdx) {
      if (todayStr < lastDay) end = todayStr;
    }

    return {
      start,
      end,
      display: `${moment(start).format('DD-MM-YYYY')} to ${moment(end).format('DD-MM-YYYY')}`
    };
  }

  // FULL_FY
  const start = `${startYear}-04-01`;
  const fyEnd = `${endYear}-03-31`;
  let end = fyEnd;
  // If target year is current or future FY, cap at today
  if (isTargetYear) {
    if (todayStr < fyEnd) {
      end = todayStr;
    }
  }

  return {
    start,
    end,
    display: `${moment(start).format('DD-MM-YYYY')} to ${moment(end).format('DD-MM-YYYY')}`
  };
}

// Calculate Tonnage from Cement Register & Revenue from Bill Register for a given date range and site filter
async function calculatePeriodMetrics(dateRange, siteFilter, allCement, billRows) {
  const cleanSite = (siteFilter || 'ALL').toUpperCase();

  // 1. Tonnage from Cement Register
  let totalTonnage = 0;
  let nvlTonnage = 0;
  let nvclTonnage = 0;
  let tripCount = 0;

  for (const doc of allCement) {
    const rawDate = doc["LOADING DT"] || doc["LOADING DATE"] || doc["BILL DATE"] || doc["RECEIVING DATE"] || doc["DATE"];
    const isoDate = parseToYYYYMMDD(rawDate);
    if (!isoDate || isoDate < dateRange.start || isoDate > dateRange.end) continue;

    const rowSite = String(doc["SITE"] || '').toUpperCase().trim();
    const isNVL = rowSite.includes('NVL') && !rowSite.includes('NVCL');
    const isNVCL = rowSite.includes('NVCL');

    if (cleanSite === 'NVL' && !isNVL) continue;
    if (cleanSite === 'NVCL' && !isNVCL) continue;

    const mt = parseFloat(String(doc["MT"] || doc.mt || doc["TONNAGE"] || 0).replace(/,/g, '')) || 0;
    if (mt > 0) {
      totalTonnage += mt;
      if (isNVL) nvlTonnage += mt;
      if (isNVCL) nvclTonnage += mt;
    }
    tripCount++;
  }

  // 2. Revenue from Bill Register
  let totalRevenue = 0;
  let nvlRevenue = 0;
  let nvclRevenue = 0;
  let billCount = 0;

  for (const b of billRows) {
    const rawDate = b.invoiceDate || b["INVOICE DATE"] || b["BILL DATE"] || b.date;
    const isoDate = parseToYYYYMMDD(rawDate);
    if (!isoDate || isoDate < dateRange.start || isoDate > dateRange.end) continue;

    const rowSite = String(b.site || b["SITE"] || '').toUpperCase().trim();
    const isNVL = rowSite.includes('NVL') && !rowSite.includes('NVCL');
    const isNVCL = rowSite.includes('NVCL');

    if (cleanSite === 'NVL' && !isNVL) continue;
    if (cleanSite === 'NVCL' && !isNVCL) continue;

    const amt = parseFloat(String(b.billAmount || b.amount || b["BILL AMOUNT"] || b["Billing Amount"] || 0).replace(/,/g, '')) || 0;
    if (amt > 0) {
      totalRevenue += amt;
      if (isNVL) nvlRevenue += amt;
      if (isNVCL) nvclRevenue += amt;
    }
    billCount++;
  }

  // Rounding
  totalTonnage = Math.round(totalTonnage * 100) / 100;
  nvlTonnage = Math.round(nvlTonnage * 100) / 100;
  nvclTonnage = Math.round(nvclTonnage * 100) / 100;

  totalRevenue = Math.round(totalRevenue * 100) / 100;
  nvlRevenue = Math.round(nvlRevenue * 100) / 100;
  nvclRevenue = Math.round(nvclRevenue * 100) / 100;

  const revPerMt = totalTonnage > 0 ? Math.round((totalRevenue / totalTonnage) * 100) / 100 : 0;
  const nvlRevPerMt = nvlTonnage > 0 ? Math.round((nvlRevenue / nvlTonnage) * 100) / 100 : 0;
  const nvclRevPerMt = nvclTonnage > 0 ? Math.round((nvclRevenue / nvclTonnage) * 100) / 100 : 0;

  return {
    tonnage: totalTonnage,
    nvlTonnage,
    nvclTonnage,
    tripCount,
    revenue: totalRevenue,
    nvlRevenue,
    nvclRevenue,
    billCount,
    revPerMt,
    nvlRevPerMt,
    nvclRevPerMt,
    dateRange
  };
}

// ── GET /pie-chart/growth-analysis ──────────────────────────────────────────
// Volume (Tonnage) Growth vs Revenue Growth comparative analytics engine
router.get("/growth-analysis", async (req, res) => {
  try {
    const {
      tyFY = 'FY 2026-27',
      pyFY = 'FY 2025-26',
      periodType = 'FULL_FY', // 'FULL_FY' | 'MONTH' | 'DATE'
      month = 'September',
      tyDate,
      pyDate,
      site = 'ALL'
    } = req.query;

    const tyRange = resolvePeriodRange(tyFY, periodType, month, tyDate, true);
    const pyRange = resolvePeriodRange(pyFY, periodType, month, pyDate, false);

    const cementCol = getCementCol();
    const [allCement, { rows: allBillRows = [] }] = await Promise.all([
      cementCol.find({}).toArray(),
      getBillRegisterData({ fy: 'ALL' })
    ]);

    const tyMetrics = await calculatePeriodMetrics(tyRange, site, allCement, allBillRows);
    const pyMetrics = await calculatePeriodMetrics(pyRange, site, allCement, allBillRows);

    // Calculate growth percentages (null if baseline is 0)
    const volumeGrowthPct = pyMetrics.tonnage > 0
      ? Math.round(((tyMetrics.tonnage - pyMetrics.tonnage) / pyMetrics.tonnage) * 10000) / 100
      : null;

    const revenueGrowthPct = pyMetrics.revenue > 0
      ? Math.round(((tyMetrics.revenue - pyMetrics.revenue) / pyMetrics.revenue) * 10000) / 100
      : null;

    const revPerMtGrowthPct = pyMetrics.revPerMt > 0
      ? Math.round(((tyMetrics.revPerMt - pyMetrics.revPerMt) / pyMetrics.revPerMt) * 10000) / 100
      : null;

    const growthGap = (revenueGrowthPct !== null && volumeGrowthPct !== null)
      ? Math.round((revenueGrowthPct - volumeGrowthPct) * 100) / 100
      : null;

    // Reason for disproportion analysis (100% Data-Driven)
    let disproportionReasons = [];
    if (volumeGrowthPct !== null && revenueGrowthPct !== null) {
      const diffRevPerMt = Math.round((tyMetrics.revPerMt - pyMetrics.revPerMt) * 100) / 100;
      if (Math.abs(growthGap) >= 0.01) {
        if (diffRevPerMt !== 0) {
          disproportionReasons.push({
            factor: "Revenue Realization per MT",
            type: diffRevPerMt > 0 ? "POSITIVE_IMPACT" : "NEGATIVE_IMPACT",
            detail: `Average realization changed by ${diffRevPerMt > 0 ? '+' : ''}₹${diffRevPerMt.toLocaleString('en-IN')}/MT (from ₹${pyMetrics.revPerMt.toLocaleString('en-IN')}/MT in ${pyFY} to ₹${tyMetrics.revPerMt.toLocaleString('en-IN')}/MT in ${tyFY}, ${revPerMtGrowthPct > 0 ? '+' : ''}${revPerMtGrowthPct}%). This ${diffRevPerMt > 0 ? 'accelerates' : 'reduces'} financial revenue relative to physical tonnage growth.`
          });
        }

        // Site Mix shift analysis
        const pyTotalTonnage = pyMetrics.tonnage || 1;
        const tyTotalTonnage = tyMetrics.tonnage || 1;
        const pyNvlShare = Math.round((pyMetrics.nvlTonnage / pyTotalTonnage) * 100);
        const tyNvlShare = Math.round((tyMetrics.nvlTonnage / tyTotalTonnage) * 100);
        const pyNvclShare = Math.round((pyMetrics.nvclTonnage / pyTotalTonnage) * 100);
        const tyNvclShare = Math.round((tyMetrics.nvclTonnage / tyTotalTonnage) * 100);

        if (Math.abs(tyNvlShare - pyNvlShare) >= 2 || Math.abs(tyNvclShare - pyNvclShare) >= 2) {
          disproportionReasons.push({
            factor: "Site Mix Contribution Shift",
            type: "MIX_SHIFT",
            detail: `Lifting distribution between sites shifted: NVL changed from ${pyNvlShare}% to ${tyNvlShare}% of total tonnage; NVCL changed from ${pyNvclShare}% to ${tyNvclShare}%. Differing site freight and realization structures directly impact total revenue yield.`
          });
        }
      } else {
        disproportionReasons.push({
          factor: "Proportionate Growth",
          type: "PROPORTIONATE",
          detail: `Volume growth (${volumeGrowthPct}%) and Revenue growth (${revenueGrowthPct}%) are proportionate with stable average realization per MT.`
        });
      }
    } else {
      disproportionReasons.push({
        factor: "Insufficient Historical Baseline",
        type: "INSUFFICIENT_DATA",
        detail: "Insufficient source data in the comparison baseline period to determine a specific mathematical contributing factor."
      });
    }

    res.json({
      success: true,
      filters: {
        tyFY,
        pyFY,
        periodType,
        month,
        tyDate: tyRange.start,
        pyDate: pyRange.start,
        site
      },
      ty: {
        financialYear: tyFY,
        periodDisplay: tyRange.display,
        ...tyMetrics
      },
      py: {
        financialYear: pyFY,
        periodDisplay: pyRange.display,
        ...pyMetrics
      },
      comparison: {
        volumeGrowthPct,
        revenueGrowthPct,
        revPerMtGrowthPct,
        growthGap,
        disproportionReasons
      }
    });
  } catch (err) {
    console.error("[GrowthAnalysis] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { ledger, period, month, financialYear, date } = req.query;

    if (!ledger) {
      return res.status(400).json({ error: "Ledger is required" });
    }

    const currentRange = getDateRange(period || 'TODAY', financialYear, month, date);
    const currentData = await fetchChartData(ledger, currentRange, period || 'TODAY');

    res.json({
      success: true,
      currentRange,
      currentData
    });
  } catch (err) {
    console.error("Pie Chart Data Error:", err);
    res.status(500).json({ error: "Failed to fetch pie chart data: " + err.message });
  }
});

module.exports = router;
