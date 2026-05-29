import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { apiFetch, formatVND } from '../services/api';

const Dashboard = () => {
  const [kpiData, setKpiData] = useState({
    revenue: '—',
    orders: '—',
    products: '—',
    top: '—',
  });
  const [chartData, setChartData] = useState({ labels: [], values: [] });
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [days, setDays] = useState(30);
  const chartRef = useRef(null);

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
      refreshDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const refreshDashboard = async () => {
    try {
      // Load products count
      const productsRes = await apiFetch('/api/admin/products?page=1&page_size=1');
      setKpiData((prev) => ({
        ...prev,
        products: productsRes.data?.total || '—',
      }));

      // Load top products
      try {
        const topRes = await apiFetch('/api/products/top?limit=3');
        const names = (topRes.data || [])
          .map((x) => x.ten_san_pham)
          .slice(0, 3)
          .join(', ');
        setKpiData((prev) => ({ ...prev, top: names || '—' }));
      } catch (e) {
        setKpiData((prev) => ({ ...prev, top: '—' }));
      }

      // Load orders and revenue
      const ordersRes = await apiFetch(
        `/api/admin/orders?status=Đã thanh toán&from=${dateRange.from}&to=${dateRange.to}&page=1&page_size=1000`
      );
      const items = ordersRes.data?.items || [];
      const sum = items.reduce((s, o) => s + Number(o.tongtien || 0), 0);

      setKpiData((prev) => ({
        ...prev,
        revenue: formatVND(sum),
        orders: String(items.length),
      }));

      // Group by date
      const map = new Map();
      items.forEach((o) => {
        const d = (o.created_at || '').slice(0, 10) || 'N/A';
        const t = Number(o.tongtien || 0);
        map.set(d, (map.get(d) || 0) + t);
      });
      const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));

      setChartData({
        labels: entries.map((e) => e[0]),
        values: entries.map((e) => e[1]),
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const chartOption = useMemo(() => ({
    animationDuration: 800,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#111827',
      borderColor: '#1f2937',
      textStyle: { color: '#dbeafe' },
      formatter: (ps) => {
        const p = ps[0];
        return `${p.axisValue}<br/><b>${formatVND(p.value)}</b>`;
      },
    },
    toolbox: { feature: { saveAsImage: {} } },
    grid: { left: 56, right: 16, top: 24, bottom: 56 },
    xAxis: {
      type: 'category',
      data: chartData.labels,
      boundaryGap: false,
      axisLabel: { rotate: 30 },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (v) => v.toLocaleString('vi-VN'),
      },
      splitLine: { lineStyle: { color: '#e5e7eb' } },
    },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18 }],
    series: [
      {
        name: 'Doanh thu',
        type: 'line',
        smooth: true,
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 3, color: '#22c55e' },
        data: chartData.values,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(34,197,94,.35)' },
              { offset: 1, color: 'rgba(34,197,94,0)' },
            ],
          },
        },
        emphasis: { focus: 'series' },
        markLine: {
          silent: true,
          data: [{ type: 'average', name: 'TB' }],
          lineStyle: { color: '#9ca3af', type: 'dashed' },
        },
      },
    ],
  }), [chartData.labels, chartData.values]);

  return (
    <div className="section">
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="muted">Tổng doanh thu</span>
          <b>{kpiData.revenue}</b>
        </div>
        <div className="kpi-card">
          <span className="muted">Số đơn</span>
          <b>{kpiData.orders}</b>
        </div>
        <div className="kpi-card">
          <span className="muted">Sản phẩm đang bán</span>
          <b>{kpiData.products}</b>
        </div>
        <div className="kpi-card">
          <span className="muted">Top bán chạy</span>
          <b>{kpiData.top}</b>
        </div>
      </div>

      <div className="card section">
        <div className="row" style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
          <strong style={{ margin: 0 }}>Biểu đồ doanh thu theo ngày</strong>
          <div className="right row" style={{ gap: '12px', flexWrap: 'wrap' }}>
            <div className="seg">
              <button
                className={days === 7 ? 'active' : ''}
                onClick={() => setDays(7)}
              >
                7 ngày
              </button>
              <button
                className={days === 14 ? 'active' : ''}
                onClick={() => setDays(14)}
              >
                14 ngày
              </button>
              <button
                className={days === 30 ? 'active' : ''}
                onClick={() => setDays(30)}
              >
                30 ngày
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                style={{ maxWidth: '150px' }}
              />
              <span className="muted">→</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                style={{ maxWidth: '150px' }}
              />
            </div>
            <button className="btn-secondary" onClick={refreshDashboard}>
              🔄 Làm mới
            </button>
          </div>
        </div>

        <div style={{ width: '100%', height: '360px' }}>
          {chartData.labels.length > 0 && (
            <ReactECharts
              ref={chartRef}
              option={chartOption}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
              notMerge={true}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

