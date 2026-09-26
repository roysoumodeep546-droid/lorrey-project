import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, IconButton, Grid, Select, MenuItem, TextField,
  CircularProgress, Button, Divider, Dialog, DialogTitle, DialogContent,
  DialogActions, TableContainer, Table, TableHead, TableRow, TableCell,
  TableBody, TablePagination, Chip, Alert, Tabs, Tab
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import IosShareIcon from '@mui/icons-material/IosShare';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import PercentIcon from '@mui/icons-material/Percent';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DynamicPieChart from '../components/DynamicPieChart';
import VolumeVsRevenueGrowthTab from '../components/VolumeVsRevenueGrowthTab';
import axios from 'axios';
import { io } from 'socket.io-client';
import { exportToCsv } from '../utils/exportCsv';

const SOCKET_URL = import.meta.env.VITE_SOCKET_IO_URL || import.meta.env.VITE_API_URL;

const LEDGER_NAMES = [
  "Payment Received (NVCL/NVL)",
  "Freight Payment",
  "Freight Advance",
  "Staff Salary",
  "Toll Payment",
  "Fasttag Payment",
  "ROOM RENT",
  "Main Cash",
  "Office Exp",
  "Travelling Exp",
  "Challan Sign exp",
  "Subcription(Donation)",
  "Pump Payment",
  "PRINTING & STATIONARY",
  "Loading advance",
  "Tonage",
  "Freight Billing",
  "Bill & Unbilled"
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

const getFYOptions = () => {
  const currentYear = new Date().getFullYear();
  return [
    `${currentYear - 2}-${(currentYear - 1).toString().slice(-2)}`,
    `${currentYear - 1}-${(currentYear).toString().slice(-2)}`,
    `${currentYear}-${(currentYear + 1).toString().slice(-2)}`,
    `${currentYear + 1}-${(currentYear + 2).toString().slice(-2)}`
  ];
};

const getDaysInMonth = (fyStr, monthName) => {
  if (!fyStr || !monthName) return 31;
  const parts = fyStr.split('-');
  const startYear = parseInt(parts[0], 10);
  const endYear = startYear + 1;
  const monthIndex = MONTHS.indexOf(monthName);
  const targetYear = monthIndex >= 3 ? startYear : endYear;
  return new Date(targetYear, monthIndex + 1, 0).getDate();
};

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val || 0);
};

const GlassBox = ({ children, sx = {}, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      background: 'rgba(20, 24, 28, 0.4)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '8px',
      ...sx
    }}
  >
    {children}
  </Box>
);

const PieChartDashboard = ({ onBack }) => {
  const [activeSubTab, setActiveSubTab] = useState('barGraph');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLedger, setSelectedLedger] = useState('Freight Payment');
  
  const defaultFY = getFYOptions()[2];
  const defaultMonth = MONTHS[new Date().getMonth()];

  const [leftFilters, setLeftFilters] = useState({
    period: 'MONTHLY',
    financialYear: defaultFY,
    month: defaultMonth,
    date: 'ALL'
  });

  const [rightFilters, setRightFilters] = useState({
    period: 'MONTHLY',
    financialYear: defaultFY,
    month: defaultMonth === 'January' ? 'December' : MONTHS[MONTHS.indexOf(defaultMonth) - 1],
    date: 'ALL'
  });

  const [leftData, setLeftData] = useState(null);
  const [rightData, setRightData] = useState(null);
  
  const [loadingLeft, setLoadingLeft] = useState(false);
  const [loadingRight, setLoadingRight] = useState(false);

  // Drill-down Modal State
  const [sliceModalOpen, setSliceModalOpen] = useState(false);
  const [activeSliceInfo, setActiveSliceInfo] = useState(null);

  // Active side view toggle for bottom transaction table (LEFT or RIGHT)
  const [activeTableSide, setActiveTableSide] = useState('LEFT');
  const [tableSearch, setTableSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filteredLedgers = LEDGER_NAMES.filter(name => 
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchSideData = async (filters, setLoader, setData) => {
    setLoader(true);
    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await axios.get(`${backendUrl}/pie-chart`, {
        params: {
          ledger: selectedLedger,
          ...filters
        }
      });
      setData(res.data);
    } catch (err) {
      console.error(err);
      setData(null);
    } finally {
      setLoader(false);
    }
  };

  const applyFilters = () => {
    fetchSideData(leftFilters, setLoadingLeft, setLeftData);
    fetchSideData(rightFilters, setLoadingRight, setRightData);
  };

  useEffect(() => {
    applyFilters();

    // Socket real-time push subscription
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    const autoRefresh = () => applyFilters();

    socket.on('accountDetailsUpdate', autoRefresh);
    socket.on('cementUpdates', autoRefresh);
    socket.on('partyPaymentUpdate', autoRefresh);
    socket.on('mainCashbookUpdates', autoRefresh);
    socket.on('pumpPaymentRegisterUpdate', autoRefresh);

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line
  }, [selectedLedger]);

  const leftTotal = leftData?.currentData?.totalAmount || 0;
  const rightTotal = rightData?.currentData?.totalAmount || 0;
  const difference = leftTotal - rightTotal;
  
  let percentChangeStr = "N/A";
  if (rightTotal > 0) {
    const pc = ((difference / rightTotal) * 100).toFixed(2);
    percentChangeStr = `${pc > 0 ? '+' : ''}${pc}%`;
  }

  const selectStyle = {
    color: '#FFF', 
    bgcolor: 'rgba(255,255,255,0.03)', 
    fontSize: '0.85rem',
    '& .MuiOutlinedInput-notchedOutline': { border: '1px solid rgba(255,255,255,0.1)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { border: '1px solid rgba(255,255,255,0.2)' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: '1px solid #8b5cf6' },
    height: '38px'
  };

  const renderFilterRow = (label, filters, setFilters, isRight) => {
    const daysInMonth = getDaysInMonth(filters.financialYear, filters.month);
    const dateOptions = ['ALL', ...Array.from({length: daysInMonth}, (_, i) => String(i + 1).padStart(2, '0'))];

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: isRight ? 0 : 2 }}>
        <Typography variant="caption" color={isRight ? '#8b5cf6' : '#10b981'} fontWeight={700} sx={{ width: '50px' }}>
          {label}
        </Typography>
        
        <Box sx={{ flex: 1, display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            {(!isRight) && <Typography variant="caption" color="#AAB4C0" sx={{ mb: 0.5, display: 'block', fontSize: '0.65rem' }}>FINANCIAL YEAR</Typography>}
            <Select fullWidth value={filters.financialYear} onChange={(e) => setFilters({...filters, financialYear: e.target.value})} size="small" sx={selectStyle}>
              {getFYOptions().map(fy => <MenuItem key={fy} value={fy}>{fy}</MenuItem>)}
            </Select>
          </Box>
          <Box sx={{ flex: 1 }}>
            {(!isRight) && <Typography variant="caption" color="#AAB4C0" sx={{ mb: 0.5, display: 'block', fontSize: '0.65rem' }}>PERIOD TYPE</Typography>}
            <Select fullWidth value={filters.period} onChange={(e) => setFilters({...filters, period: e.target.value})} size="small" sx={selectStyle}>
              <MenuItem value="TODAY">TODAY</MenuItem>
              <MenuItem value="MONTHLY">MONTHLY</MenuItem>
              <MenuItem value="YEARLY">YEARLY</MenuItem>
            </Select>
          </Box>
          <Box sx={{ flex: 1, opacity: filters.period === 'MONTHLY' ? 1 : 0.3, pointerEvents: filters.period === 'MONTHLY' ? 'auto' : 'none' }}>
            {(!isRight) && <Typography variant="caption" color="#AAB4C0" sx={{ mb: 0.5, display: 'block', fontSize: '0.65rem' }}>MONTH</Typography>}
            <Select fullWidth value={filters.month} onChange={(e) => {
                  const newMonth = e.target.value;
                  const newDays = getDaysInMonth(filters.financialYear, newMonth);
                  let newDate = filters.date;
                  if (newDate !== 'ALL' && parseInt(newDate, 10) > newDays) newDate = 'ALL';
                  setFilters({...filters, month: newMonth, date: newDate});
                }} size="small" sx={selectStyle}>
              {MONTHS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </Select>
          </Box>
          <Box sx={{ flex: 1, opacity: filters.period === 'MONTHLY' ? 1 : 0.3, pointerEvents: filters.period === 'MONTHLY' ? 'auto' : 'none' }}>
            {(!isRight) && <Typography variant="caption" color="#AAB4C0" sx={{ mb: 0.5, display: 'block', fontSize: '0.65rem' }}>DATE</Typography>}
            <Select fullWidth value={filters.date} onChange={(e) => setFilters({...filters, date: e.target.value})} size="small" sx={selectStyle}>
              {dateOptions.map(d => <MenuItem key={d} value={d}>{d === 'ALL' ? `All (1-${daysInMonth})` : d}</MenuItem>)}
            </Select>
          </Box>
        </Box>
      </Box>
    );
  };

  // Slice click handler for drill-down modal
  const handleSliceClick = (sliceEntry, isRightSide = false) => {
    const sideData = isRightSide ? rightData : leftData;
    const records = sideData?.currentData?.records || [];

    const matchingRecords = records.filter(r => {
      if (selectedLedger.toLowerCase() === 'bill & unbilled') {
        return r.category === sliceEntry.name;
      }
      return r.category === sliceEntry.name || moment(r.isoDate).format('D MMM YYYY') === sliceEntry.name || MONTHS[moment(r.isoDate).month()] === sliceEntry.name;
    });

    const sumRecords = matchingRecords.reduce((s, r) => s + r.amount, 0);

    setActiveSliceInfo({
      sideLabel: isRightSide ? 'RIGHT ANALYSIS' : 'LEFT ANALYSIS',
      sliceName: sliceEntry.name,
      sliceAmount: sliceEntry.value,
      matchingRecords,
      sumRecords
    });
    setSliceModalOpen(true);
  };

  // Active records for bottom transaction table
  const activeRecords = useMemo(() => {
    const sideData = activeTableSide === 'RIGHT' ? rightData : leftData;
    return sideData?.currentData?.records || [];
  }, [activeTableSide, leftData, rightData]);

  const filteredTableRecords = useMemo(() => {
    if (!tableSearch.trim()) return activeRecords;
    const q = tableSearch.toLowerCase();
    return activeRecords.filter(r => 
      String(r.slNo || '').toLowerCase().includes(q) ||
      String(r.date || '').toLowerCase().includes(q) ||
      String(r.name || '').toLowerCase().includes(q) ||
      String(r.vehicle || '').toLowerCase().includes(q) ||
      String(r.reference || '').toLowerCase().includes(q) ||
      String(r.site || '').toLowerCase().includes(q) ||
      String(r.party || '').toLowerCase().includes(q) ||
      String(r.source || '').toLowerCase().includes(q) ||
      String(r.amount || '').toLowerCase().includes(q)
    );
  }, [activeRecords, tableSearch]);

  const handleExportAll = () => {
    const recordsToExport = activeRecords.map(r => ({
      'SL NO': r.slNo,
      'DATE': r.date,
      'NAME / PARTICULAR': r.name,
      'VEHICLE NO': r.vehicle,
      'AMOUNT': r.amount,
      'REFERENCE / BILL NO': r.reference,
      'SITE': r.site,
      'PARTY NAME': r.party,
      'SOURCE': r.source
    }));

    exportToCsv(`Financial_Analytics_${selectedLedger.replace(/[^a-zA-Z0-9]/g, '_')}_${activeTableSide}.xls`, recordsToExport);
  };

  const currentSummary = (activeTableSide === 'RIGHT' ? rightData : leftData)?.currentData?.summary || {};

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh', color: '#F5F7FA', bgcolor: '#111315' }}>
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={onBack} sx={{ mr: 2, color: '#AAB4C0', bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              FINANCIAL ANALYTICS & BAR GHAPH
            </Typography>
            <Typography variant="caption" color="#AAB4C0">
              Real-time multi-source financial control and verification system
            </Typography>
          </Box>
        </Box>
        {activeSubTab === 'barGraph' && (
          <Button 
            variant="outlined" 
            startIcon={<IosShareIcon fontSize="small" />}
            onClick={handleExportAll}
            sx={{ color: '#FFF', borderColor: 'rgba(255,255,255,0.2)', textTransform: 'none', fontSize: '0.8rem', px: 2, '&:hover': { borderColor: '#FFF', bgcolor: 'rgba(255,255,255,0.05)' } }}
          >
            Export Report
          </Button>
        )}
      </Box>

      {/* 3 SUB-TABS */}
      <Box sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', mb: 3 }}>
        <Tabs
          value={activeSubTab}
          onChange={(e, val) => setActiveSubTab(val)}
          textColor="inherit"
          sx={{
            minHeight: 44,
            '& .MuiTabs-indicator': {
              backgroundColor: '#8b5cf6',
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
            '& .MuiTab-root': {
              color: '#94a3b8',
              fontWeight: 600,
              fontSize: '0.85rem',
              textTransform: 'none',
              py: 1,
              px: 2.5,
              minHeight: 44,
              letterSpacing: '0.2px',
              transition: 'all 0.2s ease',
              '&.Mui-selected': {
                color: '#ffffff',
                fontWeight: 700,
              },
              '&:hover': {
                color: '#e2e8f0',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
              }
            }
          }}
        >
          <Tab label="Volume(Tonnage) Growth VS Revenue Growth" value="volumeTonnage" />
          <Tab label="PTPK Analysis" value="ptpkAnalysis" />
          <Tab label="Bar Graph" value="barGraph" />
        </Tabs>
      </Box>

      {/* TAB 1 — Volume(Tonnage) Growth VS Revenue Growth */}
      {activeSubTab === 'volumeTonnage' && (
        <VolumeVsRevenueGrowthTab />
      )}

      {/* TAB 2 — PTPK Analysis (EMPTY / NULL STATE) */}
      {activeSubTab === 'ptpkAnalysis' && (
        <Box sx={{
          p: 8,
          minHeight: '65vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '12px',
          border: '1px dashed rgba(255, 255, 255, 0.1)',
          bgcolor: 'rgba(20, 24, 28, 0.3)',
        }} />
      )}

      {/* TAB 3 — Bar Graph (COMPLETE EXISTING FINANCIAL ANALYTICS PROCESS) */}
      {activeSubTab === 'barGraph' && (
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
        
        {/* LEFT SIDEBAR - LEDGER LIST */}
        <Box sx={{ width: { xs: '100%', md: '250px', lg: '280px' }, flexShrink: 0 }}>
          <GlassBox sx={{ p: 2, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, color: '#FFF' }}>Ledgers</Typography>
            <Box sx={{ position: 'relative', mb: 2 }}>
              <SearchIcon sx={{ position: 'absolute', top: 10, left: 12, color: '#AAB4C0', fontSize: '1rem' }} />
              <TextField 
                fullWidth
                variant="outlined"
                placeholder="Search ledger..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '6px', color: '#FFF', '& fieldset': { border: '1px solid rgba(255,255,255,0.1)' } },
                  '& input': { py: 1, pl: 4.5, fontSize: '0.8rem' }
                }}
              />
            </Box>
            <Box sx={{ flex: 1, overflowY: 'auto', pr: 1, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: '4px' } }}>
              {filteredLedgers.map((ledger) => (
                <Box
                  key={ledger}
                  onClick={() => setSelectedLedger(ledger)}
                  sx={{
                    py: 1, px: 1.5, mb: 0.5, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    bgcolor: selectedLedger === ledger ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: selectedLedger === ledger ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                    color: selectedLedger === ledger ? '#60a5fa' : '#AAB4C0',
                    transition: 'all 0.2s ease',
                    '&:hover': { bgcolor: selectedLedger === ledger ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)', color: '#FFF' }
                  }}
                >
                  <ReceiptLongIcon sx={{ fontSize: '1rem', mr: 1, opacity: selectedLedger === ledger ? 1 : 0.7 }} />
                  <Typography variant="body2" fontWeight={selectedLedger === ledger ? 600 : 400} sx={{ fontSize: '0.75rem' }}>
                    {ledger}
                  </Typography>
                </Box>
              ))}
            </Box>
          </GlassBox>
        </Box>

        {/* MAIN AREA */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflowX: 'hidden' }}>
          
          {/* TOP BAR: FILTERS */}
          <GlassBox sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: '250px' }}>
              <Typography variant="subtitle2" fontWeight={800}>DATA ANALYSIS</Typography>
              <Typography variant="caption" color="#AAB4C0" sx={{ fontSize: '0.65rem' }}>Select financial year, month and date to analyze and compare</Typography>
            </Box>
            <Box sx={{ flex: 1, px: 2 }}>
              {renderFilterRow('LEFT', leftFilters, setLeftFilters, false)}
              {renderFilterRow('RIGHT', rightFilters, setRightFilters, true)}
            </Box>
            <Box sx={{ pl: 2, borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
              <Button 
                variant="contained" 
                onClick={applyFilters}
                startIcon={<FilterAltIcon fontSize="small"/>}
                sx={{ 
                  bgcolor: '#5a45cf', color: '#FFF', fontWeight: 600, borderRadius: '6px', fontSize: '0.8rem', py: 1, px: 3,
                  '&:hover': { bgcolor: '#4c39b8' },
                  boxShadow: '0 4px 14px rgba(90, 69, 207, 0.4)'
                }}
              >
                Apply Filters
              </Button>
            </Box>
          </GlassBox>

          {/* TWO PIE CHARTS */}
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', xl: 'row' }, minHeight: '350px' }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <GlassBox sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={800}>LEFT ANALYSIS</Typography>
                    <Typography variant="caption" color="#AAB4C0">{leftFilters.month} {leftFilters.financialYear}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="#10b981" fontWeight={700}>Total: {formatCurrency(leftTotal)}</Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1, position: 'relative', minHeight: 300 }}>
                  {loadingLeft && (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                      <CircularProgress sx={{ color: '#10b981' }} size={30} />
                    </Box>
                  )}
                  <DynamicPieChart 
                    data={leftData?.currentData?.pieData || []} 
                    ledgerName={selectedLedger} 
                    palette="cool" 
                    totalAmount={leftTotal} 
                    onSliceClick={(entry) => handleSliceClick(entry, false)}
                  />
                </Box>
              </GlassBox>
            </Box>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <GlassBox sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={800}>RIGHT ANALYSIS</Typography>
                    <Typography variant="caption" color="#AAB4C0">{rightFilters.month} {rightFilters.financialYear}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="#3b82f6" fontWeight={700}>Total: {formatCurrency(rightTotal)}</Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1, position: 'relative', minHeight: 300 }}>
                  {loadingRight && (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                      <CircularProgress sx={{ color: '#3b82f6' }} size={30} />
                    </Box>
                  )}
                  <DynamicPieChart 
                    data={rightData?.currentData?.pieData || []} 
                    ledgerName={selectedLedger} 
                    palette="warm" 
                    totalAmount={rightTotal}
                    onSliceClick={(entry) => handleSliceClick(entry, true)}
                  />
                </Box>
              </GlassBox>
            </Box>
          </Box>

          {/* BOTTOM COMPARISON SUMMARY */}
          <GlassBox sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="subtitle2" fontWeight={800}>COMPARISON SUMMARY</Typography>
              <Typography variant="caption" color="#AAB4C0">{leftFilters.month} vs {rightFilters.month}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <Box>
              <Typography variant="caption" color="#AAB4C0" display="block">LEFT TOTAL</Typography>
              <Typography variant="body1" fontWeight={700} color="#10b981">{formatCurrency(leftTotal)}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <Box>
              <Typography variant="caption" color="#AAB4C0" display="block">RIGHT TOTAL</Typography>
              <Typography variant="body1" fontWeight={700} color="#3b82f6">{formatCurrency(rightTotal)}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: difference > 0 ? 'rgba(16, 185, 129, 0.2)' : difference < 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: difference > 0 ? '#10b981' : difference < 0 ? '#ef4444' : '#FFF' }}>
                {difference > 0 ? <TrendingUpIcon fontSize="small"/> : difference < 0 ? <TrendingDownIcon fontSize="small"/> : <RemoveIcon fontSize="small"/>}
              </Box>
              <Box>
                <Typography variant="caption" color="#AAB4C0" display="block">DIFFERENCE</Typography>
                <Typography variant="body1" fontWeight={700} color={difference > 0 ? '#10b981' : difference < 0 ? '#ef4444' : '#FFF'}>{formatCurrency(difference)}</Typography>
              </Box>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: difference > 0 ? 'rgba(16, 185, 129, 0.2)' : difference < 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: difference > 0 ? '#10b981' : difference < 0 ? '#ef4444' : '#FFF' }}>
                <PercentIcon fontSize="small"/>
              </Box>
              <Box>
                <Typography variant="caption" color="#AAB4C0" display="block">PERCENTAGE CHANGE</Typography>
                <Typography variant="body1" fontWeight={700} color={difference > 0 ? '#10b981' : difference < 0 ? '#ef4444' : '#FFF'}>{percentChangeStr}</Typography>
              </Box>
            </Box>
          </GlassBox>

          {/* DETAILED ANALYSIS SUMMARY CARDS SECTION (Requirement 26) */}
          <GlassBox sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={800} color="#FFF" sx={{ mb: 2 }}>
              ANALYSIS SUMMARY — {selectedLedger.toUpperCase()}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography variant="caption" color="#AAB4C0" display="block">Total Amount</Typography>
                  <Typography variant="body1" fontWeight={700} color="#10b981">{formatCurrency(currentSummary.totalAmount)}</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography variant="caption" color="#AAB4C0" display="block">Total Transactions</Typography>
                  <Typography variant="body1" fontWeight={700} color="#60a5fa">{currentSummary.transactionCount || 0}</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography variant="caption" color="#AAB4C0" display="block">Average Transaction</Typography>
                  <Typography variant="body1" fontWeight={700} color="#f59e0b">{formatCurrency(currentSummary.avgTransaction)}</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography variant="caption" color="#AAB4C0" display="block">Highest Transaction</Typography>
                  <Typography variant="body1" fontWeight={700} color="#a855f7">{formatCurrency(currentSummary.highestTransaction)}</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography variant="caption" color="#AAB4C0" display="block">Lowest Transaction</Typography>
                  <Typography variant="body1" fontWeight={700} color="#ec4899">{formatCurrency(currentSummary.lowestTransaction)}</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography variant="caption" color="#AAB4C0" display="block">Active Days Count</Typography>
                  <Typography variant="body1" fontWeight={700} color="#06b6d4">{currentSummary.activeDaysCount || 0} Days</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography variant="caption" color="#AAB4C0" display="block">Busiest Date</Typography>
                  <Typography variant="body1" fontWeight={700} color="#34d399">{currentSummary.busiestDate || 'N/A'}</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography variant="caption" color="#AAB4C0" display="block">Highest Spending Date</Typography>
                  <Typography variant="body1" fontWeight={700} color="#fbbf24">{currentSummary.highestSpendingDate || 'N/A'}</Typography>
                </Box>
              </Grid>
            </Grid>
          </GlassBox>

          {/* SOURCE TRANSACTION TABLE SECTION (Requirement 27) */}
          <GlassBox sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle1" fontWeight={800} color="#FFF">
                  TRANSACTION DETAILS
                </Typography>
                <Box sx={{ display: 'flex', bgcolor: 'rgba(0,0,0,0.3)', p: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Button
                    size="small"
                    onClick={() => setActiveTableSide('LEFT')}
                    sx={{
                      px: 2, py: 0.3, fontSize: '0.75rem', fontWeight: 700, borderRadius: '4px',
                      bgcolor: activeTableSide === 'LEFT' ? '#10b981' : 'transparent',
                      color: activeTableSide === 'LEFT' ? '#FFF' : '#AAB4C0'
                    }}
                  >
                    LEFT VIEW
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setActiveTableSide('RIGHT')}
                    sx={{
                      px: 2, py: 0.3, fontSize: '0.75rem', fontWeight: 700, borderRadius: '4px',
                      bgcolor: activeTableSide === 'RIGHT' ? '#3b82f6' : 'transparent',
                      color: activeTableSide === 'RIGHT' ? '#FFF' : '#AAB4C0'
                    }}
                  >
                    RIGHT VIEW
                  </Button>
                </Box>
                <Chip label={`${filteredTableRecords.length} Records`} sx={{ bgcolor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', fontWeight: 800 }} />
              </Box>

              <TextField
                placeholder="Search transactions..."
                size="small"
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                sx={{
                  width: '260px',
                  '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.3)', borderRadius: '6px', color: '#FFF', '& fieldset': { border: '1px solid rgba(255,255,255,0.1)' } },
                  '& input': { py: 0.8, fontSize: '0.8rem' }
                }}
              />
            </Box>

            <TableContainer sx={{ maxHeight: 400, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800, whiteSpace: 'nowrap' }}>SL NO</TableCell>
                    <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800, whiteSpace: 'nowrap' }}>DATE</TableCell>
                    <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800, whiteSpace: 'nowrap' }}>NAME / PARTICULAR</TableCell>
                    <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800, whiteSpace: 'nowrap' }}>VEHICLE NO</TableCell>
                    <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800, whiteSpace: 'nowrap' }}>AMOUNT</TableCell>
                    <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800, whiteSpace: 'nowrap' }}>REFERENCE / BILL NO</TableCell>
                    <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800, whiteSpace: 'nowrap' }}>SITE</TableCell>
                    <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800, whiteSpace: 'nowrap' }}>PARTY NAME</TableCell>
                    <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800, whiteSpace: 'nowrap' }}>SOURCE</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTableRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 4, color: '#7F8A96', borderBottom: 'none' }}>
                        No transaction records match the current filter or search criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTableRecords.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((r, idx) => (
                      <TableRow key={r.id || idx} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                        <TableCell sx={{ color: '#AAB4C0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.slNo}</TableCell>
                        <TableCell sx={{ color: '#FFF', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{r.date}</TableCell>
                        <TableCell sx={{ color: '#FFF', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.name}</TableCell>
                        <TableCell sx={{ color: '#60a5fa', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{r.vehicle}</TableCell>
                        <TableCell sx={{ color: '#10b981', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{formatCurrency(r.amount)}</TableCell>
                        <TableCell sx={{ color: '#AAB4C0', borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{r.reference}</TableCell>
                        <TableCell sx={{ color: '#AAB4C0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.site}</TableCell>
                        <TableCell sx={{ color: '#AAB4C0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.party}</TableCell>
                        <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <Chip size="small" label={r.source} sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#AAB4C0', fontSize: '0.65rem', fontWeight: 700 }} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredTableRecords.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              sx={{ color: '#AAB4C0', borderTop: '1px solid rgba(255,255,255,0.08)' }}
            />
          </GlassBox>

        </Box>
      </Box>
      )}

      {/* PIE CHART SLICE DRILL-DOWN MODAL (Requirement 15) */}
      <Dialog
        open={sliceModalOpen}
        onClose={() => setSliceModalOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#111315',
            color: '#F5F7FA',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', pb: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight={800} color="#FFF">
                DETAIL ANALYSIS — {selectedLedger.toUpperCase()}
              </Typography>
              <Typography variant="caption" color="#AAB4C0">
                {activeSliceInfo?.sideLabel} | Category / Date: <strong>{activeSliceInfo?.sliceName}</strong>
              </Typography>
            </Box>
            <Box textAlig="right">
              <Chip
                icon={<CheckCircleOutlineIcon sx={{ color: '#10b981 !important' }} />}
                label={`SUM OF RECORDS (${formatCurrency(activeSliceInfo?.sumRecords)}) = SLICE TOTAL (${formatCurrency(activeSliceInfo?.sliceAmount)})`}
                sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 800, border: '1px solid rgba(16, 185, 129, 0.3)' }}
              />
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600 }}>
            Every individual transaction contributing to this pie chart segment is listed below. All numbers are verified directly from source database records.
          </Alert>

          <TableContainer sx={{ maxHeight: 450, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800 }}>SL NO</TableCell>
                  <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800 }}>DATE</TableCell>
                  <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800 }}>NAME / PARTICULAR</TableCell>
                  <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800 }}>VEHICLE NO</TableCell>
                  <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800 }}>AMOUNT</TableCell>
                  <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800 }}>REFERENCE / BILL NO</TableCell>
                  <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800 }}>SITE</TableCell>
                  <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800 }}>PARTY NAME</TableCell>
                  <TableCell sx={{ bgcolor: '#1a1d21', color: '#AAB4C0', fontWeight: 800 }}>SOURCE</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(!activeSliceInfo?.matchingRecords || activeSliceInfo.matchingRecords.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4, color: '#7F8A96' }}>
                      No individual transactions found for this slice.
                    </TableCell>
                  </TableRow>
                ) : (
                  activeSliceInfo.matchingRecords.map((r, idx) => (
                    <TableRow key={r.id || idx} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
                      <TableCell sx={{ color: '#AAB4C0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.slNo}</TableCell>
                      <TableCell sx={{ color: '#FFF', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{r.date}</TableCell>
                      <TableCell sx={{ color: '#FFF', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.name}</TableCell>
                      <TableCell sx={{ color: '#60a5fa', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{r.vehicle}</TableCell>
                      <TableCell sx={{ color: '#10b981', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{formatCurrency(r.amount)}</TableCell>
                      <TableCell sx={{ color: '#AAB4C0', borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{r.reference}</TableCell>
                      <TableCell sx={{ color: '#AAB4C0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.site}</TableCell>
                      <TableCell sx={{ color: '#AAB4C0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.party}</TableCell>
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <Chip size="small" label={r.source} sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#AAB4C0', fontSize: '0.65rem', fontWeight: 700 }} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Button
            onClick={() => setSliceModalOpen(false)}
            variant="contained"
            sx={{ bgcolor: '#3b82f6', color: '#FFF', fontWeight: 700, borderRadius: '8px', px: 3, '&:hover': { bgcolor: '#2563eb' } }}
          >
            Close Detail Analysis
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PieChartDashboard;
