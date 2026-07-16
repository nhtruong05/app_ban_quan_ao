from flask import jsonify, request, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
from functools import wraps
import hashlib, hmac
import urllib.parse as urlparse

# ==== JSON helpers ====
def ok(data=None, status=200):
    return jsonify({"success": True, "data": data}), status

def err(message, status=400):
    return jsonify({"success": False, "message": message}), status

# ==== misc helpers ====
def to_float(v, default=0.0):
    try:
        return float(v)
    except Exception:
        return default

def client_ip():
    if "X-Forwarded-For" in request.headers:
        return request.headers.get("X-Forwarded-For").split(",")[0].strip()
    return request.remote_addr or "127.0.0.1"

def hmac_sha512(secret, data):
    return hmac.new(secret.encode("utf-8"), data.encode("utf-8"), hashlib.sha512).hexdigest()

def sort_and_query(params: dict, encode: bool = True):
    ordered = sorted(params.items())
    query = []
    for k, v in ordered:
        if v is not None and v != "":

            val = urlparse.quote_plus(str(v)) if encode else str(v)
            query.append(f"{k}={val}")
    return "&".join(query)
def get_mysql():
    mysql = current_app.config.get("MYSQL_EXT")
    if mysql is None:
        raise RuntimeError("MYSQL_EXT chưa được gắn vào app.config (init_extensions chưa chạy?)")
    return mysql

# ==== role guard cho admin ====
def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt() or {}
        # Chỉ cho phép nếu token có claim is_admin=True
        if not claims or not claims.get("is_admin"):
            return err("Forbidden", 403)
        return fn(*args, **kwargs)
    return wrapper
# ==== avatar helpers ====
def get_current_user_id():
    from flask_jwt_extended import get_jwt_identity
    ident = str(get_jwt_identity())
    if ident.startswith("admin:"):
        return None
    try:
        return int(ident)
    except ValueError:
        return None
    
from urllib.parse import urljoin
from flask import request, current_app

def public_base() -> str:
    base = current_app.config.get("PUBLIC_BASE_URL") or request.url_root
    if not base.endswith("/"):
        base += "/"
    return base

def abs_img(url_or_path):
    if not url_or_path:
        return None
    s = str(url_or_path).strip()
    if s.startswith("http://") or s.startswith("https://"):
        return s
    if not s.startswith("/"):
        s = "/" + s
    return urljoin(public_base(), s.lstrip("/"))