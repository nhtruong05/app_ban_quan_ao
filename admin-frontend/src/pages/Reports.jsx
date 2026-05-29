import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { apiFetch, formatVND } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const Reports = () => {
  const [kpiData, setKpiData] = useState({
    revenue: '—',
    count: '—',
    avg: '—',
    pay: '—',
  });
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [days, setDays] = useState(30);
  const [chartData, setChartData] = useState({
    revenue: { labels: [], values: [] },
    payment: [],
    topProducts: { labels: [], values: [] },
    paymentBar: [],
  });
  const { showToast } = useToast();

  useEffect(() => {
    const today = new Date();
    const from = new Date(today.getTime() - (days - 1) * 86400000);
    setDateRange({
      from: from.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
    });
  }, [days]);

  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      runReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const groupByDate = (orders) => {
    const map = new Map();
    (orders || []).forEach((o) => {
      const d = (o.created_at || '').slice(0, 10) || 'N/A';
      const t = Number(o.tongtien || 0);
      map.set(d, (map.get(d) || 0) + t);
    });
    const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return { labels: entries.map((e) => e[0]), values: entries.map((e) => e[1]) };
  };

  const runReport = async () => {
    try {
      const res = await apiFetch(
        `/api/admin/orders?status=Đã thanh toán&from=${dateRange.from}&to=${dateRange.to}&page=1&page_size=1000`
      );
      const items = res.data?.items || [];
      const sum = items.reduce((s, o) => s + Number(o.tongtien || 0), 0);
      const avg = items.length ? sum / items.length : 0;

      setKpiData({
        revenue: formatVND(sum),
        count: String(items.length),
        avg: formatVND(avg),
        pay: '—',
      });

      // Payment method analysis
      const payMap = new Map();
      items.forEach((o) => {
        const k = o.payment_method || 'Khác';
        const v = Number(o.tongtien || 0);
        payMap.set(k, (payMap.get(k) || 0) + v);
      });
      const payPairs = [...payMap.entries()].sort((a, b) => b[1] - a[1]);
      setKpiData((prev) => ({ ...prev, pay: payPairs[0] ? payPairs[0][0] : '—' }));

      // Revenue chart
      const revenueData = groupByDate(items);
      setChartData((prev) => ({ ...prev, revenue: revenueData }));

      // Payment pie chart
      setChartData((prev) => ({ ...prev, payment: payPairs, paymentBar: payPairs }));

      // Top products
      const prodMap = new Map();
      items.forEach((o) => {
        const k = o.ten_san_pham || '—';
        prodMap.set(k, (prodMap.get(k) || 0) + Number(o.tongtien || 0));
      });
      const top = [...prodMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      setChartData((prev) => ({
        ...prev,
        topProducts: { labels: top.map((x) => x[0]), values: top.map((x) => x[1]) },
      }));
    } catch (error) {
      showToast('Lỗi tải báo cáo: ' + error.message);
    }
  };

  const exportCSV = async () => {
    try {
      const res = await apiFetch(
        `/api/admin/orders?status=Đã thanh toán&from=${dateRange.from}&to=${dateRange.to}&page=1&page_size=1000`
      );
      const items = res.data?.items || [];
      const headers = [
        'id',
        'thoigian',
        'hoten',
        'email',
        'sdt',
        'ten_san_pham',
        'soluong',
        'tongtien',
        'payment_method',
        'trangthai',
      ];
      const rows = [headers.join(',')].concat(
        items.map((o) => headers.map((h) => JSON.stringify(o[h] || '')).join(','))
      );
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `report_${dateRange.from}_${dateRange.to}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (error) {
      showToast('Xuất CSV lỗi: ' + error.message);
    }
  };

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

  const revenueOption = useMemo(() => ({
    animation: true,
    animationDuration: 1500,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 12,
      padding: [12, 16],
      textStyle: { color: '#ffffff', fontSize: 13 },
      formatter: (ps) => {
        const p = ps[0];
        return `<div style="padding: 4px 0;">
          <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">${p.axisValue}</div>
          <div style="font-size: 16px; font-weight: 600;">${formatVND(p.value)}</div>
        </div>`;
      },
    },
    grid: { left: 60, right: 20, top: 30, bottom: 50, containLabel: false },
    xAxis: {
      type: 'category',
      data: chartData.revenue.labels,
      boundaryGap: false,
      axisLine: { show: true, lineStyle: { color: '#e2e8f0', width: 1 } },
      axisLabel: {
        rotate: chartData.revenue.labels.length > 10 ? 45 : 0,
        color: '#64748b',
        fontSize: 11,
        margin: 12,
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        formatter: (v) => {
          if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
          if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
          return v;
        },
        color: '#64748b',
        fontSize: 11,
      },
      splitLine: { show: true, lineStyle: { color: '#f1f5f9', type: 'solid', width: 1 } },
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', height: 24, bottom: 10 },
    ],
    series: [
      {
        name: 'Doanh thu',
        type: 'line',
        smooth: true,
        smoothMonotone: 'x',
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: chartData.revenue.values.length <= 30,
        lineStyle: { width: 3, color: '#3b82f6' },
        itemStyle: { color: '#3b82f6', borderColor: '#ffffff', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.3)' },
              { offset: 0.5, color: 'rgba(59,130,246,0.15)' },
              { offset: 1, color: 'rgba(59,130,246,0)' },
            ],
          },
        },
        data: chartData.revenue.values,
        emphasis: { focus: 'series' },
        markLine: {
          silent: true,
          data: [{ type: 'average', name: 'Trung bình' }],
          lineStyle: { color: '#94a3b8', type: 'dashed', width: 2 },
        },
      },
    ],
  }), [chartData.revenue.labels, chartData.revenue.values]);

  const paymentOption = useMemo(() => ({
    animation: true,
    animationDuration: 1500,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 12,
      padding: [12, 16],
      textStyle: { color: '#ffffff', fontSize: 13 },
      formatter: (params) => {
        const total = chartData.payment.reduce((s, [_, v]) => s + v, 0);
        return `<div style="padding: 4px 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="display: inline-block; width: 12px; height: 12px; background: ${params.color}; border-radius: 2px;"></span>
            <span style="font-size: 13px; font-weight: 500;">${params.name}</span>
          </div>
          <div style="font-size: 16px; font-weight: 600; margin-top: 4px;">${formatVND(params.value)}</div>
          <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">${params.percent}% tổng doanh thu</div>
        </div>`;
      },
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      itemGap: 16,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { color: '#64748b', fontSize: 12, fontWeight: 500 },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '75%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 8, borderColor: '#ffffff', borderWidth: 3 },
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 20, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.2)', borderWidth: 4 },
        },
        data: chartData.payment.map(([name, value], idx) => ({
          name,
          value,
          itemStyle: { color: colors[idx % colors.length] },
        })),
      },
    ],
  }), [chartData.payment]);

  const topProductsOption = useMemo(() => ({
    animation: true,
    animationDuration: 1500,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 12,
      padding: [12, 16],
      textStyle: { color: '#ffffff', fontSize: 13 },
      formatter: (params) => {
        const p = params[0];
        return `<div style="padding: 4px 0;">
          <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">${p.axisValue}</div>
          <div style="font-size: 16px; font-weight: 600;">${formatVND(p.value)}</div>
        </div>`;
      },
    },
    grid: { left: 140, right: 40, top: 20, bottom: 20, containLabel: false },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        formatter: (v) => {
          if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
          if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
          return v;
        },
        color: '#64748b',
        fontSize: 11,
      },
      splitLine: { show: true, lineStyle: { color: '#f1f5f9', type: 'solid', width: 1 } },
    },
    yAxis: {
      type: 'category',
      data: chartData.topProducts.labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#0f172a', fontSize: 12, fontWeight: 500, margin: 12 },
    },
    series: [
      {
        type: 'bar',
        data: chartData.topProducts.values,
        barWidth: '60%',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: '#3b82f6' },
              { offset: 1, color: '#2563eb' },
            ],
          },
          borderRadius: [0, 8, 8, 0],
        },
        label: {
          show: true,
          position: 'right',
          formatter: (params) => formatVND(params.value),
          color: '#64748b',
          fontSize: 11,
          fontWeight: 500,
        },
      },
    ],
  }), [chartData.topProducts.labels, chartData.topProducts.values]);

  const paymentBarOption = useMemo(() => ({
    animation: true,
    animationDuration: 1500,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 12,
      padding: [12, 16],
      textStyle: { color: '#ffffff', fontSize: 13 },
      formatter: (params) => {
        const p = params[0];
        const total = chartData.paymentBar.reduce((s, [_, v]) => s + v, 0);
        const percent = ((p.value / total) * 100).toFixed(1);
        return `<div style="padding: 4px 0;">
          <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">${p.name}</div>
          <div style="font-size: 16px; font-weight: 600;">${formatVND(p.value)}</div>
          <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">${percent}% tổng doanh thu</div>
        </div>`;
      },
    },
    grid: { left: 60, right: 40, top: 30, bottom: 50 },
    xAxis: {
      type: 'category',
      data: chartData.paymentBar.map(([name]) => name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: 500,
        rotate: chartData.paymentBar.length > 5 ? 45 : 0,
        margin: 12,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        formatter: (v) => {
          if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
          if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
          return v;
        },
        color: '#64748b',
        fontSize: 11,
      },
      splitLine: { show: true, lineStyle: { color: '#f1f5f9', type: 'solid', width: 1 } },
    },
    series: [
      {
        type: 'bar',
        data: chartData.paymentBar.map(([_, value], idx) => ({
          value,
          itemStyle: { color: colors[idx % colors.length] },
        })),
        barWidth: '60%',
        itemStyle: { borderRadius: [8, 8, 0, 0] },
        label: {
          show: true,
          position: 'top',
          formatter: (params) => {
            const total = chartData.paymentBar.reduce((s, [_, v]) => s + v, 0);
            const percent = ((params.value / total) * 100).toFixed(1);
            return `${percent}%`;
          },
          color: '#64748b',
          fontSize: 11,
          fontWeight: 500,
        },
      },
    ],
  }), [chartData.paymentBar]);

  return (
    <div className="section">
      <div className="card">
        <div className="row" style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
          <strong style={{ fontSize: '18px' }}>Báo cáo doanh thu</strong>
          <div className="right row" style={{ gap: '8px' }}>
            <div className="seg">
              {[7, 14, 30, 90].map((d) => (
                <button
                  key={d}
                  className={days === d ? 'active' : ''}
                  onClick={() => setDays(d)}
                >
                  {d} ngày
                </button>
              ))}
            </div>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            />
            <span className="muted">→</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            />
            <button className="btn-secondary" onClick={runReport}>
              Chạy báo cáo
            </button>
            <button className="btn-secondary" onClick={exportCSV}>
              Xuất CSV
            </button>
          </div>
        </div>

        <div className="kpi-grid section">
          <div className="kpi-card">
            <span className="muted" style={{ fontSize: '12px' }}>Doanh thu</span>
            <b>{kpiData.revenue}</b>
          </div>
          <div className="kpi-card">
            <span className="muted" style={{ fontSize: '12px' }}>Số đơn</span>
            <b>{kpiData.count}</b>
          </div>
          <div className="kpi-card">
            <span className="muted" style={{ fontSize: '12px' }}>Giá trị TB/đơn</span>
            <b>{kpiData.avg}</b>
          </div>
          <div className="kpi-card">
            <span className="muted" style={{ fontSize: '12px' }}>Phương thức phổ biến</span>
            <b>{kpiData.pay}</b>
          </div>
        </div>

        <div className="section muted">
          <span className="pill">
            Khoảng: <b>{dateRange.from}</b> → <b>{dateRange.to}</b>
          </span>
        </div>

        <div className="grid section" style={{ gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <strong style={{ fontSize: '16px', color: 'var(--text)' }}>📈 Doanh thu theo ngày</strong>
            </div>
            <div style={{ width: '100%', height: '380px' }}>
              {chartData.revenue.labels.length > 0 && (
                <ReactECharts
                  option={revenueOption}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                  notMerge={true}
                />
              )}
            </div>
          </div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <strong style={{ fontSize: '16px', color: 'var(--text)' }}>💳 Phương thức thanh toán</strong>
            </div>
            <div style={{ width: '100%', height: '380px' }}>
              {chartData.payment.length > 0 && (
                <ReactECharts
                  option={paymentOption}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                  notMerge={true}
                />
              )}
            </div>
          </div>
        </div>

        <div className="grid section" style={{ gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <strong style={{ fontSize: '16px', color: 'var(--text)' }}>🏆 Top sản phẩm bán chạy</strong>
            </div>
            <div style={{ width: '100%', height: '380px' }}>
              {chartData.topProducts.labels.length > 0 && (
                <ReactECharts
                  option={topProductsOption}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                  notMerge={true}
                />
              )}
            </div>
          </div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <strong style={{ fontSize: '16px', color: 'var(--text)' }}>📊 Doanh thu theo phương thức</strong>
            </div>
            <div style={{ width: '100%', height: '380px' }}>
              {chartData.paymentBar.length > 0 && (
                <ReactECharts
                  option={paymentBarOption}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                  notMerge={true}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;

