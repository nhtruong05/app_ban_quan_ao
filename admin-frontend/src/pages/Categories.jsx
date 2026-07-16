// ============================================================
// src/pages/Categories.jsx - Quan ly danh muc san pham
//
// Gan vao App.jsx (giong cac page khac):
//   import Categories from "./pages/Categories";
//   <Route path="/categories" element={<Categories />} />
//   (dat trong ProtectedRoute/Layout giong Products.jsx)
// Them link vao Header.jsx / Layout.jsx: "Danh mục"
//
// Dung apiFetch tu services/api.js cua project (fetch wrapper,
// tu dong gan Bearer token tu localStorage vao moi request).
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api";

const SIZE_TYPES = [
  { value: "LETTER", label: "Chữ (S / M / L...)" },
  { value: "SHOE", label: "Số giày (35 - 44)" },
  { value: "BELT", label: "Chiều dài (90cm...)" },
  { value: "FREESIZE", label: "Freesize (không có size)" },
];

const EMPTY_FORM = {
  ten: "",
  nhom: "",
  size_type: "LETTER",
  sizes: [],
  chat_lieus: [],
};

// ---- O nhap dang chip: go gia tri -> Enter/"Thêm" -> hien chip ----
function ChipInput({ label, values, onChange, placeholder }) {
  const [text, setText] = useState("");

  const add = () => {
    const v = text.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setText("");
  };

  const remove = (v) => onChange(values.filter((x) => x !== v));

  return (
    <div className="catg-field">
      <label>{label}</label>
      <div className="catg-chip-row">
        {values.map((v) => (
          <span key={v} className="catg-chip">
            {v}
            <button type="button" onClick={() => remove(v)} aria-label={`Xóa ${v}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="catg-chip-input">
        <input
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" onClick={add}>
          Thêm
        </button>
      </div>
    </div>
  );
}

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = them moi
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const groups = useMemo(
    () => [...new Set(categories.map((c) => c.nhom))],
    [categories]
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const json = await apiFetch("/api/categories");
      setCategories(json.data || []);
    } catch (err) {
      setError(err.message || "Không tải được danh mục. Kiểm tra server backend đang chạy.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (cat) => {
    setEditingId(cat.id);
    setForm({
      ten: cat.ten,
      nhom: cat.nhom,
      size_type: cat.size_type,
      sizes: cat.sizes || [],
      chat_lieus: cat.chat_lieus || [],
    });
    setFormError("");
    setModalOpen(true);
  };

  const save = async () => {
    setFormError("");
    if (!form.ten.trim()) return setFormError("Nhập tên danh mục");
    if (!form.nhom.trim()) return setFormError("Nhập nhóm danh mục");
    if (form.size_type !== "FREESIZE" && form.sizes.length === 0)
      return setFormError("Danh mục có size cần ít nhất 1 size");

    setSaving(true);
    try {
      const body = {
        ...form,
        sizes: form.size_type === "FREESIZE" ? [] : form.sizes,
      };
      if (editingId == null) {
        await apiFetch("/api/admin/categories", {
          method: "POST",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/api/admin/categories/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || "Lưu thất bại, thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cat) => {
    const confirmed = window.confirm(
      `Xóa danh mục "${cat.ten}"?\nSize và chất liệu của danh mục này sẽ bị xóa theo.`
    );
    if (!confirmed) return;
    try {
      await apiFetch(`/api/admin/categories/${cat.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      // Server tu chan neu con san pham thuoc danh muc va tra message ro rang
      window.alert(err.message || "Xóa thất bại, thử lại.");
    }
  };

  const sizeTypeLabel = (v) =>
    SIZE_TYPES.find((t) => t.value === v)?.label || v;

  return (
    <div className="catg-page">
      <style>{styles}</style>

      <div className="catg-head">
        <div>
          <h2>Danh mục sản phẩm</h2>
          <p>Size và chất liệu của mỗi danh mục sẽ tự hiển thị trong form thêm sản phẩm.</p>
        </div>
        <button className="catg-btn-primary" onClick={openAdd}>
          + Thêm danh mục
        </button>
      </div>

      {error && <div className="catg-error">{error}</div>}

      {loading ? (
        <div className="catg-empty">Đang tải danh mục…</div>
      ) : categories.length === 0 ? (
        <div className="catg-empty">
          Chưa có danh mục nào. Bấm "Thêm danh mục" để tạo danh mục đầu tiên.
        </div>
      ) : (
        <table className="catg-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Nhóm</th>
              <th>Kiểu size</th>
              <th>Size</th>
              <th>Chất liệu</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td className="catg-name">{cat.ten}</td>
                <td>{cat.nhom}</td>
                <td>{sizeTypeLabel(cat.size_type)}</td>
                <td>
                  {cat.size_type === "FREESIZE" ? (
                    <span className="catg-muted">Freesize</span>
                  ) : (
                    <div className="catg-chip-row">
                      {cat.sizes.map((s) => (
                        <span key={s} className="catg-chip catg-chip-sm">{s}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <div className="catg-chip-row">
                    {cat.chat_lieus.map((m) => (
                      <span key={m} className="catg-chip catg-chip-sm">{m}</span>
                    ))}
                  </div>
                </td>
                <td className="catg-actions">
                  <button onClick={() => openEdit(cat)}>Sửa</button>
                  <button className="catg-danger" onClick={() => remove(cat)}>
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div className="catg-overlay" onClick={() => !saving && setModalOpen(false)}>
          <div className="catg-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId == null ? "Thêm danh mục" : "Sửa danh mục"}</h3>

            <div className="catg-field">
              <label>Tên danh mục</label>
              <input
                value={form.ten}
                placeholder="Ví dụ: Giày thể thao"
                onChange={(e) => setForm({ ...form, ten: e.target.value })}
              />
            </div>

            <div className="catg-field">
              <label>Nhóm</label>
              <input
                list="catg-groups"
                value={form.nhom}
                placeholder="Ví dụ: Giày dép"
                onChange={(e) => setForm({ ...form, nhom: e.target.value })}
              />
              <datalist id="catg-groups">
                {groups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>

            <div className="catg-field">
              <label>Kiểu size</label>
              <select
                value={form.size_type}
                onChange={(e) => setForm({ ...form, size_type: e.target.value })}
              >
                {SIZE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {form.size_type !== "FREESIZE" && (
              <ChipInput
                label="Size"
                values={form.sizes}
                onChange={(sizes) => setForm({ ...form, sizes })}
                placeholder="Gõ size rồi Enter (vd: S, 38, 90cm)"
              />
            )}

            <ChipInput
              label="Chất liệu"
              values={form.chat_lieus}
              onChange={(chat_lieus) => setForm({ ...form, chat_lieus })}
              placeholder="Gõ chất liệu rồi Enter (vd: Cotton)"
            />

            {formError && <div className="catg-error">{formError}</div>}

            <div className="catg-modal-actions">
              <button disabled={saving} onClick={() => setModalOpen(false)}>
                Hủy
              </button>
              <button
                className="catg-btn-primary"
                disabled={saving}
                onClick={save}
              >
                {saving ? "Đang lưu…" : editingId == null ? "Thêm danh mục" : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Style tu dong goi, prefix catg- de khong dung CSS san co cua ban
const styles = `
.catg-page { padding: 20px; max-width: 1100px; }
.catg-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
.catg-head h2 { margin: 0 0 4px; }
.catg-head p { margin: 0; color: #6b7280; font-size: 14px; }
.catg-btn-primary { background: #1f2937; color: #fff; border: none; padding: 9px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; white-space: nowrap; }
.catg-btn-primary:disabled { opacity: .6; cursor: default; }
.catg-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; margin: 10px 0; font-size: 14px; }
.catg-empty { padding: 40px; text-align: center; color: #6b7280; background: #f9fafb; border-radius: 10px; }
.catg-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
.catg-table th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; background: #f9fafb; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
.catg-table td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; font-size: 14px; }
.catg-table tr:last-child td { border-bottom: none; }
.catg-name { font-weight: 600; }
.catg-muted { color: #9ca3af; }
.catg-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.catg-chip { display: inline-flex; align-items: center; gap: 6px; background: #eef2ff; color: #3730a3; border-radius: 999px; padding: 3px 10px; font-size: 13px; }
.catg-chip-sm { padding: 2px 8px; font-size: 12px; }
.catg-chip button { border: none; background: none; color: inherit; cursor: pointer; font-size: 14px; line-height: 1; padding: 0; }
.catg-chip-input { display: flex; gap: 8px; }
.catg-chip-input input { flex: 1; }
.catg-chip-input button { border: 1px solid #d1d5db; background: #fff; border-radius: 8px; padding: 0 14px; cursor: pointer; }
.catg-actions { white-space: nowrap; text-align: right; }
.catg-actions button { border: 1px solid #d1d5db; background: #fff; border-radius: 8px; padding: 5px 12px; cursor: pointer; margin-left: 6px; font-size: 13px; }
.catg-danger { color: #b91c1c; border-color: #fecaca !important; }
.catg-overlay { position: fixed; inset: 0; background: rgba(17,24,39,.5); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 50; }
.catg-modal { background: #fff; border-radius: 14px; padding: 22px; width: 100%; max-width: 480px; max-height: 90vh; overflow: auto; }
.catg-modal h3 { margin: 0 0 14px; }
.catg-field { margin-bottom: 14px; }
.catg-field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #374151; }
.catg-field input, .catg-field select { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 8px; padding: 9px 11px; font-size: 14px; }
.catg-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.catg-modal-actions button { border: 1px solid #d1d5db; background: #fff; border-radius: 8px; padding: 9px 16px; cursor: pointer; font-size: 14px; }
.catg-modal-actions .catg-btn-primary { border: none; }
`;
