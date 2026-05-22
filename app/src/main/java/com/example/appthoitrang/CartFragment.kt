package com.example.appthoitrang

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.appthoitrang.databinding.FragmentCartBinding
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

class CartFragment : Fragment() {

    private var _binding: FragmentCartBinding? = null
    private val binding get() = _binding!!

    private lateinit var api: ApiService
    private lateinit var session: SessionManager
    private lateinit var adapter: CartAdapter

    private val nf = NumberFormat.getNumberInstance(Locale("vi", "VN"))

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCartBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        api = RetrofitClient.create(requireContext())
        session = SessionManager(requireContext())

        adapter = CartAdapter(
            mutableListOf(),
            onPlus = { updateQty(it.product_id, it.quantity + 1) },
            // không cho giảm về 0 ở đây; muốn xoá thì dùng nút Xoá
            onMinus = { updateQty(it.product_id, (it.quantity - 1).coerceAtLeast(1)) },
            onDelete = { confirmDelete(it) }
        )

        binding.rvCart.layoutManager = LinearLayoutManager(requireContext())
        binding.rvCart.adapter = adapter

        // Thanh toán từ giỏ
        binding.btnCheckout.setOnClickListener {
            if (session.getToken() == null) {
                confirmLoginThen {
                    // Sau khi login xong (qua UserFragment), điều hướng Checkout
                    navigateCheckoutFromCart()
                }
            } else {
                navigateCheckoutFromCart()
            }
        }

        binding.btnClear.setOnClickListener { confirmClearCart() }

        loadCart()
    }

    private fun navigateCheckoutFromCart() {
        if (_binding == null || !isAdded) return
        parentFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, CheckoutFragment.newInstanceFromCart())
            .addToBackStack("checkout_from_cart")
            .commit()
    }

    private fun confirmLoginThen(onAuthed: () -> Unit) {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Cần đăng nhập")
            .setMessage("Bạn cần đăng nhập để tiếp tục thanh toán. Chuyển sang trang đăng nhập?")
            .setNegativeButton("Hủy", null)
            .setPositiveButton("Đồng ý") { _, _ ->
                // Lắng nghe 1 lần
                parentFragmentManager.setFragmentResultListener("auth_result", viewLifecycleOwner) { _, bundle ->
                    val ok = bundle.getBoolean("ok", false)
                    if (ok && session.isLoggedIn()) {
                        onAuthed()
                        // xoá listener sau khi dùng (tuỳ ý)
                    }
                }
                parentFragmentManager.beginTransaction()
                    .replace(R.id.fragment_container, UserFragment.newInstance(openedForAuth = true))
                    .addToBackStack("login")
                    .commit()
            }
            .show()
    }

    // ---------------------- API calls ----------------------

    private fun loadCart() {
        // Nếu chưa đăng nhập, hiển thị gợi ý
        if (!::session.isInitialized || session.getToken() == null) {
            val b = _binding ?: return
            adapter.replaceAll(emptyList())
            b.tvEmpty.visibility = View.VISIBLE
            b.tvEmpty.text = "Vui lòng đăng nhập để xem giỏ hàng."
            b.btnCheckout.isEnabled = false
            b.tvTotal.text = "Tổng: 0 đ"
            return
        }

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res = withContext(Dispatchers.IO) { api.getCart() }
                val b = _binding ?: return@launch

                if (res.isSuccessful) {
                    val payload = res.body()
                    val data = payload?.data as? CartPayload
                    val items = data?.items.orEmpty()
                    adapter.replaceAll(items)

                    b.tvEmpty.visibility = if (items.isEmpty()) View.VISIBLE else View.GONE
                    b.btnCheckout.isEnabled = items.isNotEmpty()

                    // Dùng tổng từ server nếu có, fallback tự tính
                    val total = data?.totalAsDouble()
                        ?: items.sumOf { it.giaBanAsDouble() * it.quantity }
                    b.tvTotal.text = "Tổng: ${nf.format(total)} đ"
                } else {
                    showError(res.errorBody()?.string())
                    val b2 = _binding ?: return@launch
                    adapter.replaceAll(emptyList())
                    b2.tvEmpty.visibility = View.VISIBLE
                    b2.btnCheckout.isEnabled = false
                    b2.tvTotal.text = "Tổng: 0 đ"
                }
            } catch (e: Exception) {
                val b = _binding ?: return@launch
                adapter.replaceAll(emptyList())
                b.tvEmpty.visibility = View.VISIBLE
                b.tvEmpty.text = "Không tải được giỏ: ${e.message}"
                b.btnCheckout.isEnabled = false
                b.tvTotal.text = "Tổng: 0 đ"
            }
        }
    }

    private fun updateQty(productId: Int, newQty: Int) {
        if (_binding == null) return
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res = withContext(Dispatchers.IO) {
                    api.updateCartItem(productId, UpdateQtyReq(newQty))
                }
                if (_binding == null) return@launch
                if (res.isSuccessful) {
                    loadCart()
                } else {
                    showError(res.errorBody()?.string())
                }
            } catch (e: Exception) {
                if (_binding == null) return@launch
                showSnack("Lỗi cập nhật: ${e.message}")
            }
        }
    }

    private fun deleteItem(productId: Int) {
        if (_binding == null) return
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res = withContext(Dispatchers.IO) { api.deleteCartItem(productId) }
                if (_binding == null) return@launch
                if (res.isSuccessful) {
                    loadCart()
                } else {
                    showError(res.errorBody()?.string())
                }
            } catch (e: Exception) {
                if (_binding == null) return@launch
                showSnack("Lỗi xoá: ${e.message}")
            }
        }
    }

    private fun clearCart() {
        if (_binding == null) return
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res = withContext(Dispatchers.IO) { api.clearCart() }
                if (_binding == null) return@launch
                if (res.isSuccessful) {
                    loadCart()
                } else {
                    showError(res.errorBody()?.string())
                }
            } catch (e: Exception) {
                if (_binding == null) return@launch
                showSnack("Lỗi làm trống giỏ: ${e.message}")
            }
        }
    }

    // ---------------------- Confirm dialogs ----------------------

    private fun confirmDelete(item: CartItem) {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Xoá sản phẩm")
            .setMessage("Bạn có chắc muốn xoá '${item.ten_san_pham}' khỏi giỏ hàng?")
            .setNegativeButton("Hủy", null)
            .setPositiveButton("Xoá") { _, _ -> deleteItem(item.product_id) }
            .show()
    }

    private fun confirmClearCart() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Xoá toàn bộ giỏ hàng")
            .setMessage("Bạn có chắc muốn xoá toàn bộ sản phẩm trong giỏ?")
            .setNegativeButton("Hủy", null)
            .setPositiveButton("Xoá hết") { _, _ -> clearCart() }
            .show()
    }

    // ---------------------- UI helpers ----------------------

    private fun showError(raw: String?) {
        val msg = try {
            if (raw.isNullOrBlank()) null else JSONObject(raw).optString("message", null)
        } catch (_: Exception) { null }
        showSnack(msg ?: "Có lỗi xảy ra")
    }

    private fun showSnack(msg: String) {
        val b = _binding ?: return
        b.tvEmpty.visibility = View.VISIBLE
        b.tvEmpty.text = msg
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
