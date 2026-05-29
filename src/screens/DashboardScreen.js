// ============================================================
// src/screens/DashboardScreen.js
// Màn hình Dashboard: KPI + biểu đồ doanh thu theo ngày
// Thay ReactECharts → react-native-gifted-charts (hoặc Victory Native)
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import AppHeader from '../components/AppHeader';
import { KpiCard, Btn } from '../components/UI';
import { apiFetch, formatVND } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { colors, globalStyles } from '../services/theme';

const SCREEN_W = Dimensions.get('window').width;

const DashboardScreen = () => {
  const [kpi, setKpi] = useState({ revenue: '—', orders: '—', products: '—', top: '—' });
  const [chartData, setChartData] = useState([]);
  const [days, setDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => { load(); }, [days]);

  const getDateRange = () => {
    const today = new Date();
    const from = new Date(today.getTime() - (days - 1) * 86400000);
    return {
      from: from.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
    };
  };

  const load = async () => {
    try {
      const { from, to } = getDateRange();

      // Products count
      const prodRes = await apiFetch('/api/admin/products?page=1&page_size=1');
      // Top products
      let topStr = '—';
      try {
        const topRes = await apiFetch('/api/products/top?limit=3');
        topStr = (topRes.data || []).map((x) => x.ten_san_pham).slice(0, 2).join(', ') || '—';
      } catch {}

      // Orders
      const ordRes = await apiFetch(
        `/api/admin/orders?status=Đã thanh toán&from=${from}&to=${to}&page=1&page_size=1000`
      );
      const items = ordRes.data?.items || [];
      const sum = items.reduce((s, o) => s + Number(o.tongtien || 0), 0);

      setKpi({
        revenue: formatVND(sum),
        orders: String(items.length),
        products: String(prodRes.data?.total || 0),
        top: topStr,
      });

      // Group by date for chart
      const map = new Map();
      items.forEach((o) => {
        const d = (o.created_at || '').slice(0, 10);
        map.set(d, (map.get(d) || 0) + Number(o.tongtien || 0));
      });
      const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      setChartData(sorted.map(([date, value]) => ({
        value,
        label: date.slice(5), // MM-DD
        dataPointText: '',
      })));
    } catch (e) {
      showToast('Lỗi tải dashboard: ' + e.message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const DAY_OPTIONS = [7, 14, 30];

  return (
    <View style={globalStyles.screen}>
      <AppHeader title="📊 Dashboard" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiRow}>
            <KpiCard label="Tổng doanh thu" value={kpi.revenue} />
            <View style={{ width: 12 }} />
            <KpiCard label="Số đơn" value={kpi.orders} color={colors.success} />
          </View>
          <View style={[styles.kpiRow, { marginTop: 12 }]}>
            <KpiCard label="Sản phẩm đang bán" value={kpi.products} color={colors.warn} />
            <View style={{ width: 12 }} />
            <KpiCard label="Top bán chạy" value={kpi.top} color="#8b5cf6" />
          </View>
        </View>

        {/* Chart Card */}
        <View style={[globalStyles.card, { marginTop: 8 }]}>
          <View style={styles.chartHeader}>
            <Text style={globalStyles.sectionTitle}>Doanh thu theo ngày</Text>
            <View style={styles.seg}>
              {DAY_OPTIONS.map((d) => (
                <TouchableOpacity
                  key={d} onPress={() => setDays(d)}
                  style={[styles.segBtn, days === d && styles.segBtnActive]}
                >
                  <Text style={[styles.segText, days === d && styles.segTextActive]}>
                    {d}N
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {chartData.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={chartData}
                height={200}
                width={Math.max(SCREEN_W - 64, chartData.length * 40)}
                spacing={Math.max(30, (SCREEN_W - 64) / chartData.length)}
                color={colors.primary}
                thickness={3}
                startFillColor={colors.primary}
                endFillColor="rgba(59,130,246,0)"
                startOpacity={0.25}
                endOpacity={0}
                areaChart
                curved
                hideDataPoints={chartData.length > 20}
                dataPointsColor={colors.primary}
                dataPointsRadius={4}
                yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }}
                noOfSections={4}
                yAxisSide="left"
                formatYLabel={(v) => {
                  const n = Number(v);
                  if (n >= 1000000) return (n / 1000000).toFixed(0) + 'M';
                  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
                  return String(n);
                }}
                hideRules={false}
                rulesColor={colors.borderLight}
                xAxisColor={colors.border}
                yAxisColor="transparent"
                isAnimated
              />
            </ScrollView>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={globalStyles.muted}>Không có dữ liệu trong khoảng này</Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: 8 }}>
          <Btn title="🔄 Làm mới" variant="secondary" onPress={load} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  kpiGrid: { marginBottom: 4 },
  kpiRow: { flexDirection: 'row' },
  chartHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  seg: {
    flexDirection: 'row', backgroundColor: colors.bgSoft,
    borderRadius: 10, padding: 3, borderWidth: 1, borderColor: colors.border,
  },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  segBtnActive: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  segText: { fontSize: 12, color: colors.muted, fontWeight: '500' },
  segTextActive: { color: colors.primary, fontWeight: '700' },
  emptyChart: { height: 120, alignItems: 'center', justifyContent: 'center' },
});

export default DashboardScreen;
