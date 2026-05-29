# payments_vnpay.py
from flask import Blueprint, request, jsonify
from utils import hmac_sha512, sort_and_query, get_mysql
import os
from urllib.parse import urlparse
from datetime import datetime, timedelta

vnpay_bp = Blueprint("vnpay", __name__)

# ============================================================
# Cấu hình môi trường
# ============================================================
def get_vnpay_config():
    return {
        "PUBLIC_BASE_URL": os.getenv("PUBLIC_BASE_URL", "").rstrip("/"),
        "VNPAY_RETURN_URL": os.getenv("VNPAY_RETURN_URL", "").strip(),
        "VNPAY_IPN_URL": os.getenv("VNPAY_IPN_URL", "").strip(),
        "VNPAY_TMN_CODE": os.getenv("VNPAY_TMN_CODE", "").strip(),
        "VNPAY_HASH_SECRET": os.getenv("VNPAY_HASH_SECRET", "").strip(),
        "VNPAY_PAYMENT_URL": os.getenv("VNPAY_PAYMENT_URL", "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html").strip(),
        "VNPAY_VERSION": os.getenv("VNPAY_VERSION", "2.1.0"),
        "DEV_FORCE_RETURN_UPDATE": os.getenv("DEV_FORCE_RETURN_UPDATE", "true").lower() == "true"
    }

# ============================================================
# URL helpers
# ============================================================
def _public_base_url():
    cfg = get_vnpay_config()
    if cfg["PUBLIC_BASE_URL"]:
        return cfg["PUBLIC_BASE_URL"]

    for u in (cfg["VNPAY_RETURN_URL"], cfg["VNPAY_IPN_URL"]):
        if u:
            try:
                p = urlparse(u)
                if p.scheme and p.netloc:
                    return f"{p.scheme}://{p.netloc}".rstrip("/")
            except Exception:
                pass

    scheme = request.headers.get("X-Forwarded-Proto", request.scheme)
    host = request.headers.get("X-Forwarded-Host", request.host)
    return f"{scheme}://{host}".rstrip("/")

def get_vnpay_urls():
    """Trả về (return_url, ipn_url) hợp lệ dựa theo ENV hoặc base hiện tại"""
    cfg = get_vnpay_config()
    if cfg["VNPAY_RETURN_URL"] and cfg["VNPAY_IPN_URL"]:
        return cfg["VNPAY_RETURN_URL"], cfg["VNPAY_IPN_URL"]
    base = _public_base_url()
    return f"{base}/api/vnpay_return", f"{base}/api/vnpay_ipn"

# ============================================================
# Tạo URL thanh toán
# ============================================================
def build_vnpay_payment_url(amount_vnd, order_id: str, order_info: str, ip_addr: str, return_url: str):
    """
    amount_vnd: số tiền VND (ví dụ 1000000.00). Gửi cho VNPAY phải *100*
    """
    cfg = get_vnpay_config()
    try:
        vnp_amount = int(round(float(amount_vnd) * 100))
    except Exception:
        vnp_amount = 0

    params = {
        "vnp_Version": cfg["VNPAY_VERSION"],
        "vnp_Command": "pay",
        "vnp_TmnCode": cfg["VNPAY_TMN_CODE"],
        "vnp_Amount": str(vnp_amount),
        "vnp_CurrCode": "VND",
        "vnp_TxnRef": str(order_id),
        "vnp_OrderInfo": order_info,
        "vnp_OrderType": "other",
        "vnp_Locale": "vn",
        "vnp_ReturnUrl": return_url,
        "vnp_IpAddr": "127.0.0.1",
        "vnp_CreateDate": datetime.now().strftime("%Y%m%d%H%M%S"),
        "vnp_ExpireDate": (datetime.now() + timedelta(minutes=15)).strftime("%Y%m%d%H%M%S"),
    }

    raw = sort_and_query(params)
    secure_hash = hmac_sha512(cfg["VNPAY_HASH_SECRET"], raw) if cfg["VNPAY_HASH_SECRET"] else ""
    qs = raw + "&vnp_SecureHashType=HmacSHA512" + f"&vnp_SecureHash={secure_hash}"
    return f"{cfg['VNPAY_PAYMENT_URL']}?{qs}"

# ============================================================
# Checksum
# ============================================================
def verify_vnp_checksum(params: dict) -> bool:
    cfg = get_vnpay_config()
    vnp_secure_hash = params.get("vnp_SecureHash", "")
    data = {k: v for k, v in params.items() if k not in ("vnp_SecureHash", "vnp_SecureHashType") and v is not None}
    raw = sort_and_query(data)
    calc = hmac_sha512(cfg["VNPAY_HASH_SECRET"], raw)
    return calc.upper() == vnp_secure_hash.upper()

# ============================================================
# Return URL (người dùng redirect sau thanh toán)
# ============================================================
@vnpay_bp.get("/vnpay_return")
def vnpay_return():
    cfg = get_vnpay_config()
    params = dict(request.args.items())
    if not params:
        return jsonify({"valid_checksum": False, "result": "Thiếu tham số"}), 400

    valid = verify_vnp_checksum(params) if cfg["VNPAY_HASH_SECRET"] else False
    resp_code = params.get("vnp_ResponseCode")
    trans_status = params.get("vnp_TransactionStatus")
    txn_ref = params.get("vnp_TxnRef")
    txn_no = params.get("vnp_TransactionNo")

    result = "Thành công" if (valid and resp_code == "00" and trans_status == "00") else "Lỗi"

    # Cập nhật đơn hàng khi thanh toán thành công
    if result == "Thành công" and txn_ref:
        try:
            mysql = get_mysql()
            cur = mysql.connection.cursor()
            # Kiểm tra status hiện tại
            cur.execute("SELECT trangthai FROM orders WHERE id=%s", (int(txn_ref),))
            order = cur.fetchone()
            # Chỉ update nếu chưa thanh toán
            if order and order.get("trangthai") != "Đã thanh toán":
                cur.execute("UPDATE orders SET trangthai='Đã thanh toán', payment_token=%s WHERE id=%s",
                            (f"VNPAY_TXN:{txn_no or 'n/a'}", int(txn_ref)))
                mysql.connection.commit()
                print(f"[VNPAY-RETURN] ✅ Đã cập nhật đơn hàng #{txn_ref} thành 'Đã thanh toán'")
            else:
                print(f"[VNPAY-RETURN] ⚠️  Đơn hàng #{txn_ref} đã được thanh toán trước đó")
        except Exception as e:
            print(f"[VNPAY-RETURN] ❌ Lỗi cập nhật đơn hàng: {e}")
            import traceback
            traceback.print_exc()
    elif result != "Thành công" and txn_ref:
        # Nếu thanh toán thất bại, chuyển sang "Hủy"
        try:
            mysql = get_mysql()
            cur = mysql.connection.cursor()
            cur.execute("UPDATE orders SET trangthai='Hủy', payment_token=%s WHERE id=%s",
                        (f"VNPAY_FAIL:{resp_code}", int(txn_ref)))
            mysql.connection.commit()
        except Exception as e:
            print(f"VNPay return fail update error: {e}")

    return jsonify({
        "valid_checksum": valid,
        "vnp_ResponseCode": resp_code,
        "vnp_TransactionStatus": trans_status,
        "vnp_TxnRef": txn_ref,
        "vnp_Amount": params.get("vnp_Amount"),
        "result": result
    })

# ============================================================
# IPN URL (server-to-server callback)
# ============================================================
@vnpay_bp.get("/vnpay_ipn")
def vnpay_ipn():
    cfg = get_vnpay_config()
    params = dict(request.args.items())

    if not params:
        return jsonify({"RspCode": "99", "Message": "Invalid request"})
    if not cfg["VNPAY_HASH_SECRET"]:
        return jsonify({"RspCode": "99", "Message": "Server not configured"})
    if not verify_vnp_checksum(params):
        return jsonify({"RspCode": "97", "Message": "Invalid Signature"})

    vnp_txnref = params.get("vnp_TxnRef")
    vnp_amount_raw = params.get("vnp_Amount")
    vnp_resp_code = params.get("vnp_ResponseCode")
    vnp_trans_status = params.get("vnp_TransactionStatus")
    vnp_trans_no = params.get("vnp_TransactionNo")

    try:
        order_id = int(vnp_txnref)
    except:
        return jsonify({"RspCode": "01", "Message": "Order not found"})

    mysql = get_mysql()
    cur = mysql.connection.cursor()
    cur.execute("SELECT id AS order_id, tongtien, trangthai FROM orders WHERE id=%s", (order_id,))
    order = cur.fetchone()
    if not order:
        return jsonify({"RspCode": "01", "Message": "Order not found"})

    try:
        vnp_amount = int(vnp_amount_raw)
    except:
        return jsonify({"RspCode": "04", "Message": "Invalid amount"})

    expected = int(round(float(order["tongtien"]) * 100))
    if vnp_amount != expected:
        return jsonify({"RspCode": "04", "Message": "Invalid amount"})

    if order["trangthai"] == "Đã thanh toán":
        return jsonify({"RspCode": "02", "Message": "Order Already Update"})

    if vnp_resp_code == "00" and vnp_trans_status == "00":
        # Thanh toán thành công - cập nhật status thành "Đã thanh toán"
        cur.execute("UPDATE orders SET trangthai='Đã thanh toán', payment_token=%s WHERE id=%s",
                    (f"VNPAY_TXN:{vnp_trans_no}", order_id))
        mysql.connection.commit()
        print(f"[VNPAY-IPN] ✅ Đã cập nhật đơn hàng #{order_id} thành 'Đã thanh toán' (TXN: {vnp_trans_no})")
        return jsonify({"RspCode": "00", "Message": "Confirm Success"})
    else:
        # Thanh toán thất bại - cập nhật status thành "Hủy"
        cur.execute("UPDATE orders SET trangthai='Hủy', payment_token=%s WHERE id=%s",
                    (f"VNPAY_FAIL:{vnp_resp_code}", order_id))
        mysql.connection.commit()
        print(f"[VNPAY-IPN] ❌ Đơn hàng #{order_id} thanh toán thất bại (Code: {vnp_resp_code})")
        return jsonify({"RspCode": "00", "Message": "Confirm Success"})
