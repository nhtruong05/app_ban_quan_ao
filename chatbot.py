# chatbot.py
from flask import Blueprint, request
from utils import ok, err, get_mysql
from datetime import datetime, date
import os, json, unicodedata, re
from decimal import Decimal
import numpy as np
from typing import List, Dict, Any
import sys

# Fix encoding cho Windows console
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        pass

from dotenv import load_dotenv
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# --- RAG / Embedding / Chroma / Gemini ---
import chromadb
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted, GoogleAPICallError

chatbot_bp = Blueprint("chatbot", __name__)

# ============ ENV & Global Config ============
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")
os.makedirs(CHROMA_PATH, exist_ok=True)

KNOWLEDGE_PATH = os.path.join(BASE_DIR, "data", "knowledge_seed.json")

try:
    chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)  # type: ignore
    _needs_persist = False  # PersistentClient tự động persist
except Exception:
    from chromadb.config import Settings
    chroma_client = chromadb.Client(Settings(persist_directory=CHROMA_PATH))
    _needs_persist = True  # Client cũ cần gọi persist()

# Nhẹ và nhanh, phù hợp tìm top-k
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# Model Gemini
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "").strip() or "gemini-2.0-flash"
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "").strip()

GENERATION_CONFIG = {
    "temperature": 0.6,
    "top_p": 0.9,
    "top_k": 40,
    "max_output_tokens": 512,
}
SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUAL", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]

_GEMINI = {"ready": False, "primary": None, "fallback": None}

def _normalize_name(name: str) -> str:
    return (name or "").strip()

def _ensure_gemini():
    """Khởi tạo Gemini 1 lần, tự động fallback."""
    if _GEMINI["ready"]:
        return
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("Thiếu GEMINI_API_KEY/GOOGLE_API_KEY trong môi trường")
    genai.configure(api_key=key)

    preferred = [
    _normalize_name(GEMINI_MODEL_NAME),
    _normalize_name(GEMINI_FALLBACK_MODEL),
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
]
    preferred = [m for m in preferred if m]
    preferred = list(dict.fromkeys(preferred))

    supported_names = set()
    try:
        models = list(genai.list_models())
        for m in models:
            methods = set(getattr(m, "supported_generation_methods", []) or [])
            if "generateContent" in methods:
                supported_names.add(m.name)
                if m.name.startswith("models/"):
                    supported_names.add(m.name.split("models/", 1)[1])
    except Exception:
        supported_names.update(preferred)

    def pick_first_available(cands):
        for name in cands:
            if name in supported_names:
                return "models/" + name if not name.startswith("models/") else name
        return None

    primary_name = pick_first_available(preferred)
    if not primary_name:
        raise RuntimeError("Không tìm thấy model Gemini hỗ trợ generateContent.")
    fallback_name = pick_first_available([m for m in preferred if m != primary_name.replace("models/","")])

    _GEMINI["primary"]  = genai.GenerativeModel(primary_name, generation_config=GENERATION_CONFIG, safety_settings=SAFETY_SETTINGS)
    _GEMINI["fallback"] = genai.GenerativeModel(fallback_name, generation_config=GENERATION_CONFIG, safety_settings=SAFETY_SETTINGS) if fallback_name else None
    _GEMINI["ready"] = True

PROMPT_PATH = os.getenv("PROMPT_PATH", os.path.join(BASE_DIR, "prompts", "chatbot_prompt.txt"))
_prompt_cache = {"mtime": None, "text": "", "path": PROMPT_PATH}

DEBUG_CHAT = os.getenv("CHATBOT_DEBUG", "false").lower() in ("1", "true", "yes")

# ============ Helpers ============
def _to_primitive(v):
    if isinstance(v, Decimal): return float(v)
    if isinstance(v, (np.floating, np.integer)): return float(v)
    if isinstance(v, (datetime, date)): return v.isoformat()
    if isinstance(v, bytes):
        try: return v.decode("utf-8", errors="ignore")
        except Exception: return str(v)
    if isinstance(v, (list, dict, tuple, set)):
        try: return json.dumps(v, ensure_ascii=False)
        except Exception: return str(v)
    if v is None or isinstance(v, (str, int, float, bool)): return v
    return str(v)

def _row_to_metadata(row: dict) -> dict:
    return {k: _to_primitive(v) for k, v in row.items()}

def _row_to_document(row: dict) -> str:
    """Chuyển 1 row product -> text document cho embedding."""
    lines, preferred, seen = [], [
        "products_id","ten_san_pham","mo_ta","gia_ban",
        "loai","size","chat_lieu","gioi_tinh","trang_thai"
    ], set()
    for k in preferred:
        if k in row:
            v = _to_primitive(row[k])
            lines.append(f"{k}: {'' if v is None else str(v)}")
            seen.add(k)
    for k, v in row.items():
        if k in seen: continue
        vv = _to_primitive(v)
        lines.append(f"{k}: {'' if vv is None else str(vv)}")
    return "\n".join(lines)

def reformulate_query(user_query: str) -> str:
    """Chuyển câu hỏi người dùng thành truy vấn logic rõ ràng hơn."""
    if not user_query or len(user_query.strip()) < 3:
        return user_query
    
        # Danh sách các từ khóa người dùng → từ khóa hệ thống
    query_expansions = {
        # Giá cả
        "rẻ": "giá thấp",
        "rẻ tiền": "giá thấp",
        "đắt": "giá cao",
        "giá vừa phải": "giá trung bình",
        # Pattern matching cho giá dưới X
        "dưới 400k": "giá dưới 400000",
        "dưới 300k": "giá dưới 300000",
        "dưới 500k": "giá dưới 500000",
        "dưới 200k": "giá dưới 200000",
        "dưới 100k": "giá dưới 100000",
        
        # Sản phẩm
        "áo sơ mi": "áo sơ mi",
        "quần short": "quần ngắn",
        "đầm": "đầm nữ",
        "váy": "váy nữ",
        "áo thun": "áo phông",
        
        # Size
        "người gầy": "size nhỏ",
        "người ốm": "size nhỏ",
        "mập": "size lớn",
        "béo": "size lớn",
        "cao": "size L hoặc XL",
        "thấp": "size S hoặc M",
        
        # Chất liệu/thời tiết
        "mùa hè": "chất liệu mát, cotton, thoáng khí",
        "mùa đông": "chất liệu ấm, len, giữ nhiệt",
        "mùa xuân": "chất liệu thoáng, vải mỏng",
        "mùa thu": "chất liệu vừa phải, thông thoáng",
        "mùa mưa": "chất liệu chống nước",
        "trời nóng": "chất liệu thoáng mát",
        "trời lạnh": "chất liệu giữ ấm",
        "nắng nóng": "chất liệu mát, cotton, thoáng khí",
        "gió lạnh": "chất liệu ấm, len",
        "trời mưa": "chất liệu chống nước",
        
        # Màu sắc
        "màu tối": "màu đen hoặc xám",
        "màu sáng": "màu trắng hoặc pastel",
        
        # Giới tính
        "cho nam": "nam giới",
        "cho nữ": "nữ giới",
        "unisex": "cả nam và nữ"
    }
    
    # Pattern matching cho giá dưới Xk hoặc dưới X000
    reformulated = user_query.lower()
    
    # Tìm pattern "dưới Xk" hoặc "dưới X000" và thay thế
    price_pattern = re.search(r'dưới\s*(\d+)\s*k', reformulated)
    if price_pattern:
        amount = int(price_pattern.group(1))
        reformulated = reformulated.replace(price_pattern.group(0), f'giá dưới {amount * 1000}')
    
    # Tìm và thay thế các từ khóa khác
    for user_kw, system_kw in query_expansions.items():
        if user_kw in reformulated:
            reformulated = reformulated.replace(user_kw, system_kw)
    
    # Trả về query gốc nếu không có thay đổi
    if reformulated == user_query.lower():
        return user_query
    
    # Combine original + reformulated cho better search
    combined = f"{user_query} {reformulated}"
    return combined

def _load_prompt_text() -> str:
    """Lazy load prompt, có prompt mặc định nếu chưa tạo file."""
    path = _prompt_cache["path"]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    default_text = """Bạn là **1994 closet Assistant**, một chatbot bán hàng trực tuyến của cửa hàng thời trang **1994 closet**.  
Nhiệm vụ của bạn là tư vấn sản phẩm, size, chất liệu, chính sách mua sắm và hướng dẫn chăm sóc quần áo cho khách hàng.  

**QUAN TRỌNG - HIỂU Ý ĐỊNH NGƯỜI DÙNG:**
Bạn phải **HIỂU Ý ĐỊNH** của người dùng chứ không chỉ tìm từ khóa. Hãy suy luận logic từ câu hỏi:
- Người dùng có thể hỏi gián tiếp, nói vòng vo, hoặc dùng từ khác để chỉ cùng ý định
- Ví dụ: "mình muốn cái nào mặc mát" = tìm sản phẩm chất liệu thoáng mát cho mùa hè
- Ví dụ: "có ship không shop" = hỏi về chính sách vận chuyển
- Ví dụ: "nên mặc size gì nếu mình 165cm" = hỏi về hướng dẫn chọn size

Người dùng hỏi: "{query}"

Bối cảnh sản phẩm (tối đa 3 kết quả gần nhất):  
{context}

**HƯỚNG DẪN TRẢ LỜI THEO NGỮ CẢNH:**

1. **HIỂU CÂU HỎI CỦA NGƯỜI DÙNG:** 
   - Đọc kỹ để hiểu họ đang muốn gì (tìm sản phẩm, hỏi chính sách, tư vấn size, v.v.)
   - Người dùng có thể hỏi theo nhiều cách khác nhau, bạn phải nhận ra ý định thực sự

2. **Nếu khách hỏi về SẢN PHẨM:**
   - **QUAN TRỌNG: Trả lời CỤ THỂ tên sản phẩm, giá, size, chất liệu**
   - Nếu user hỏi về mùa/ thời tiết → gợi ý sản phẩm PHÙ HỢP với mùa đó
   - Ví dụ: "mùa hè mặc áo gì" → đưa ra ÁO COTTON cụ thể (không chỉ nói "áo cotton")
   - Ví dụ: "trời lạnh" → đưa ra ÁO LEN/DẠ cụ thể (không chỉ nói "áo len")
   - Nếu không có sản phẩm phù hợp → vẫn đưa ra sản phẩm gần nhất và giải thích vì sao
   - Luôn kèm theo: tên sản phẩm, giá (VND), size, chất liệu

3. **Nếu khách hỏi về SIZE:**
   - Tư vấn size dựa trên chiều cao, cân nặng, vòng eo
   - Trích dẫn bảng size từ context nếu có
   - Nếu người dùng nói "mình cao X" → đưa ra size gợi ý

4. **Nếu khách hỏi về CHẤT LIỆU HOẶC THỜI TIẾT:**
   - **Phải đưa ra SẢN PHẨM CỤ THỂ chứ không chỉ tư vấn chất liệu**
   - Ví dụ: "mùa hè mặc áo gì" → trả lời "Áo cotton ABC (200k), Áo thun XYZ (150k)..."
   - Ví dụ: "trời lạnh" → trả lời "Áo len DCE (400k), Áo khoác dạ EFG (350k)..."
   - Giải thích vì sao sản phẩm đó phù hợp với mùa/thời tiết

5. **Nếu khách hỏi về CHÍNH SÁCH:**
   - Trích dẫn chính xác thông tin từ context
   - Ví dụ: hỏi giờ làm việc → trả lời giờ mở cửa/đóng cửa chính xác
   - Ví dụ: hỏi đổi trả → trả lời chính sách đổi trả chi tiết

6. **Nếu khách hỏi về CHĂM SÓC/BẢO QUẢN:**
   - Trích dẫn hướng dẫn chăm sóc cho chất liệu cụ thể
   - Ví dụ: "giặt áo cotton" → hướng dẫn giặt cotton

7. **KHI KHÔNG TÌM THẤY:**
   - Trả lời thân thiện: "Mình chưa tìm thấy sản phẩm phù hợp với yêu cầu."
   - Gợi ý cách tìm kiếm khác: "Bạn có thể thử lọc theo loại/size/chất liệu/giá."

8. **KHÔNG:**
   - Không bịa đặt thông tin không có trong dữ liệu
   - Không trả lời mơ hồ, phải cụ thể và chi tiết
   - Không dùng thuật ngữ kỹ thuật phức tạp, dùng ngôn ngữ tự nhiên

9. **PHONG CÁCH:**
   - Văn phong thân thiện, nhiệt tình, rõ ràng như nhân viên bán hàng thật
   - Trả lời bằng tiếng Việt
   - Tự nhiên, không robot
   - Rõ ràng, chi tiết về sản phẩm/chính sách mà người dùng quan tâm"""
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(default_text)
    mtime = os.path.getmtime(path)
    if _prompt_cache["mtime"] != mtime:
        with open(path, "r", encoding="utf-8") as f:
            _prompt_cache["text"] = f.read()
        _prompt_cache["mtime"] = mtime
    return _prompt_cache["text"]

class _SafeDict(dict):
    def __missing__(self, key): return "{" + key + "}"

def _gemini_text_and_reason(resp):
    try:
        txt = getattr(resp, "text", "") or ""
        reason = ""
        pf = getattr(resp, "prompt_feedback", None)
        if pf and getattr(pf, "block_reason", None):
            reason = f"blocked: {pf.block_reason}"
        cands = getattr(resp, "candidates", []) or []
        if cands:
            fr = getattr(cands[0], "finish_reason", None)
            if fr: reason = f"finish_reason={fr}" if not reason else f"{reason}; finish_reason={fr}"
            if not txt:
                try:
                    parts = []
                    content = getattr(cands[0], "content", None)
                    for p in getattr(content, "parts", []) or []:
                        val = getattr(p, "text", None)
                        if isinstance(val, str): parts.append(val)
                    txt = "\n".join(parts)
                except Exception: pass
        return (txt or ""), reason
    except Exception:
        return "", ""

def _call_gemini_with_fallback(prompt: str) -> str:
    _ensure_gemini()

    def _call(model, tag: str):
        r = model.generate_content(prompt)
        t, why = _gemini_text_and_reason(r)
        if not t:
            print(f"[GEMINI] {tag} empty - reason: {why}")
        else:
            print(f"[GEMINI] {tag} OK - {len(t)} chars")
        return t

    try:
        print(f"[GEMINI] Calling primary: {_GEMINI['primary'].model_name}")
        t = _call(_GEMINI["primary"], "primary")
        if t: return t

        if _GEMINI["fallback"]:
            print(f"[GEMINI] Calling fallback: {_GEMINI['fallback'].model_name}")
            t2 = _call(_GEMINI["fallback"], "fallback")
            if t2: return t2

        print("[GEMINI] Both primary and fallback returned empty!")
        return ""

    except ResourceExhausted as e:
        print(f"[GEMINI] ❌ ResourceExhausted (hết quota): {e}")
        if _GEMINI["fallback"]:
            try:
                r = _GEMINI["fallback"].generate_content(prompt)
                t, _ = _gemini_text_and_reason(r)
                if t: return t
            except Exception as fe:
                print(f"[GEMINI] ❌ Fallback also failed: {fe}")
        return ""

    except GoogleAPICallError as e:
        print(f"[GEMINI] ❌ GoogleAPICallError: {e}")
        return ""

    except Exception as e:
        print(f"[GEMINI] ❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return ""

def _strip_accents(s: str) -> str:
    if not s: return s
    nfkd = unicodedata.normalize("NFD", s)
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch))

# ============ Intent Templates ============
INTENT_TEMPLATES = {
    "policy": [
        "hỏi về chính sách đổi trả",
        "chính sách bảo hành như thế nào",
        "địa chỉ cửa hàng ở đâu",
        "giờ mở cửa cửa hàng",
        "hình thức thanh toán",
        "vận chuyển có phí không",
        "có hỗ trợ COD không",
        "shipping có mất phí không"
    ],
    "size": [
        "chọn size phù hợp",
        "mình cao 165 mặc size nào",
        "hướng dẫn chọn size",
        "bảng size quần áo",
        "vòng eo size M",
        "cao nặng bao nhiêu mặc size L"
    ],
    "care": [
        "giặt quần áo như thế nào",
        "bảo quản áo sơ mi",
        "có được ủi không",
        "phơi ở đâu",
        "chăm sóc vải cotton",
        "cách giặt áo không bị co"
    ],
    "material": [
        "chất liệu phù hợp mùa hè",
        "áo gì mặc mùa đông",
        "vải cotton có nóng không",
        "chất liệu giữ ấm",
        "quần áo chống nắng",
        "vải mặc mùa mưa"
    ],
    "product": [
        "tìm áo sơ mi nam",
        "sản phẩm giá dưới 300k",
        "áo thun giá rẻ",
        "quần jean nữ",
        "đầm dự tiệc",
        "áo khoác gió"
    ]
}

def detect_intent_semantic(q: str) -> str:
    """Phân loại intent bằng semantic similarity thay vì keyword matching."""
    if not q or len(q.strip()) < 3:
        return "product"
    
    try:
        # Tạo embedding cho câu hỏi
        q_emb = embedding_model.encode([q.lower()], convert_to_numpy=True)[0]
        
        # Tạo embeddings cho các intent templates
        max_similarity = -1
        best_intent = "product"
        
        for intent, templates in INTENT_TEMPLATES.items():
            # Encode tất cả templates của intent này
            template_embs = embedding_model.encode(templates, convert_to_numpy=True)
            
            # Tính cosine similarity với từng template
            similarities = np.dot(template_embs, q_emb) / (
                np.linalg.norm(template_embs, axis=1) * np.linalg.norm(q_emb)
            )
            
            # Lấy similarity cao nhất trong intent này
            max_sim = float(np.max(similarities))
            
            if max_sim > max_similarity:
                max_similarity = max_sim
                best_intent = intent
        
        # Ngưỡng để quyết định intent (có thể điều chỉnh)
        if max_similarity < 0.3:
            return "product"  # Mặc định là tìm sản phẩm
        
        return best_intent
    except Exception as e:
        print(f"[INTENT] Error in semantic detection: {e}")
        # Fallback về keyword-based
        return detect_intent_keyword(q)

def detect_intent_keyword(q: str) -> str:
    """Fallback: phân loại intent bằng keyword matching (cho backward compatibility)."""
    ql = (q or "").lower()
    qn = _strip_accents(ql)
    policy_kw   = ["doi","tra","chinh sach","bao hanh","ship","van chuyen","thanh toan","cod","vnpay",
                   "gio mo cua","gio lam viec","dia chi","lien he","shop","cua hang"]
    size_kw     = ["size","co","vua khong","cao","nang","vong eo","eo","mac size gi"]
    care_kw     = ["giat","bao quan","ui","phoi","giat may","lau sach","cham soc"]
    material_kw = ["chat lieu","thoi tiet","mua","nang","lanh","nong"]

    if any(k in qn for k in policy_kw) or any(k in ql for k in ["đổi","trả","chính sách","bảo hành","vận chuyển","giờ mở cửa","địa chỉ","liên hệ"]):
        return "policy"
    if any(k in qn for k in size_kw) or any(k in ql for k in ["cỡ","vừa không","vòng eo","mặc size gì"]):
        return "size"
    if any(k in qn for k in care_kw) or any(k in ql for k in ["giặt","bảo quản","ủi","phơi","giặt máy","chăm sóc"]):
        return "care"
    if any(k in qn for k in material_kw) or any(k in ql for k in ["chất liệu","thời tiết","mưa","nắng","lạnh","nóng"]):
        return "material"
    return "product"

def detect_intent(q: str) -> str:
    """Main intent detection function - uses semantic by default."""
    return detect_intent_semantic(q)

# ============ Chroma Utilities ============
def get_or_create(name: str):
    return chroma_client.get_or_create_collection(name=name)

def upsert_docs(collection_name: str, docs: List[Dict[str, Any]]):
    if not docs: return 0
    coll = get_or_create(collection_name)
    texts = [d["document"] for d in docs]
    ids = [d["id"] for d in docs]
    metas = [d.get("metadata", {}) for d in docs]
    embs = embedding_model.encode(texts, convert_to_numpy=True)
    coll.upsert(embeddings=embs.tolist(), documents=texts, metadatas=metas, ids=ids)
    return len(docs)

# --- Sync 1 sản phẩm theo ID (CRUD hook) ---
def sync_one_product_to_chroma(product_id: int):
    mysql = get_mysql()
    cur = mysql.connection.cursor()
    cur.execute("SELECT * FROM products WHERE products_id=%s", (product_id,))
    row = cur.fetchone()
    coll = get_or_create("products")

    if not row:  # đã xoá ở MySQL -> xoá Chroma
        try:
            print(f"[SYNC-ONE] 🗑️  Sản phẩm #{product_id} không tồn tại trong MySQL, đang xóa khỏi ChromaDB...")
            coll.delete(ids=[str(product_id)])
            if _needs_persist:
                chroma_client.persist()
            print(f"[SYNC-ONE] ✅ Đã xóa sản phẩm #{product_id} khỏi ChromaDB")
            return {"deleted": True}
        except Exception as e:
            print(f"[SYNC-ONE] ❌ Lỗi xóa sản phẩm #{product_id} khỏi ChromaDB: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    try:
        doc = _row_to_document(row)
        print(f"[SYNC-ONE] 📝 Đang tạo embedding cho sản phẩm #{product_id}...")
        emb = embedding_model.encode([doc], convert_to_numpy=True).tolist()[0]
        meta = _row_to_metadata(row)
        print(f"[SYNC-ONE] 💾 Đang lưu sản phẩm #{product_id} vào ChromaDB...")
        coll.upsert(ids=[str(product_id)], documents=[doc], embeddings=[emb], metadatas=[meta])
        if _needs_persist:
            chroma_client.persist()
        print(f"[SYNC-ONE] ✅ Đã upsert sản phẩm #{product_id} vào ChromaDB (tên: {row.get('ten_san_pham', 'N/A')})")
        return {"upserted": True}
    except Exception as e:
        print(f"[SYNC-ONE] ❌ Lỗi upsert sản phẩm #{product_id}: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

def delete_product_from_chroma(product_id: int):
    try:
        print(f"[SYNC-DEL] 🗑️  Đang xóa sản phẩm #{product_id} khỏi ChromaDB...")
        get_or_create("products").delete(ids=[str(product_id)])
        if _needs_persist:
            chroma_client.persist()
        print(f"[SYNC-DEL] ✅ Đã xóa sản phẩm #{product_id} khỏi ChromaDB")
        return {"deleted": True}
    except Exception as e:
        print(f"[SYNC-DEL] ❌ Lỗi xóa sản phẩm #{product_id} khỏi ChromaDB: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

# ============ Sync MySQL -> Chroma (products) ============
def sync_mysql_to_chromadb():
    print(f"\n{'='*60}")
    print(f"[SYNC] 🔄 Bắt đầu đồng bộ toàn bộ sản phẩm từ MySQL sang ChromaDB...")
    mysql = get_mysql()
    cur = mysql.connection.cursor()
    cur.execute("SELECT * FROM products")
    products = cur.fetchall() or []

    collection = get_or_create("products")
    if not products:
        print("[SYNC] ⚠️  Bảng products rỗng - không có gì để đồng bộ.")
        print(f"{'='*60}\n")
        return 0

    print(f"[SYNC] 📊 Tìm thấy {len(products)} sản phẩm trong MySQL")
    print(f"[SYNC] 📝 Đang tạo embeddings cho {len(products)} sản phẩm...")
    
    enriched = [dict(p) for p in products]
    documents = [_row_to_document(p) for p in enriched]
    embeddings = embedding_model.encode(documents, convert_to_numpy=True)
    metadatas = [_row_to_metadata(p) for p in enriched]

    def _extract_id(row):
        if "products_id" in row: return str(row["products_id"])
        if "id" in row: return str(row["id"])
        if "product_id" in row: return str(row["product_id"])
        raise ValueError("Khong tim thay PK cho products")

    ids = [_extract_id(p) for p in enriched]

    print(f"[SYNC] 💾 Đang upsert {len(enriched)} sản phẩm vào ChromaDB (sẽ UPDATE nếu đã tồn tại, INSERT nếu chưa có)...")
    collection.upsert(
        embeddings=embeddings.tolist(),
        documents=documents,
        metadatas=metadatas,
        ids=ids,
    )
    if _needs_persist:
        try: 
            chroma_client.persist()
        except Exception: 
            pass
    print(f"[SYNC] ✅ THÀNH CÔNG: Đã đồng bộ {len(enriched)} sản phẩm vào ChromaDB (không bị trùng lặp nhờ upsert)")
    print(f"{'='*60}\n")
    return len(enriched)

# ============ Sync knowledge_seed.json -> Chroma ============
def build_knowledge_payload():
    try:
        if os.path.exists(KNOWLEDGE_PATH):
            with open(KNOWLEDGE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {
                "size_guides": data.get("size_guides", []),
                "policies": data.get("policies", []),
                "materials": data.get("materials", []),
                "care_guides": data.get("care_guides", []),
            }
    except Exception as e:
        print(f"[KNOWLEDGE] loi doc JSON: {e}")
    return {"size_guides": [], "policies": [], "materials": [], "care_guides": []}

def sync_knowledge_to_chroma():
    payload = build_knowledge_payload()
    c1 = upsert_docs("size_guides", payload["size_guides"])
    c2 = upsert_docs("policies", payload["policies"])
    c3 = upsert_docs("materials", payload["materials"])
    c4 = upsert_docs("care_guides", payload["care_guides"])
    if _needs_persist:
        try: 
            chroma_client.persist()
        except Exception: 
            pass
    total = (c1 or 0) + (c2 or 0) + (c3 or 0) + (c4 or 0)
    print(f"[SYNC] Upsert knowledge -> size_guides:{c1}, policies:{c2}, materials:{c3}, care_guides:{c4} (total={total})")
    return {"size_guides": c1, "policies": c2, "materials": c3, "care_guides": c4, "total": total}

# ============ Routes ============
@chatbot_bp.post("/sync_products")
def sync_products():
    try:
        count = sync_mysql_to_chromadb()
        return ok({"message": f"Đã đồng bộ {count} sản phẩm vào ChromaDB"})
    except Exception as e:
        return err(f"Lỗi khi đồng bộ: {str(e)}", 500)

@chatbot_bp.post("/sync_knowledge")
def sync_knowledge():
    try:
        stats = sync_knowledge_to_chroma()
        return ok({"message": "Đã đồng bộ kiến thức vào ChromaDB", "stats": stats})
    except Exception as e:
        return err(f"Lỗi sync knowledge: {str(e)}", 500)

# Đồng bộ nhanh 1 sản phẩm (tiện gắn CRUD hook sau create/update/delete)
@chatbot_bp.post("/sync_product/<int:pid>")
def sync_one(pid: int):
    try:
        res = sync_one_product_to_chroma(pid)
        return ok({"message": "done", "result": res})
    except Exception as e:
        return err(str(e), 500)

@chatbot_bp.get("/chroma_info")
def chroma_info():
    try:
        info = {}
        for name in ["products", "size_guides", "policies", "materials", "care_guides"]:
            coll = get_or_create(name)
            try: cnt = int(coll.count())
            except Exception: cnt = 0
            info[name] = cnt
        return ok({"path_abs": os.path.abspath(CHROMA_PATH), "counts": info})
    except Exception as e:
        return err(str(e), 500)

@chatbot_bp.get("/prompt")
def get_prompt_preview():
    try:
        return ok({"path": os.path.abspath(PROMPT_PATH), "prompt": _load_prompt_text()})
    except Exception as e:
        return err(str(e), 500)

@chatbot_bp.post("/chat")
def chat():
    """
    Luồng trả lời:
    - Câu chào/siêu ngắn: trả lời nhanh, KHÔNG gọi Gemini.
    - Nhận diện intent -> chọn collection (products/size/policy/material/care).
    - Tìm top-3 qua embedding; nếu quá "xa" với câu hỏi (distance lớn) -> trả lời "không tìm thấy".
    - Ghép context -> gọi Gemini để tạo câu trả lời tự nhiên từ dữ liệu Chroma.
    - Có hỗ trợ conversation history để hiểu context liên tục.
    """
    data = request.get_json() or {}
    query = (data.get("query") or "").strip()
    if not query:
        return err("Thiếu câu hỏi")
    
    # Nhận conversation history (optional)
    history = data.get("history") or []
    # Format: [{"role": "user", "content": "..."}, {"role": "bot", "content": "..."}]
    # Hoặc [{"query": "...", "response": "..."}]

    # 1) Kiểm tra chào hỏi ngắn - nhưng phải KHÔNG có history
    # Nếu có history, có thể là follow-up (ví dụ: "có", "ok") nên không reject
    ql = query.lower().strip()
    
    # Chỉ show greeting nếu KHÔNG có conversation history
    if (len(ql) < 3 or ql in {"hi", "hello", "xin chào", "chào", "thanks", "cảm ơn"}) and not history:
        return ok({"response": "Chào bạn! Bạn muốn tìm sản phẩm theo loại/size/giá hay xem chính sách cửa hàng?"})
    
    # Nếu có history và query ngắn, có thể là follow-up, tiếp tục xử lý
    print(f"[CHAT] Query: '{query}', Has history: {len(history) if history else 0} messages")

    # 2) Chuẩn bị Gemini (tư vấn tự nhiên)
    if not (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")):
        return err("Thiếu GEMINI_API_KEY/GOOGLE_API_KEY trong biến môi trường", 500)

    try:
        _ensure_gemini()
        for name in ["products", "size_guides", "policies", "materials", "care_guides"]:
            get_or_create(name)

        # 2.5) Reformulate query để hiểu rõ ý định hơn
        reformulated_query = reformulate_query(query)
        print(f"[CHAT] Original: {query}")
        print(f"[CHAT] Reformulated: {reformulated_query}")

        # 3) Intent -> collection
        intent = detect_intent(query)
        coll_name = {
            "product": "products",
            "size": "size_guides",
            "material": "materials",
            "policy": "policies",
            "care": "care_guides",
        }.get(intent, "products")

        collection = get_or_create(coll_name)
        print(f"[CHAT] Intent detected: {intent} -> Collection: {coll_name}")

        # 4) Tự fill products nếu chưa có (lần đầu khởi động)
        try: count = int(collection.count())
        except Exception: count = 0
        if coll_name == "products" and count == 0:
            _ = sync_mysql_to_chromadb()
            collection = get_or_create("products")
            try: count = int(collection.count())
            except Exception: count = 0
            if count == 0:
                return err("Chưa có dữ liệu sản phẩm trong ChromaDB. Hãy thêm sản phẩm vào MySQL rồi gọi /api/sync_products.")

        # 5) Query embedding với nhiều kết quả hơn để có thể filter theo giá
        qemb = embedding_model.encode([reformulated_query])[0].tolist()
        # Query 10 kết quả để có thể filter theo giá
        n_results = 10 if coll_name == "products" else 3
        results = collection.query(query_embeddings=[qemb], n_results=n_results)

        docs  = results.get("documents", [[]])[0] or []
        metas = results.get("metadatas", [[]])[0] or []
        distances = results.get("distances") or [[]]
        distances = distances[0] if distances else []

        # Filter sản phẩm theo giá nếu user có yêu cầu
        if coll_name == "products" and docs:
            # Tìm pattern giá trong cả original query và reformulated
            price_pattern = re.search(r'giá\s*dưới\s*(\d+)', query.lower()) or re.search(r'dưới\s*(\d+)\s*k', query.lower())
            if price_pattern:
                # Nếu là pattern "dưới Xk", nhân với 1000
                max_price = int(price_pattern.group(1))
                if 'k' in price_pattern.group(0):
                    max_price *= 1000
                # Filter sản phẩm có giá <= max_price
                filtered_docs, filtered_metas, filtered_distances = [], [], []
                for doc, meta, dist in zip(docs, metas, distances):
                    gia = meta.get("gia_ban") or meta.get("gia")
                    if gia is not None:
                        try:
                            # Convert Decimal hoặc string to float
                            gia_float = float(gia)
                            if gia_float <= max_price:
                                filtered_docs.append(doc)
                                filtered_metas.append(meta)
                                filtered_distances.append(dist)
                        except:
                            pass
                    else:
                        # Nếu không có giá, vẫn giữ (fallback)
                        filtered_docs.append(doc)
                        filtered_metas.append(meta)
                        filtered_distances.append(dist)
                
                # Chỉ lấy top 3 sau khi filter
                print(f"[CHAT] Filtered by price <= {max_price}, found {len(filtered_docs)} products")
                
                # Nếu filter xong mà không có sản phẩm nào, vẫn trả về 3 sản phẩm gần nhất
                # để Gemini có thể tư vấn về sản phẩm tương tự
                if filtered_docs:
                    docs = filtered_docs[:3]
                    metas = filtered_metas[:3]
                    distances = filtered_distances[:3] if filtered_distances else []
                    print(f"[CHAT] Returning top 3 filtered products")
                else:
                    # Fallback: trả về top 3 không filter (để Gemini có thể nói "không có dưới X nhưng có Y tương tự")
                    docs = docs[:3]
                    metas = metas[:3]
                    distances = distances[:3] if distances else []
                    print(f"[CHAT] No products found under {max_price}, returning {len(docs)} closest matches")

        # Log distances để debug
        if distances:
            print(f"[CHAT] Distances: {distances}")
        
        # Track xem có filter theo giá không
        did_price_filter = False
        if coll_name == "products" and "dưới" in query.lower():
            did_price_filter = True
        
        # Ngưỡng liên quan: cosine distance càng nhỏ càng giống
        # Vì products collection - luôn accept nếu có docs
        # (ChromaDB distance có thể không phản ánh đúng với tiếng Việt)
        def _relevant_ok():
            if not docs:
                return False
            
            # Products: luôn accept nếu có doc
            if coll_name == "products":
                print(f"[CHAT] Products collection - accepting {len(docs)} results")
                return True
            
            # Với collections khác (policies, materials, etc), check distance
            if distances:
                result = min(distances) <= 1.5
                if result:
                    print(f"[CHAT] Other collection - accepted (distance: {min(distances)})")
                else:
                    print(f"[CHAT] Other collection - rejected (distance: {min(distances)} > 1.5)")
                return result
            
            return True

        # 6) Ghép context theo intent
        print(f"[CHAT] Final docs count: {len(docs)}, metas count: {len(metas)}")
        if coll_name == "products" and metas:
            print(f"[CHAT] Metas before context: {len(metas)} items, sample keys: {list(metas[0].keys()) if metas[0] else 'empty'}")
        context_lines = []
        if coll_name == "products":
            if not docs or not _relevant_ok():
                print(f"[CHAT] Rejected: docs={len(docs)}, _relevant_ok()={_relevant_ok()}")
                return ok({"response": "Mình chưa tìm thấy sản phẩm phù hợp. Bạn thử lọc theo loại/size/chất liệu/khoảng giá nhé!"})
            for doc, meta in zip(docs, metas):
                gia = meta.get("gia_ban")
                gia_str = f"{gia} VND" if gia is not None else "N/A"
                context_lines.append(
                    f"Sản phẩm: {meta.get('ten_san_pham') or meta.get('name')}, Giá: {gia_str}\n{doc}"
                )
        else:
            if not docs:
                empty_msg = {
                    "size_guides": "Mình chưa đủ dữ liệu size để tư vấn chính xác.",
                    "policies": "Mình chưa tìm thấy chính sách phù hợp với câu hỏi.",
                    "materials": "Mình chưa đủ dữ liệu chất liệu để tư vấn.",
                    "care_guides": "Mình chưa có hướng dẫn chăm sóc phù hợp cho chất liệu này.",
                }.get(coll_name, "Mình chưa có dữ liệu phù hợp.")
                return ok({"response": empty_msg})
            context_lines = docs

        # 6.5) Detect season và filter theo chất liệu nếu có
        season_keywords = {
            "mùa hè": ["cotton", "vải cotton", "cotton 100", "thoáng", "mát"],
            "mùa đông": ["len", "dạ", "nỉ", "giữ ấm"],
            "mùa xuân": ["cotton", "thoáng", "vải mỏng"],
            "mùa thu": ["cotton", "thoáng"],
            "trời nóng": ["cotton", "thoáng", "mát"],
            "trời lạnh": ["len", "dạ", "giữ ấm"],
            "nắng nóng": ["cotton", "thoáng", "mát"],
        }
        
        detected_season = None
        for season, keywords in season_keywords.items():
            if season in query.lower():
                detected_season = season
                print(f"[CHAT] Detected season: {detected_season}")
                break
        
        # Filter sản phẩm theo chất liệu nếu có season
        if detected_season and coll_name == "products" and docs:
            season_keywords_list = season_keywords[detected_season]
            filtered_docs_season, filtered_metas_season, filtered_distances_season = [], [], []
            
            print(f"[CHAT] Season filter: checking {len(docs)} products for {detected_season}")
            for doc, meta, dist in zip(docs, metas, distances):
                chat_lieu = (meta.get("chat_lieu") or "").lower()
                ten_san_pham = (meta.get("ten_san_pham") or "").lower()
                # Check nếu chất liệu hoặc tên sản phẩm phù hợp với mùa
                if any(kw in chat_lieu for kw in season_keywords_list) or any(kw in ten_san_pham for kw in season_keywords_list):
                    filtered_docs_season.append(doc)
                    filtered_metas_season.append(meta)
                    filtered_distances_season.append(dist)
            
            # Nếu filter theo mùa có kết quả, dùng nó; nếu không thì dùng tất cả
            if filtered_docs_season:
                docs = filtered_docs_season[:3]
                metas = filtered_metas_season[:3]
                distances = filtered_distances_season[:3] if filtered_distances_season else []
                print(f"[CHAT] Season filtered: found {len(filtered_docs_season)} suitable products for {detected_season}, using top 3")
                print(f"[CHAT] Metas after season filter: {len(metas)} items, IDs: {[m.get('products_id') or m.get('id') for m in metas]}")
            else:
                # Không có sản phẩm phù hợp với season, vẫn trả về top 3 và để Gemini tư vấn
                docs = docs[:3]
                metas = metas[:3]
                distances = distances[:3] if distances else []
                print(f"[CHAT] No products match season keywords, using top {len(docs)} products")
                print(f"[CHAT] Metas (no season filter): {len(metas)} items, IDs: {[m.get('products_id') or m.get('id') for m in metas]}")
                # Đánh dấu đây là query về mùa để Gemini tư vấn phù hợp
                query += f" [Season: {detected_season}]"
        
        # 7) Build conversation context nếu có history
        conversation_context = ""
        if history and len(history) > 0:
            # Giới hạn 5 messages gần nhất
            recent_history = history[-5:] if len(history) > 5 else history
            conv_lines = []
            for msg in recent_history:
                if isinstance(msg, dict):
                    # Format: {"role": "user", "content": "..."}
                    if "role" in msg and "content" in msg:
                        role = "Khách hàng" if msg["role"] == "user" else "Bạn (Bot)"
                        conv_lines.append(f"{role}: {msg['content']}")
                    # Format: {"query": "...", "response": "..."}
                    elif "query" in msg and "response" in msg:
                        conv_lines.append(f"Khách hàng: {msg['query']}")
                        conv_lines.append(f"Bạn (Bot): {msg['response']}")
            
            if conv_lines:
                conversation_context = "\n".join(conv_lines)
                print(f"[CHAT] Conversation history: {len(recent_history)} messages")
        
        # 8) Gọi Gemini để trả lời tự nhiên từ context
        context = "\n---\n".join(context_lines)
        prompt = _load_prompt_text().format_map(_SafeDict(query=query, context=context))
        
        # Thêm conversation history vào prompt
        if conversation_context:
            follow_up_instructions = (
                "\n\n**CUỘC HỘI THOẠI TRƯỚC ĐÓ:**\n" + conversation_context + "\n\n" +
                "**QUAN TRỌNG - XỬ LÝ FOLLOW-UP:**\n" +
                "- Nếu người dùng trả lời ngắn (ví dụ: 'có', 'ok', 'được', 'cho tôi', 'vâng') " +
                "→ đó là MUỐN tiến hành theo offer/câu hỏi ở lịch sử trước\n" +
                "- Ví dụ: Bot trước đó nói 'gợi ý sản phẩm cho bạn' → User trả 'có' → Tiếp tục đưa sản phẩm\n" +
                "- Ví dụ: Bot hỏi 'màu gì bạn muốn' → User trả 'đỏ' → Gợi ý sản phẩm màu đỏ\n" +
                "- LUÔN hiểu ngữ cảnh, đừng bắt đầu cuộc trò chuyện mới\n" +
                "- Nếu user muốn khởi động câu chuyện mới, họ sẽ hỏi rõ ràng (ví dụ: 'tìm áo mới', 'cho tôi xem sản phẩm khác')"
            )
            prompt += follow_up_instructions

        text = _call_gemini_with_fallback(prompt)
        if not text:
            msg = ("Mình tạm chưa lấy được phản hồi từ mô hình. "
                   "Bạn thử hỏi lại sau hoặc cung cấp thêm bộ lọc (loại, size, chất liệu, khoảng giá) nhé!")
            if DEBUG_CHAT:
                msg += " [DEBUG: xem log server để biết lý do safety/quota hoặc model 404]"
            return ok({"response": msg})

        # 9) Chuẩn bị structured data nếu có sản phẩm
        products_data = []
        if coll_name == "products" and metas and len(metas) > 0:
            # Lấy base URL từ env hoặc request
            base_url = os.getenv("PUBLIC_BASE_URL") or request.host_url.rstrip('/')
            if not base_url.startswith('http'):
                base_url = f"http://{base_url}"
            
            def _abs_img(url_or_path):
                """Convert relative path to absolute URL"""
                if not url_or_path:
                    return None
                s = str(url_or_path).strip()
                if s.startswith("http://") or s.startswith("https://"):
                    return s
                if not s.startswith("/"):
                    s = "/" + s
                from urllib.parse import urljoin
                return urljoin(base_url, s.lstrip("/"))
            
            print(f"[CHAT] Preparing products_data from {len(metas)} metas")
            for idx, meta in enumerate(metas):
                if not meta:
                    print(f"[CHAT] Warning: meta[{idx}] is None or empty")
                    continue
                    
                product_id = meta.get("products_id") or meta.get("product_id") or meta.get("id")
                if not product_id:
                    print(f"[CHAT] Warning: meta[{idx}] has no product_id. Keys: {list(meta.keys())}")
                    continue
                
                try:
                    product_data = {
                        "id": int(product_id),
                        "name": meta.get("ten_san_pham") or meta.get("name") or "",
                        "price": float(meta.get("gia_ban") or meta.get("gia") or 0),
                        "image": _abs_img(meta.get("hinh_anh") or meta.get("image")),
                        "category": meta.get("loai") or "",
                        "size": meta.get("size") or "",
                        "material": meta.get("chat_lieu") or meta.get("material") or "",
                        "gender": meta.get("gioi_tinh") or meta.get("gender") or "",
                        "status": meta.get("trang_thai") or meta.get("status") or "",
                    }
                    products_data.append(product_data)
                    print(f"[CHAT] Added product #{product_id}: {product_data['name']}")
                except Exception as e:
                    print(f"[CHAT] Error creating product_data from meta[{idx}]: {e}")
                    import traceback
                    traceback.print_exc()
                    continue
            
            print(f"[CHAT] ✅ Returning {len(products_data)} products in structured format")
        else:
            if coll_name == "products":
                print(f"[CHAT] ⚠️  No products_data: coll_name={coll_name}, metas={metas}, len(metas)={len(metas) if metas else 0}")

        # Trả về response với structured data
        response_data = {
            "response": text,
            "products": products_data if products_data else None,
            "intent": intent,
        }
        
        # Debug: Log response structure
        if coll_name == "products":
            print(f"[CHAT] 📤 Response: text_len={len(text)}, products_count={len(products_data) if products_data else 0}")
            if products_data:
                print(f"[CHAT] 📦 Products IDs: {[p.get('id') for p in products_data]}")
        
        return ok(response_data)
    except Exception as e:
        return err(f"Lỗi khi xử lý câu hỏi: {str(e)}", 500)
