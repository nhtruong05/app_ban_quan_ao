# admin_orders.py
from flask import Blueprint, request
from datetime import datetime
from math import ceil
from utils import ok, err, get_mysql, admin_required

admin_orders_bp = Blueprint("admin_orders", __name__)

ORDER_PK = "id"

def _parse_date(s):
    try:
        return datetime.fromisoformat(s).date()
    except Exception:
        return None

@admin_orders_bp.get("/orders")
@admin_required
def admin_list_orders():
    """
    Danh sách đơn hàng (admin):
      - Lọc: status (PAID/PENDING/FAILED), from (YYYY-MM-DD), to (YYYY-MM-DD), q (tìm theo tên/sđt/email/địa chỉ/tên SP)
      - Phân trang: page, page_size
      - Sắp xếp: mới nhất trước
    Trả về: { items: [...], total, page, page_size, total_pages }
    Lưu ý: trả thêm trường hinh_anh (URL ảnh sản phẩm) lấy từ bảng products.
    """
    mysql = get_mysql()

    status = request.args.get("status", "").strip()
    q      = request.args.get("q", "").strip()
    d_from = _parse_date(request.args.get("from", "") or "")
    d_to   = _parse_date(request.args.get("to", "") or "")

    try:
        page = max(int(request.args.get("page", 1)), 1)
        page_size = max(min(int(request.args.get("page_size", 20)), 200), 1)
    except ValueError:
        return err("page/page_size không hợp lệ")

    offset = (page - 1) * page_size

    wheres, params = [], []

    if status:
        wheres.append("o.trangthai=%s")
        params.append(status)

    if d_from:
        wheres.append("DATE(o.created_at) >= %s")
        params.append(d_from.isoformat())

    if d_to:
        wheres.append("DATE(o.created_at) <= %s")
        params.append(d_to.isoformat())

    if q:
        # Tìm theo các trường của orders + tên sản phẩm
        wheres.append("("
                      "o.hoten LIKE %s OR o.sdt LIKE %s OR o.payment_method LIKE %s OR "
                      "o.diachi_giaohang LIKE %s OR p.ten_san_pham LIKE %s"
                      ")")
        like = f"%{q}%"
        params.extend([like, like, like, like, like])

    where_sql = ("WHERE " + " AND ".join(wheres)) if wheres else ""

    cur = mysql.connection.cursor()

    # Đếm tổng theo đơn (distinct o.id)
    cur.execute(f"""
        SELECT COUNT(DISTINCT o.id) AS cnt
        FROM orders o
        LEFT JOIN order_details od ON od.order_id = o.id
        LEFT JOIN products p ON p.products_id = od.product_id
        {where_sql}
    """, tuple(params))
    total = (cur.fetchone() or {}).get("cnt", 0)

    # Lấy dữ liệu trang
    cur.execute(f"""
        SELECT
            o.{ORDER_PK}            AS id,
            o.user_id               AS user_id,
            o.tongtien              AS tongtien,
            o.trangthai             AS trangthai,
            o.diachi_giaohang       AS diachi_giaohang,
            o.created_at            AS created_at,
            o.hoten                 AS hoten,
            o.sdt                   AS sdt,
            o.payment_method        AS payment_method,
            o.payment_token         AS payment_token,
            -- Ảnh đại diện (ảnh của 1 sản phẩm bất kỳ trong đơn)
            MAX(p.hinh_anh)         AS hinh_anh,
            -- Tổng số sản phẩm trong đơn
            COALESCE(SUM(od.quantity), 0) AS order_total_soluong,
            -- Danh sách tên sản phẩm
            GROUP_CONCAT(DISTINCT p.ten_san_pham ORDER BY od.id SEPARATOR ', ') AS order_products_names
        FROM orders o
        LEFT JOIN order_details od ON od.order_id = o.id
        LEFT JOIN products p ON p.products_id = od.product_id
        {where_sql}
        GROUP BY o.id
        ORDER BY o.{ORDER_PK} DESC
        LIMIT %s OFFSET %s
    """, tuple(params + [page_size, offset]))
    items = cur.fetchall() or []
    
    # Convert datetime objects sang string format chuẩn
    # MySQL trả về datetime object hoặc string, cần format nhất quán
    # Giữ nguyên giá trị datetime như MySQL trả về (không convert timezone)
    for item in items:
        if item.get("created_at"):
            dt = item["created_at"]
            # Nếu là datetime object, convert sang string format: YYYY-MM-DD HH:MM:SS
            if isinstance(dt, datetime):
                item["created_at"] = dt.strftime('%Y-%m-%d %H:%M:%S')
            # Nếu đã là string, giữ nguyên (MySQL có thể trả về string)

    return ok({
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil((total or 0) / page_size) if page_size else 0
    })

@admin_orders_bp.get("/orders/<int:oid>/details")
@admin_required
def admin_get_order_details(oid: int):
    """
    Lấy chi tiết đơn hàng với tất cả sản phẩm và ảnh
    """
    mysql = get_mysql()
    cur = mysql.connection.cursor()
    
    # Lấy thông tin đơn hàng
    cur.execute(f"""
        SELECT o.{ORDER_PK} AS id, o.user_id, o.tongtien, o.trangthai,
               o.diachi_giaohang, o.created_at, o.hoten, o.sdt,
               o.payment_method, o.payment_token
        FROM orders o
        WHERE o.{ORDER_PK}=%s
    """, (oid,))
    order = cur.fetchone()
    
    if not order:
        return err("Không tìm thấy đơn hàng", 404)
    
    # Lấy tất cả sản phẩm trong đơn với ảnh
    cur.execute("""
        SELECT od.product_id, od.unit_price, od.quantity, od.line_total,
               p.ten_san_pham, p.hinh_anh, p.loai, p.size, p.gia_ban
        FROM order_details od
        JOIN products p ON p.products_id = od.product_id
        WHERE od.order_id=%s
        ORDER BY od.id
    """, (oid,))
    items = cur.fetchall() or []
    
    # Convert datetime
    if order.get("created_at") and isinstance(order["created_at"], datetime):
        order["created_at"] = order["created_at"].strftime('%Y-%m-%d %H:%M:%S')
    
    return ok({
        "order": order,
        "items": items
    })

@admin_orders_bp.put("/orders/<int:oid>")
@admin_required
def admin_update_order(oid: int):
    """
    Cập nhật đơn (hiện hỗ trợ cập nhật nhanh trạng thái):
      body: { "trangthai": "Chờ xác nhận|Đã thanh toán|Đang giao|Hoàn thành|Hủy" }
    Có thể mở rộng thêm các trường khác nếu cần (địa chỉ, sdt, ...).
    """
    mysql = get_mysql()
    data = request.get_json(force=True) or {}
    status = str(data.get("trangthai", "")).strip()
    if not status:
        return err("Thiếu trangthai")

    cur = mysql.connection.cursor()
    cur.execute("UPDATE orders SET trangthai=%s WHERE id=%s", (status, oid))
    mysql.connection.commit()

    return ok({"message": "Đã cập nhật đơn hàng", "id": oid, "trangthai": status})

@admin_orders_bp.delete("/orders/<int:oid>")
@admin_required
def admin_delete_order(oid: int):
    """
    Xóa đơn hàng (cascade sẽ xóa order_details tự động)
    """
    mysql = get_mysql()
    cur = mysql.connection.cursor()
    
    # Kiểm tra đơn hàng có tồn tại không
    cur.execute("SELECT id, trangthai FROM orders WHERE id=%s", (oid,))
    order = cur.fetchone()
    
    if not order:
        return err("Không tìm thấy đơn hàng", 404)
    
    # Xóa đơn hàng (order_details sẽ tự động xóa nhờ ON DELETE CASCADE)
    cur.execute("DELETE FROM orders WHERE id=%s", (oid,))
    deleted_rows = cur.rowcount
    mysql.connection.commit()
    
    if deleted_rows == 0:
        return err("Không thể xóa đơn hàng", 400)
    
    print(f"[ADMIN-ORDERS][DELETE] ✅ Đã xóa đơn hàng #{oid} (trạng thái: {order.get('trangthai', 'N/A')})")
    
    return ok({"message": f"Đã xóa đơn hàng #{oid}"})

@admin_orders_bp.get("/reports/revenue")
@admin_required
def admin_report_revenue():
    """
    Báo cáo doanh thu theo ngày:
      - Tham số: from, to, status (thường dùng PAID)
      - Trả về: { items: [{date, total, count}], summary: {sum, count} }
    Dùng cho biểu đồ & KPI.
    """
    mysql = get_mysql()

    status = request.args.get("status", "Đã thanh toán").strip()  # mặc định Đã thanh toán
    d_from = _parse_date(request.args.get("from", "") or "")
    d_to   = _parse_date(request.args.get("to", "") or "")

    wheres, params = [], []
    if status:
        wheres.append("trangthai=%s")
        params.append(status)
    if d_from:
        wheres.append("DATE(thoigian) >= %s")
        params.append(d_from.isoformat())
    if d_to:
        wheres.append("DATE(thoigian) <= %s")
        params.append(d_to.isoformat())

    where_sql = ("WHERE " + " AND ".join(wheres)) if wheres else ""

    cur = mysql.connection.cursor()
    cur.execute(f"""
        SELECT DATE(created_at) AS d,
               SUM(tongtien) AS total,
               COUNT(*)      AS cnt
        FROM orders
        {where_sql}
        GROUP BY DATE(created_at)
        ORDER BY d ASC
    """, tuple(params))
    rows = cur.fetchall() or []

    # tổng hợp
    s_sum = sum(float(r["total"] or 0) for r in rows)
    s_cnt = sum(int(r["cnt"] or 0) for r in rows)
    items = [{"date": str(r["d"]), "total": float(r["total"] or 0), "count": int(r["cnt"] or 0)} for r in rows]

    return ok({"items": items, "summary": {"sum": s_sum, "count": s_cnt}})

@admin_orders_bp.get("/stats/summary")
@admin_required
def admin_stats_summary():
    """
    Tóm tắt nhanh cho dashboard:
      - tổng sản phẩm đang DANG_BAN
      - tổng đơn (mọi trạng thái)
      - tổng đơn PAID + tổng doanh thu PAID
    """
    mysql = get_mysql()
    cur = mysql.connection.cursor()

    # Đồng bộ enum với DB: 'Đang bán' / 'Ngừng bán'
    cur.execute("SELECT COUNT(*) AS c FROM products WHERE trang_thai='Đang bán'")
    active_products = (cur.fetchone() or {}).get("c", 0)

    cur.execute("SELECT COUNT(*) AS c FROM orders")
    orders_all = (cur.fetchone() or {}).get("c", 0)

    cur.execute("SELECT COUNT(*) AS c, COALESCE(SUM(tongtien),0) AS s FROM orders WHERE trangthai='Đã thanh toán'")
    row = cur.fetchone() or {}
    paid_count = int(row.get("c", 0) or 0)
    paid_sum = float(row.get("s", 0.0) or 0.0)

    return ok({
        "active_products": active_products,
        "orders_all": orders_all,
        "paid_count": paid_count,
        "paid_sum": paid_sum
    })
