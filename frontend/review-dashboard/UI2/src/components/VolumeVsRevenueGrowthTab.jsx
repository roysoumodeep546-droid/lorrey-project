import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Grid, Select, MenuItem, TextField, CircularProgress,
  Button, TableContainer, Table, TableHead, TableRow, TableCell,
  TableBody, Chip, Alert, Card, CardContent, Divider, Stack
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SpeedIcon from '@mui/icons-material/Speed';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_IO_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MONTHS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March"
];

const FY_OPTIONS = [
  "FY 2026-27",
  "FY 2025-26",
  "FY 2024-25",
  "FY 2023-24",
  "FY 2022-23",
  "FY 2021-22"
];

const formatCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val || 0);
};

const formatNumber = (val, decimals = 2) => {
  if (val === null || val === undefined || isNaN(val)) return '0.00';
  return Number(val).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

const formatPct = (val) => {
  if (val === null || val === undefined || isNaN(Number(val))) return 'N/A';
  const num = Number(val);
  const prefix = num > 0 ? '+' : '';
  return `${prefix}${num.toFixed(2)}%`;
};

const GlassCard = ({ children, sx = {}, onClick }) => (
  <Card
    onClick={onClick}
    sx={{
      background: 'rgba(20, 24, 28, 0.5)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      color: '#F5F7FA',
      ...sx
    }}
  >
    {children}
  </Card>
);

export default function VolumeVsRevenueGrowthTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Dynamic Today Date (YYYY-MM-DD)
  const todayIso = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  // Comparison Parameters State
  const [tyFY, setTyFY] = useState('FY 2026-27');
  const [pyFY, setPyFY] = useState('FY 2025-26');
  const [periodType, setPeriodType] = useState('MONTH'); // 'FULL_FY' | 'MONTH' | 'DATE'
  
  // Independent Month Selectors
  const [tyMonth, setTyMonth] = useState('September');
  const [pyMonth, setPyMonth] = useState('August');

  // Independent Date Selectors
  const [tyDate, setTyDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [pyDate, setPyDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  // Data Response
  const [data, setData] = useState(null);

  const fetchGrowthData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/pie-chart/growth-analysis`, {
        params: {
          tyFY,
          pyFY,
          periodType,
          tyMonth,
          pyMonth,
          tyDate,
          pyDate
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.data && res.data.success) {
        setData(res.data);
      } else {
        setError(res.data?.error || 'Failed to load growth analysis data');
      }
    } catch (err) {
      console.error('[GrowthAnalysis] Fetch Error:', err);
      setError(err.response?.data?.error || err.message || 'Error fetching growth analysis');
    } finally {
      setLoading(false);
    }
  }, [tyFY, pyFY, periodType, tyMonth, pyMonth, tyDate, pyDate]);

  useEffect(() => {
    fetchGrowthData();
  }, [fetchGrowthData]);

  // Real-time socket auto-update
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    const handleUpdate = () => {
      fetchGrowthData();
    };
    socket.on('cementUpdates', handleUpdate);
    socket.on('fyDetailsUpdates', handleUpdate);
    socket.on('billUpdates', handleUpdate);

    return () => {
      socket.off('cementUpdates', handleUpdate);
      socket.off('fyDetailsUpdates', handleUpdate);
      socket.off('billUpdates', handleUpdate);
      socket.disconnect();
    };
  }, [fetchGrowthData]);

  const ty = data?.ty || {};
  const py = data?.py || {};
  const comp = data?.comparison || {};

  const pyLabel = py.headerLabel || pyFY;
  const tyLabel = ty.headerLabel || tyFY;

  // Volume & Revenue Comparison Chart Data
  const volumeRevenueChartData = useMemo(() => {
    return [
      {
        metric: 'Tonnage (MT)',
        [pyLabel]: py.tonnage || 0,
        [tyLabel]: ty.tonnage || 0,
        unit: 'MT'
      },
      {
        metric: 'Revenue (₹ in Lakhs)',
        [pyLabel]: Math.round(((py.revenue || 0) / 100000) * 100) / 100,
        [tyLabel]: Math.round(((ty.revenue || 0) / 100000) * 100) / 100,
        unit: 'Lakhs'
      },
      {
        metric: 'Revenue / MT (₹)',
        [pyLabel]: py.revPerMt || 0,
        [tyLabel]: ty.revPerMt || 0,
        unit: '₹/MT'
      }
    ];
  }, [ty, py, tyLabel, pyLabel]);

  // Growth Rates Comparison Chart Data
  const growthRatesChartData = useMemo(() => {
    const isNum = (v) => v !== null && v !== undefined && !isNaN(Number(v));
    return [
      {
        name: 'Volume (Tonnage) Growth',
        growth: isNum(comp.volumeGrowthPct) ? Number(comp.volumeGrowthPct) : 0,
        color: (comp.volumeGrowthPct || 0) >= 0 ? '#38bdf8' : '#f43f5e',
        hasData: isNum(comp.volumeGrowthPct)
      },
      {
        name: 'Revenue Growth',
        growth: isNum(comp.revenueGrowthPct) ? Number(comp.revenueGrowthPct) : 0,
        color: (comp.revenueGrowthPct || 0) >= 0 ? '#10b981' : '#f43f5e',
        hasData: isNum(comp.revenueGrowthPct)
      },
      {
        name: 'Revenue / MT Growth',
        growth: isNum(comp.revPerMtGrowthPct) ? Number(comp.revPerMtGrowthPct) : 0,
        color: (comp.revPerMtGrowthPct || 0) >= 0 ? '#a855f7' : '#f43f5e',
        hasData: isNum(comp.revPerMtGrowthPct)
      }
    ];
  }, [comp]);

  const selectStyle = {
    color: '#FFF',
    fontSize: '0.85rem',
    bgcolor: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    '& .MuiSelect-select': { py: 1, px: 1.5 },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
    '& .MuiSvgIcon-root': { color: '#AAB4C0' }
  };

  return (
    <Box sx={{ width: '100%', pb: 6 }}>
      
      {/* ── TOP FILTER CONTROL PANEL (NO SITE FILTER) ─────────────────────── */}
      <GlassCard sx={{ p: 2.5, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterAltIcon sx={{ color: '#8b5cf6', fontSize: '1.25rem' }} />
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#FFF' }}>
              Comparative Analytics Parameters
            </Typography>
            <Chip
              size="small"
              label="Full Project Scope: Cement Register (Tonnage) + Bill Register (Revenue)"
              sx={{ bgcolor: 'rgba(139, 92, 246, 0.15)', color: '#c084fc', fontSize: '0.7rem', fontWeight: 600, border: '1px solid rgba(139, 92, 246, 0.3)' }}
            />
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon fontSize="small" />}
            onClick={fetchGrowthData}
            disabled={loading}
            sx={{
              color: '#FFF',
              borderColor: 'rgba(255,255,255,0.2)',
              textTransform: 'none',
              fontSize: '0.8rem',
              '&:hover': { borderColor: '#8b5cf6', bgcolor: 'rgba(139, 92, 246, 0.1)' }
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </Box>

        <Grid container spacing={2} alignItems="center">
          {/* Target Year (TY) Selector */}
          <Grid item xs={12} sm={6} md={periodType === 'FULL_FY' ? 4 : 2.4}>
            <Typography variant="caption" sx={{ color: '#AAB4C0', mb: 0.5, display: 'block', fontWeight: 600 }}>
              TARGET / CURRENT FY (TY)
            </Typography>
            <Select
              fullWidth
              value={tyFY}
              onChange={(e) => setTyFY(e.target.value)}
              sx={selectStyle}
            >
              {FY_OPTIONS.map(fy => (
                <MenuItem key={`ty-${fy}`} value={fy}>{fy}</MenuItem>
              ))}
            </Select>
          </Grid>

          {/* Comparison / Previous FY (PY) Selector */}
          <Grid item xs={12} sm={6} md={periodType === 'FULL_FY' ? 4 : 2.4}>
            <Typography variant="caption" sx={{ color: '#AAB4C0', mb: 0.5, display: 'block', fontWeight: 600 }}>
              COMPARISON / PREVIOUS FY (PY)
            </Typography>
            <Select
              fullWidth
              value={pyFY}
              onChange={(e) => setPyFY(e.target.value)}
              sx={selectStyle}
            >
              {FY_OPTIONS.map(fy => (
                <MenuItem key={`py-${fy}`} value={fy}>{fy}</MenuItem>
              ))}
            </Select>
          </Grid>

          {/* Period Type Selector */}
          <Grid item xs={12} sm={6} md={periodType === 'FULL_FY' ? 4 : 2.4}>
            <Typography variant="caption" sx={{ color: '#AAB4C0', mb: 0.5, display: 'block', fontWeight: 600 }}>
              PERIOD COMPARISON TYPE
            </Typography>
            <Select
              fullWidth
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              sx={selectStyle}
            >
              <MenuItem value="FULL_FY">FULL FY</MenuItem>
              <MenuItem value="MONTH">SPECIFIC MONTH</MenuItem>
              <MenuItem value="DATE">SPECIFIC DATE</MenuItem>
            </Select>
          </Grid>

          {/* Independent Month Selectors (When SPECIFIC MONTH) */}
          {periodType === 'MONTH' && (
            <>
              <Grid item xs={12} sm={6} md={2.4}>
                <Typography variant="caption" sx={{ color: '#38bdf8', mb: 0.5, display: 'block', fontWeight: 700 }}>
                  CURRENT FY MONTH
                </Typography>
                <Select
                  fullWidth
                  value={tyMonth}
                  onChange={(e) => setTyMonth(e.target.value)}
                  sx={selectStyle}
                >
                  {MONTHS.map(m => (
                    <MenuItem key={`ty-m-${m}`} value={m}>{m}</MenuItem>
                  ))}
                </Select>
              </Grid>

              <Grid item xs={12} sm={6} md={2.4}>
                <Typography variant="caption" sx={{ color: '#94a3b8', mb: 0.5, display: 'block', fontWeight: 700 }}>
                  PREVIOUS FY MONTH
                </Typography>
                <Select
                  fullWidth
                  value={pyMonth}
                  onChange={(e) => setPyMonth(e.target.value)}
                  sx={selectStyle}
                >
                  {MONTHS.map(m => (
                    <MenuItem key={`py-m-${m}`} value={m}>{m}</MenuItem>
                  ))}
                </Select>
              </Grid>
            </>
          )}

          {/* Independent Date Pickers (When SPECIFIC DATE) */}
          {periodType === 'DATE' && (
            <>
              <Grid item xs={12} sm={6} md={2.4}>
                <Typography variant="caption" sx={{ color: '#38bdf8', mb: 0.5, display: 'block', fontWeight: 700 }}>
                  CURRENT FY DATE
                </Typography>
                <TextField
                  fullWidth
                  type="date"
                  value={tyDate}
                  inputProps={{ max: todayIso }}
                  onChange={(e) => setTyDate(e.target.value)}
                  sx={{
                    '& .MuiInputBase-root': { color: '#FFF', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.85rem' },
                    '& .MuiOutlinedInput-input': { py: 1, px: 1.5 },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <Typography variant="caption" sx={{ color: '#94a3b8', mb: 0.5, display: 'block', fontWeight: 700 }}>
                  PREVIOUS FY DATE
                </Typography>
                <TextField
                  fullWidth
                  type="date"
                  value={pyDate}
                  onChange={(e) => setPyDate(e.target.value)}
                  sx={{
                    '& .MuiInputBase-root': { color: '#FFF', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.85rem' },
                    '& .MuiOutlinedInput-input': { py: 1, px: 1.5 },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' }
                  }}
                />
              </Grid>
            </>
          )}
        </Grid>
      </GlassCard>

      {/* ── COMPARISON HEADING ──────────────────────────────────────────────── */}
      {data?.comparisonHeading && (
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Chip
            label={data.comparisonHeading}
            sx={{
              bgcolor: 'rgba(139, 92, 246, 0.12)',
              color: '#c084fc',
              fontSize: '1rem',
              fontWeight: 800,
              py: 2.2,
              px: 2,
              borderRadius: '12px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              letterSpacing: '1px'
            }}
          />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3, bgcolor: 'rgba(244,63,94,0.15)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)' }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '45vh', gap: 2 }}>
          <CircularProgress sx={{ color: '#8b5cf6' }} />
          <Typography variant="body2" sx={{ color: '#AAB4C0' }}>
            Aggregating Full Project Cement Register Tonnage and Bill Register Revenue...
          </Typography>
        </Box>
      ) : (
        <>
          {/* ── TWO-SIDE COMPARISON CARDS & GROWTH SUMMARY ────────────────────── */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            
            {/* LEFT CARD: TARGET / CURRENT PERIOD */}
            <Grid item xs={12} md={4}>
              <GlassCard sx={{ p: 2.5, height: '100%', borderTop: '3px solid #38bdf8' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      TARGET / CURRENT PERIOD
                    </Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#FFF' }}>
                      {ty.headerLabel || ty.financialYear || tyFY}
                    </Typography>
                  </Box>
                  <Chip size="small" label={ty.periodDisplay || '-'} sx={{ bgcolor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 600, fontSize: '0.7rem' }} />
                </Box>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#AAB4C0', display: 'block' }}>TOTAL TONNAGE</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#38bdf8' }}>
                      {formatNumber(ty.tonnage)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#AAB4C0' }}>MT</span>
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                      Full Project (Cement Register)
                    </Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#AAB4C0', display: 'block' }}>TOTAL REVENUE</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#10b981' }}>
                      {formatCurrency(ty.revenue)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                      Full Project (Bill Register)
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', p: 1.5, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#AAB4C0', display: 'block' }}>REVENUE PER MT</Typography>
                        <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#c084fc' }}>
                          {ty.tonnage > 0 ? `₹${formatNumber(ty.revPerMt)}` : 'N/A'} <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#AAB4C0' }}>{ty.tonnage > 0 ? '/ MT' : ''}</span>
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" sx={{ color: '#AAB4C0', display: 'block' }}>TRIPS / BILLS</Typography>
                        <Typography variant="caption" fontWeight={700} sx={{ color: '#FFF' }}>
                          {ty.tripCount || 0} Trips • {ty.billCount || 0} Bills
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </GlassCard>
            </Grid>

            {/* MIDDLE CARD: COMPARATIVE GROWTH & DISPROPORTION GAP */}
            <Grid item xs={12} md={4}>
              <GlassCard sx={{ p: 2.5, height: '100%', borderTop: '3px solid #8b5cf6', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="caption" sx={{ color: '#c084fc', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      GROWTH & DISPROPORTION ANALYSIS
                    </Typography>
                    <CompareArrowsIcon sx={{ color: '#c084fc', fontSize: '1.25rem' }} />
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

                  <Stack spacing={1.5}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'rgba(56, 189, 248, 0.08)', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                      <Typography variant="body2" sx={{ color: '#38bdf8', fontWeight: 600 }}>Volume (Tonnage) Growth</Typography>
                      <Typography variant="subtitle2" fontWeight={800} sx={{ color: comp.volumeGrowthPct >= 0 ? '#38bdf8' : '#f43f5e' }}>
                        {formatPct(comp.volumeGrowthPct)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'rgba(16, 185, 129, 0.08)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 600 }}>Revenue Growth</Typography>
                      <Typography variant="subtitle2" fontWeight={800} sx={{ color: comp.revenueGrowthPct >= 0 ? '#10b981' : '#f43f5e' }}>
                        {formatPct(comp.revenueGrowthPct)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'rgba(168, 85, 247, 0.08)', borderRadius: '6px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                      <Typography variant="body2" sx={{ color: '#c084fc', fontWeight: 600 }}>Revenue / MT Realization Growth</Typography>
                      <Typography variant="subtitle2" fontWeight={800} sx={{ color: comp.revPerMtGrowthPct >= 0 ? '#c084fc' : '#f43f5e' }}>
                        {formatPct(comp.revPerMtGrowthPct)}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                {/* Growth Difference / Disproportion Banner */}
                <Box sx={{ mt: 2, p: 1.5, borderRadius: '8px', bgcolor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#AAB4C0', display: 'block', fontWeight: 600 }}>
                      GROWTH GAP (REVENUE % - VOLUME %)
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={900} sx={{ color: (comp?.growthGap || 0) > 0 ? '#10b981' : (comp?.growthGap || 0) < 0 ? '#f59e0b' : '#38bdf8' }}>
                      {comp?.growthGap !== null && comp?.growthGap !== undefined && !isNaN(Number(comp?.growthGap))
                        ? `${Number(comp.growthGap) > 0 ? '+' : ''}${Number(comp.growthGap).toFixed(2)} pp`
                        : 'N/A'}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={(comp?.growthGap || 0) > 0 ? 'Revenue Outpacing Volume' : (comp?.growthGap || 0) < 0 ? 'Volume Outpacing Revenue' : 'Proportionate'}
                    sx={{
                      bgcolor: (comp?.growthGap || 0) > 0 ? 'rgba(16, 185, 129, 0.15)' : (comp?.growthGap || 0) < 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                      color: (comp?.growthGap || 0) > 0 ? '#10b981' : (comp?.growthGap || 0) < 0 ? '#f59e0b' : '#38bdf8',
                      fontWeight: 700,
                      fontSize: '0.7rem'
                    }}
                  />
                </Box>
              </GlassCard>
            </Grid>

            {/* RIGHT CARD: COMPARISON / PREVIOUS PERIOD */}
            <Grid item xs={12} md={4}>
              <GlassCard sx={{ p: 2.5, height: '100%', borderTop: '3px solid #94a3b8' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      COMPARISON / PREVIOUS PERIOD
                    </Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#FFF' }}>
                      {py.headerLabel || py.financialYear || pyFY}
                    </Typography>
                  </Box>
                  <Chip size="small" label={py.periodDisplay || '-'} sx={{ bgcolor: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', fontWeight: 600, fontSize: '0.7rem' }} />
                </Box>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#AAB4C0', display: 'block' }}>TOTAL TONNAGE</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#94a3b8' }}>
                      {formatNumber(py.tonnage)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#AAB4C0' }}>MT</span>
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                      Full Project (Cement Register)
                    </Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#AAB4C0', display: 'block' }}>TOTAL REVENUE</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#10b981' }}>
                      {formatCurrency(py.revenue)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                      Full Project (Bill Register)
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', p: 1.5, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#AAB4C0', display: 'block' }}>REVENUE PER MT</Typography>
                        <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#c084fc' }}>
                          {py.tonnage > 0 ? `₹${formatNumber(py.revPerMt)}` : 'N/A'} <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#AAB4C0' }}>{py.tonnage > 0 ? '/ MT' : ''}</span>
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" sx={{ color: '#AAB4C0', display: 'block' }}>TRIPS / BILLS</Typography>
                        <Typography variant="caption" fontWeight={700} sx={{ color: '#FFF' }}>
                          {py.tripCount || 0} Trips • {py.billCount || 0} Bills
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </GlassCard>
            </Grid>
          </Grid>

          {/* ── BAR GRAPH VISUALIZATION SECTION ───────────────────────────────── */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            
            {/* BAR GRAPH 1: Volume & Revenue Grouped Comparison */}
            <Grid item xs={12} lg={7}>
              <GlassCard sx={{ p: 2.5, height: '100%' }}>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#FFF', mb: 0.5 }}>
                  Comparative Volume & Revenue Bar Graph
                </Typography>
                <Typography variant="caption" sx={{ color: '#AAB4C0', mb: 2, display: 'block' }}>
                  Side-by-side grouped bars comparing {pyLabel} vs {tyLabel} across Tonnage, Revenue, and Realization
                </Typography>

                <Box sx={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={volumeRevenueChartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="metric" stroke="#AAB4C0" fontSize={12} tickLine={false} />
                      <YAxis stroke="#AAB4C0" fontSize={12} tickLine={false} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#111315',
                          borderColor: 'rgba(255,255,255,0.15)',
                          borderRadius: '8px',
                          color: '#FFF'
                        }}
                        formatter={(val, name, item) => {
                          const unit = item?.payload?.unit;
                          if (unit === 'MT') return [`${formatNumber(val)} MT`, name];
                          if (unit === 'Lakhs') return [`₹${formatNumber(val)} Lakhs (${formatCurrency(val * 100000)})`, name];
                          if (unit === '₹/MT') return [`₹${formatNumber(val)} / MT`, name];
                          return [val, name];
                        }}
                      />
                      <Legend wrapperStyle={{ color: '#AAB4C0', fontSize: '12px' }} />
                      <Bar dataKey={pyLabel} fill="#64748b" radius={[4, 4, 0, 0]} name={`${pyLabel} (Previous)`} />
                      <Bar dataKey={tyLabel} fill="#8b5cf6" radius={[4, 4, 0, 0]} name={`${tyLabel} (Target)`} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </GlassCard>
            </Grid>

            {/* BAR GRAPH 2: Growth % Variance Bar Chart */}
            <Grid item xs={12} lg={5}>
              <GlassCard sx={{ p: 2.5, height: '100%' }}>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#FFF', mb: 0.5 }}>
                  Growth Variance & Disproportion Bar Graph
                </Typography>
                <Typography variant="caption" sx={{ color: '#AAB4C0', mb: 2, display: 'block' }}>
                  Relative percentage growth metrics between {pyLabel} and {tyLabel}
                </Typography>

                <Box sx={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={growthRatesChartData}
                      layout="vertical"
                      margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis type="number" stroke="#AAB4C0" fontSize={12} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" stroke="#AAB4C0" fontSize={11} width={130} tickLine={false} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#111315',
                          borderColor: 'rgba(255,255,255,0.15)',
                          borderRadius: '8px',
                          color: '#FFF'
                        }}
                        formatter={(val) => {
                          if (val === null || val === undefined || isNaN(Number(val))) return ['N/A', 'Growth Rate'];
                          const num = Number(val);
                          return [`${num > 0 ? '+' : ''}${num.toFixed(2)}%`, 'Growth Rate'];
                        }}
                      />
                      <ReferenceLine x={0} stroke="rgba(255,255,255,0.3)" />
                      <Bar dataKey="growth" radius={[0, 4, 4, 0]}>
                        {growthRatesChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </GlassCard>
            </Grid>
          </Grid>

          {/* ── DATA-DRIVEN REASON FOR DISPROPORTION ───────────────────────────── */}
          <GlassCard sx={{ p: 2.5, mb: 3, borderLeft: '4px solid #8b5cf6' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <AssessmentIcon sx={{ color: '#8b5cf6', fontSize: '1.25rem' }} />
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#FFF' }}>
                Reason for Disproportion (Data-Driven Diagnostic Analysis)
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#AAB4C0', mb: 2 }}>
              Mathematical variance analysis explaining the difference between physical lifting volume growth and financial billed revenue growth based on authoritative project records:
            </Typography>

            {/* Quantitative Realization Diagnostics Box */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', fontWeight: 600 }}>
                    PREVIOUS REVENUE / MT
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#94a3b8' }}>
                    {py.tonnage > 0 ? `₹${formatNumber(py.revPerMt)} / MT` : 'N/A'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>{pyLabel}</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Typography variant="caption" sx={{ color: '#38bdf8', display: 'block', fontWeight: 600 }}>
                    CURRENT REVENUE / MT
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#38bdf8' }}>
                    {ty.tonnage > 0 ? `₹${formatNumber(ty.revPerMt)} / MT` : 'N/A'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>{tyLabel}</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Typography variant="caption" sx={{ color: '#c084fc', display: 'block', fontWeight: 600 }}>
                    CHANGE IN REVENUE / MT
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: (comp?.diffRevPerMt || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                    {comp?.diffRevPerMt !== undefined && py.tonnage > 0 && ty.tonnage > 0
                      ? `${Number(comp.diffRevPerMt) >= 0 ? '+' : ''}₹${formatNumber(comp.diffRevPerMt)} / MT`
                      : 'N/A'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>Absolute Realization Delta</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Typography variant="caption" sx={{ color: '#10b981', display: 'block', fontWeight: 600 }}>
                    REVENUE / MT GROWTH %
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: (comp?.revPerMtGrowthPct || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                    {formatPct(comp.revPerMtGrowthPct)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>Percentage Realization Change</Typography>
                </Box>
              </Grid>
            </Grid>

            <Stack spacing={1.5}>
              {(comp.disproportionReasons || []).map((reason, idx) => (
                <Box
                  key={`reason-${idx}`}
                  sx={{
                    p: 1.5,
                    borderRadius: '8px',
                    bgcolor: reason.type === 'POSITIVE_IMPACT'
                      ? 'rgba(16, 185, 129, 0.08)'
                      : reason.type === 'NEGATIVE_IMPACT'
                      ? 'rgba(244, 63, 94, 0.08)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5
                  }}
                >
                  <SpeedIcon sx={{ color: '#c084fc', fontSize: '1.1rem', mt: 0.3 }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#FFF', mb: 0.2 }}>
                      {reason.factor}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      {reason.detail}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </GlassCard>

          {/* ── DETAILED NUMERICAL COMPARISON TABLE ───────────────────────────── */}
          <GlassCard sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#FFF', mb: 0.5 }}>
              Consolidated Period Financial & Operational Summary
            </Typography>
            <Typography variant="caption" sx={{ color: '#AAB4C0', mb: 2, display: 'block' }}>
              Full project analysis across physical volume (Cement Register) and financial revenue (Bill Register)
            </Typography>

            <TableContainer sx={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
                    <TableCell sx={{ color: '#AAB4C0', fontWeight: 700, fontSize: '0.75rem', py: 1.2 }}>METRIC / DIMENSION</TableCell>
                    <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.75rem', py: 1.2 }}>{pyLabel} (PREVIOUS)</TableCell>
                    <TableCell align="right" sx={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.75rem', py: 1.2 }}>{tyLabel} (TARGET)</TableCell>
                    <TableCell align="right" sx={{ color: '#FFF', fontWeight: 700, fontSize: '0.75rem', py: 1.2 }}>ABSOLUTE VARIANCE</TableCell>
                    <TableCell align="right" sx={{ color: '#10b981', fontWeight: 700, fontSize: '0.75rem', py: 1.2 }}>GROWTH %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Total Tonnage */}
                  <TableRow hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                    <TableCell sx={{ color: '#FFF', fontWeight: 600, fontSize: '0.8rem' }}>Total Lifting Tonnage (MT)</TableCell>
                    <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 600 }}>{formatNumber(py.tonnage)} MT</TableCell>
                    <TableCell align="right" sx={{ color: '#38bdf8', fontWeight: 700 }}>{formatNumber(ty.tonnage)} MT</TableCell>
                    <TableCell align="right" sx={{ color: (ty.tonnage - py.tonnage) >= 0 ? '#38bdf8' : '#f43f5e', fontWeight: 600 }}>
                      {(ty.tonnage - py.tonnage) >= 0 ? '+' : ''}{formatNumber(ty.tonnage - py.tonnage)} MT
                    </TableCell>
                    <TableCell align="right" sx={{ color: comp.volumeGrowthPct >= 0 ? '#38bdf8' : '#f43f5e', fontWeight: 800 }}>
                      {formatPct(comp.volumeGrowthPct)}
                    </TableCell>
                  </TableRow>

                  {/* Total Revenue */}
                  <TableRow hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                    <TableCell sx={{ color: '#FFF', fontWeight: 600, fontSize: '0.8rem' }}>Total Billed Revenue (₹)</TableCell>
                    <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 600 }}>{formatCurrency(py.revenue)}</TableCell>
                    <TableCell align="right" sx={{ color: '#10b981', fontWeight: 700 }}>{formatCurrency(ty.revenue)}</TableCell>
                    <TableCell align="right" sx={{ color: (ty.revenue - py.revenue) >= 0 ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
                      {(ty.revenue - py.revenue) >= 0 ? '+' : ''}{formatCurrency(ty.revenue - py.revenue)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: comp.revenueGrowthPct >= 0 ? '#10b981' : '#f43f5e', fontWeight: 800 }}>
                      {formatPct(comp.revenueGrowthPct)}
                    </TableCell>
                  </TableRow>

                  {/* Average Revenue Per MT */}
                  <TableRow hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                    <TableCell sx={{ color: '#FFF', fontWeight: 600, fontSize: '0.8rem' }}>Average Revenue / MT Realization</TableCell>
                    <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                      {py.tonnage > 0 ? `₹${formatNumber(py.revPerMt)} / MT` : 'N/A'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#c084fc', fontWeight: 700 }}>
                      {ty.tonnage > 0 ? `₹${formatNumber(ty.revPerMt)} / MT` : 'N/A'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: (ty.revPerMt - py.revPerMt) >= 0 ? '#c084fc' : '#f43f5e', fontWeight: 600 }}>
                      {py.tonnage > 0 && ty.tonnage > 0
                        ? `${(ty.revPerMt - py.revPerMt) >= 0 ? '+' : ''}₹${formatNumber(ty.revPerMt - py.revPerMt)} / MT`
                        : 'N/A'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: comp.revPerMtGrowthPct >= 0 ? '#c084fc' : '#f43f5e', fontWeight: 800 }}>
                      {formatPct(comp.revPerMtGrowthPct)}
                    </TableCell>
                  </TableRow>

                  {/* Operations Dispatches / Trips */}
                  <TableRow hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                    <TableCell sx={{ color: '#AAB4C0', fontSize: '0.8rem' }}>Total Cement Register Trips / Dispatches</TableCell>
                    <TableCell align="right" sx={{ color: '#94a3b8' }}>{py.tripCount || 0} Trips</TableCell>
                    <TableCell align="right" sx={{ color: '#38bdf8' }}>{ty.tripCount || 0} Trips</TableCell>
                    <TableCell align="right" sx={{ color: '#FFF' }}>{(ty.tripCount || 0) - (py.tripCount || 0)} Trips</TableCell>
                    <TableCell align="right" sx={{ color: '#FFF', fontWeight: 700 }}>
                      {py.tripCount > 0 ? formatPct((((ty.tripCount || 0) - (py.tripCount || 0)) / py.tripCount) * 100) : 'N/A'}
                    </TableCell>
                  </TableRow>

                  {/* Total Bills */}
                  <TableRow hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                    <TableCell sx={{ color: '#AAB4C0', fontSize: '0.8rem' }}>Total Generated Bills</TableCell>
                    <TableCell align="right" sx={{ color: '#94a3b8' }}>{py.billCount || 0} Bills</TableCell>
                    <TableCell align="right" sx={{ color: '#38bdf8' }}>{ty.billCount || 0} Bills</TableCell>
                    <TableCell align="right" sx={{ color: '#FFF' }}>{(ty.billCount || 0) - (py.billCount || 0)} Bills</TableCell>
                    <TableCell align="right" sx={{ color: '#FFF', fontWeight: 700 }}>
                      {py.billCount > 0 ? formatPct((((ty.billCount || 0) - (py.billCount || 0)) / py.billCount) * 100) : 'N/A'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </GlassCard>
        </>
      )}
    </Box>
  );
}
