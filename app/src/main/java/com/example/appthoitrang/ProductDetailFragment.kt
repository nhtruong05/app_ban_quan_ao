package com.example.appthoitrang

import android.graphics.drawable.Drawable
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.bumptech.glide.Glide
import com.bumptech.glide.load.DataSource
import com.bumptech.glide.load.engine.GlideException
import com.bumptech.glide.request.RequestListener
import com.bumptech.glide.request.target.Target
import com.example.appthoitrang.databinding.FragmentProductDetailBinding
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.NumberFormat
import java.util.Locale

class ProductDetailFragment : Fragment() {

    private var _binding: FragmentProductDetailBinding? = null
    private val binding get() = _binding!!

    private lateinit var api: ApiService
    private var product: Product? = null
    private lateinit var session: SessionManager

    private enum class PendingAction { ADD_TO_CART, BUY_NOW }
    private var pendingAction: PendingAction? = null

    companion object {
        private const val ARG_PRODUCT = "arg_product"
        fun newInstance(p: Product) = ProductDetailFragment().apply {
            arguments = Bundle().apply { putParcelable(ARG_PRODUCT, p) }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        product = arguments?.getParcelable(ARG_PRODUCT)
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProductDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        session = SessionManager(requireContext())
        api = RetrofitClient.create(requireContext())

        // lắng nghe login result
        parentFragmentManager.setFragmentResultListener("auth_result", viewLifecycleOwner) { _, bundle ->
            val ok = bundle.getBoolean("ok", false)
            if (ok && session.isLoggedIn()) {
                when (pendingAction) {
                    PendingAction.ADD_TO_CART -> product?.let { if (it.id > 0) addToCart(it.id, 1) }
                    PendingAction.BUY_NOW     -> product?.let { navigateCheckoutBuyNow(it, 1) }
                    else -> {}
                }
                pendingAction = null
            }
        }

        product?.let { if (it.id > 0) bind(it) }

        // refresh chi tiết
        product?.let { p ->
            if (p.id <= 0) return@let
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    val res = withContext(Dispatchers.IO) { api.getProduct(p.id) }
                    if (!isAdded || _binding == null) return@launch
                    if (res.isSuccessful) {
                        val fresh = res.body()?.data
                        fresh?.let {
                            product = it
                            bind(it)
                        }
                    }
                } catch (_: Exception) { }
            }
        }

        binding.btnBack.setOnClickListener { parentFragmentManager.popBackStack() }

        binding.btnAddToCart.setOnClickListener {
            val p = product ?: return@setOnClickListener
            if (p.id <= 0) return@setOnClickListener
            if (!session.isLoggedIn()) {
                confirmLoginThenNavigate(PendingAction.ADD_TO_CART); return@setOnClickListener
            }
            addToCart(p.id, 1)
        }

        binding.btnBuyNow.setOnClickListener {
            val p = product ?: return@setOnClickListener
            if (p.id <= 0) return@setOnClickListener
            if (!session.isLoggedIn()) {
                confirmLoginThenNavigate(PendingAction.BUY_NOW); return@setOnClickListener
            }
            navigateCheckoutBuyNow(p, 1)
        }
    }

    private fun navigateCheckoutBuyNow(p: Product, qty: Int) {
        parentFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, CheckoutFragment.newInstanceBuyNow(p, qty))
            .addToBackStack("checkout_buy_now")
            .commit()
    }

    private fun confirmLoginThenNavigate(action: PendingAction) {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Cần đăng nhập")
            .setMessage("Bạn cần đăng nhập để tiếp tục. Chuyển sang trang đăng nhập?")
            .setNegativeButton("Hủy", null)
            .setPositiveButton("Đồng ý") { _, _ ->
                pendingAction = action
                parentFragmentManager.beginTransaction()
                    .replace(R.id.fragment_container, UserFragment.newInstance(openedForAuth = true))
                    .addToBackStack("login")
                    .commit()
            }
            .show()
    }

    private fun addToCart(productId: Int, qty: Int) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res = withContext(Dispatchers.IO) {
                    api.addToCart(AddToCartRequest(product_id = productId, quantity = qty))
                }
                if (!isAdded || _binding == null) return@launch
                if (res.isSuccessful) {
                    val body = res.body()
                    if (body?.success == true) {
                        showSnack("Đã thêm vào giỏ!")
                    } else {
                        showSnack(body?.readableMessage("Không thể thêm vào giỏ") ?: "Không thể thêm vào giỏ")
                    }
                } else {
                    showSnack("Không thể thêm vào giỏ (mã ${res.code()})")
                }
            } catch (_: Exception) {
                if (!isAdded || _binding == null) return@launch
                showSnack("Lỗi kết nối, vui lòng thử lại")
            }
        }
    }

    private fun showSnack(msg: String) {
        val b = _binding ?: return
        b.tvSnack.text = msg
        b.tvSnack.visibility = View.VISIBLE
    }

    private fun bind(p: Product) {
        val b = _binding ?: return
        b.tvName.text   = p.ten_san_pham
        b.tvId.text     = "ID: ${p.id}"

        b.tvPrice.text     = formatVnd(p.giaBanAsDouble())
        b.tvCategory.text  = p.loai
        b.tvSize.text      = p.size ?: "-"
        b.tvMaterial.text  = p.chat_lieu ?: "-"
        b.tvGender.text    = p.gioi_tinh ?: "-"
        b.tvDesc.text      = p.mo_ta ?: "(Chưa có mô tả)"

        // tiếng Việt
        val dangBan = p.trang_thai == "Đang bán"
        b.tvStatus.text = if (dangBan) "Đang bán" else "Ngừng bán"
        b.tvStatus.setTextColor(
            ContextCompat.getColor(
                requireContext(),
                if (dangBan) R.color.status_on_sale else R.color.status_off_sale
            )
        )
        b.btnAddToCart.isEnabled = dangBan
        b.btnBuyNow.isEnabled    = dangBan
        val alpha = if (dangBan) 1f else 0.5f
        b.btnAddToCart.alpha = alpha
        b.btnBuyNow.alpha    = alpha

        Glide.with(this)
            .load(p.hinh_anh?.takeIf { it.isNotBlank() })
            .placeholder(R.drawable.bg_image_placeholder)
            .error(R.drawable.bg_image_placeholder)
            .centerCrop()
            .listener(object : RequestListener<Drawable> {
                override fun onLoadFailed(
                    e: GlideException?,
                    model: Any?,
                    target: Target<Drawable>,
                    isFirstResource: Boolean
                ): Boolean {
                    showSnack("Load ảnh lỗi: ${e?.rootCauses?.firstOrNull()?.message ?: e?.message ?: "unknown"}")
                    return false
                }

                override fun onResourceReady(
                    resource: Drawable,
                    model: Any,
                    target: Target<Drawable>,
                    dataSource: DataSource,
                    isFirstResource: Boolean
                ): Boolean = false
            })
            .into(b.img)
    }

    private fun formatVnd(value: Double): String {
        val nf = NumberFormat.getNumberInstance(Locale("vi", "VN"))
        return nf.format(value) + " đ"
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
