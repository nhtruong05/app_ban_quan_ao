// ============================================================
// src/screens/ReportsScreen.js
// Báo cáo doanh thu: KPI, biểu đồ đường + cột, xuất CSV (Share)
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Share, Dimensions, RefreshControl,
} from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import AppHeader from '../components/AppHeader';
import { KpiCard, Btn } from '../components/UI';
import { apiFetch, formatVND } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { colors, globalStyles } from '../services/theme';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 64;

const DAY_OPTIONS = [7, 14, 30, 90];

const ReportsScreen = () => {
  const [kpi, setKpi] = useState({ revenue: '—', count: '—', avg: '—', pay: '—' });
  const [days, setDays] = useState(30);
  const [lineData, setLineData] = useState([]);
  const [barData, setBarData] = useState([]);
  const [paymentData, setPaymentData] = useState([]);
  const [rawItems, setRawItems] = useState([]);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToast();

  const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  useEffect(() => {
    const today = new Date();
    const from = new Date(today.getTime() - (days - 1) * 86400000);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = today.toISOString().slice(0, 10);
    setDateRange({ from: fromStr, to: toStr });
    runReport(fromStr, toStr);
  }, [days]);

  const runReport = async (from, to) => {
    try {
      const fromStr = from || dateRange.from;
      const toStr = to || dateRange.to;
      const res = await apiFetch(
        `/api/admin/orders?status=Đã thanh toán&from=${fromStr}&to=${toStr}&page=1&page_size=1000`
      );
      const items = res.data?.items || [];
      setRawItems(items);
      const sum = items.reduce((s, o) => s + Number(o.tongtien || 0), 0);
      const avg = items.length ? sum / items.length : 0;

      // Payment method breakdown
      const payMap = new Map();
      items.forEach((o) => {
        const k = o.payment_method || 'Khác';
        payMap.set(k, (payMap.get(k) || 0) + Number(o.tongtien || 0));
      });
      const payPairs = [...payMap.entries()].sort((a, b) => b[1] - a[1]);
      setKpi({
        revenue: formatVND(sum),
        count: String(items.length),
        avg: formatVND(avg),
        pay: payPairs[0] ? payPairs[0][0] : '—',
      });

      // Revenue by date (line chart)
      const dateMap = new Map();
      items.forEach((o) => {
        const d = (o.created_at || '').slice(0, 10);
        dateMap.set(d, (dateMap.get(d) || 0) + Number(o.tongtien || 0));
      });
      const sorted = [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      setLineData(sorted.map(([d, v]) => ({ value: v, label: d.slice(5) })));

      // Payment bar chart
      setBarData(payPairs.map(([name, value], i) => ({
        value, label: name,
        frontColor: CHART_COLORS[i % CHART_COLORS.length],
      })));

      // Top products
      const prodMap = new Map();
      items.forEach((o) => {
        const k = o.ten_san_pham || '—';
        prodMap.set(k, (prodMap.get(k) || 0) + Number(o.tongtien || 0));
      });
      const top = [...prodMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      setPaymentData(top.map(([name, value], i) => ({
        value, label: name.length > 10 ? name.slice(0, 10) + '…' : name,
        frontColor: CHART_COLORS[i % CHART_COLORS.length],
      })));
    } catch (e) {
      showToast('Lỗi: ' + e.message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await runReport();
    setRefreshing(false);
  };

  const exportCSV = async () => {
    if (rawItems.length === 0) { showToast('Không có dữ liệu để xuất'); return; }
    const headers = ['id', 'thoigian', 'hoten', 'email', 'sdt', 'ten_san_pham', 'soluong', 'tongtien', 'payment_method', 'trangthai'];
    const rows = [headers.join(',')].concat(
      rawItems.map((o) => headers.map((h) => JSON.stringify(o[h] || '')).join(','))
    );
    const csv = rows.join('\n');
    try {
      await Share.share({ message: csv, title: `report_${dateRange.from}_${dateRange.to}.csv` });
    } catch (e) { showToast('Lỗi xuất: ' + e.message); }
  };

  const formatY = (v) => {
    const n = Number(v);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
    return String(n);
  };

  return (
    <View style={globalStyles.screen}>
      <AppHeader title="📈 Báo cáo doanh thu" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Day range filter */}
        <View style={styles.seg}>
          {DAY_OPTIONS.map((d) => (
            <TouchableOpacity
              key={d} onPress={() => setDays(d)}
              style={[styles.segBtn, days === d && styles.segBtnActive]}
            >
              <Text style={[styles.segText, days === d && styles.segTextActive]}>{d} ngày</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[globalStyles.muted, { fontSize: 12, marginBottom: 12 }]}>
          📅 {dateRange.from} → {dateRange.to}
        </Text>

        {/* KPI */}
        <View style={styles.kpiRow}>
          <KpiCard label="Doanh thu" value={kpi.revenue} />
          <View style={{ width: 12 }} />
          <KpiCard label="Số đơn" value={kpi.count} color={colors.success} />
        </View>
        <View style={[styles.kpiRow, { marginTop: 12, marginBottom: 16 }]}>
          <KpiCard label="Giá trị TB/đơn" value={kpi.avg} color={colors.warn} />
          <View style={{ width: 12 }} />
          <KpiCard label="Phương thức phổ biến" value={kpi.pay} color="#8b5cf6" />
        </View>

        {/* Buttons */}
        <View style={[globalStyles.row, { gap: 10, marginBottom: 16 }]}>
          <Btn title="🔄 Làm mới" variant="secondary" onPress={() => runReport()} style={{ flex: 1 }} />
          <Btn title="📤 Xuất CSV" variant="secondary" onPress={exportCSV} style={{ flex: 1 }} />
        </View>

        {/* Line chart: doanh thu theo ngày */}
        {lineData.length > 0 && (
          <View style={globalStyles.card}>
            <Text style={styles.chartTitle}>📈 Doanh thu theo ngày</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={lineData}
                height={180}
                width={Math.max(CHART_W, lineData.length * 38)}
                spacing={Math.max(28, CHART_W / lineData.length)}
                color={colors.primary}
                thickness={2.5}
                startFillColor={colors.primary}
                endFillColor="rgba(59,130,246,0)"
                startOpacity={0.2}
                endOpacity={0}
                areaChart
                curved
                hideDataPoints={lineData.length > 25}
                dataPointsColor={colors.primary}
                dataPointsRadius={3}
                yAxisTextStyle={{ color: colors.muted, fontSize: 9 }}
                xAxisLabelTextStyle={{ color: colors.muted, fontSize: 8, rotation: lineData.length > 10 ? 45 : 0 }}
                noOfSections={4}
                formatYLabel={formatY}
                rulesColor={colors.borderLight}
                xAxisColor={colors.border}
                yAxisColor="transparent"
                isAnimated
              />
            </ScrollView>
          </View>
        )}

        {/* Bar chart: theo phương thức */}
        {barData.length > 0 && (
          <View style={[globalStyles.card, { marginTop: 12 }]}>
            <Text style={styles.chartTitle}>💳 Doanh thu theo phương thức thanh toán</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={barData}
                height={160}
                width={Math.max(CHART_W, barData.length * 70)}
                barWidth={40}
                spacing={20}
                roundedTop
                xAxisLabelTextStyle={{ color: colors.muted, fontSize: 11 }}
                yAxisTextStyle={{ color: colors.muted, fontSize: 9 }}
                noOfSections={4}
                formatYLabel={formatY}
                rulesColor={colors.borderLight}
                xAxisColor={colors.border}
                yAxisColor="transparent"
                isAnimated
              />
            </ScrollView>
          </View>
        )}

        {/* Bar chart: top sản phẩm */}
        {paymentData.length > 0 && (
          <View style={[globalStyles.card, { marginTop: 12 }]}>
            <Text style={styles.chartTitle}>🏆 Top sản phẩm bán chạy</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={paymentData}
                height={160}
                width={Math.max(CHART_W, paymentData.length * 70)}
                barWidth={40}
                spacing={20}
                roundedTop
                xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
                yAxisTextStyle={{ color: colors.muted, fontSize: 9 }}
                noOfSections={4}
                formatYLabel={formatY}
                rulesColor={colors.borderLight}
                xAxisColor={colors.border}
                yAxisColor="transparent"
                isAnimated
              />
            </ScrollView>
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  seg: {
    flexDirection: 'row', backgroundColor: colors.bgSoft,
    borderRadius: 12, padding: 4, borderWidth: 1,
    borderColor: colors.border, marginBottom: 12,
  },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  segBtnActive: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  segText: { fontSize: 12, color: colors.muted, fontWeight: '500' },
  segTextActive: { color: colors.primary, fontWeight: '700' },
  kpiRow: { flexDirection: 'row' },
  chartTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 },
});

export default ReportsScreen;
