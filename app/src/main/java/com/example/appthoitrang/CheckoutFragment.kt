package com.example.appthoitrang

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.example.appthoitrang.databinding.FragmentCheckoutBinding
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.wallet.PaymentData
import com.google.android.gms.wallet.PaymentDataRequest
import com.google.android.gms.wallet.PaymentsClient
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import retrofit2.Response
import java.io.EOFException
import java.io.IOException
import java.text.NumberFormat
import java.util.Locale
import javax.net.ssl.SSLException

class CheckoutFragment : Fragment() {

    private var _binding: FragmentCheckoutBinding? = null
    private val binding get() = _binding!!

    private lateinit var api: ApiService
    private lateinit var session: SessionManager
    private lateinit var paymentsClient: PaymentsClient
    private val nf = NumberFormat.getNumberInstance(Locale("vi", "VN"))

    private var modeBuyNow = false
    private var product: Product? = null
    private var quantity: Int = 1

    private var pendingOrderInfo: PendingOrder? = null
    data class PendingOrder(
        val id: Int,
        val hoten: String, val email: String, val sdt: String, val diachi: String, val method: String
    )

    companion object {
        private const val ARG_BUY_NOW = "arg_buy_now"
        private const val ARG_PRODUCT = "arg_product"
        private const val ARG_QTY = "arg_qty"

        fun newInstanceBuyNow(p: Product, qty: Int = 1) = CheckoutFragment().apply {
            arguments = Bundle().apply {
                putBoolean(ARG_BUY_NOW, true)
                putParcelable(ARG_PRODUCT, p)
                putInt(ARG_QTY, qty)
            }
        }

        fun newInstanceFromCart() = CheckoutFragment().apply {
            arguments = Bundle().apply { putBoolean(ARG_BUY_NOW, false) }
        }
    }

    // ---------------- Loading Dialog ----------------
    private var loadingDialog: androidx.appcompat.app.AlertDialog? = null
    private fun showLoading(msg: String = "Đang xác nhận thanh toán...") {
        if (!isAdded || _binding == null) return
        if (loadingDialog?.isShowing == true) return
        val view = layoutInflater.inflate(R.layout.dialog_loading, null)
        view.findViewById<TextView>(R.id.tvLoadingMsg).text = msg
        loadingDialog = MaterialAlertDialogBuilder(requireContext())
            .setView(view)
            .setCancelable(false)
            .create()
        loadingDialog?.show()
    }
    private fun hideLoading() { loadingDialog?.dismiss(); loadingDialog = null }
    // ------------------------------------------------

    // Google Pay launcher
    private val googlePayLauncher =
        registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
            if (!isAdded || _binding == null) return@registerForActivityResult
            when (result.resultCode) {
                Activity.RESULT_OK -> {
                    val token = GooglePayHelper.extractToken(result.data)
                    if (token.isNullOrBlank()) {
                        showSnack("Không lấy được token thanh toán")
                        return@registerForActivityResult
                    }
                    submitOrder(
                        paymentToken = token,
                        hoten = binding.edtHoten.text.toString().trim(),
                        email = binding.edtEmail.text.toString().trim(),
                        sdt = binding.edtSdt.text.toString().trim(),
                        diachi = binding.edtDiachi.text.toString().trim(),
                        method = "GGPAY"
                    )
                }
                Activity.RESULT_CANCELED -> showSnack("Đã huỷ Google Pay")
                else -> showSnack("Google Pay lỗi")
            }
        }

    // VNPAY launcher
    private val vnpayLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (!isAdded || _binding == null) return@registerForActivityResult

            val po = pendingOrderInfo ?: run {
                showSnack("Thiếu thông tin đơn VNPAY")
                return@registerForActivityResult
            }

            val webviewSuccess = result.data?.getBooleanExtra(
                VnPayWebViewActivity.EXTRA_SUCCESS, false
            ) ?: false

            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    showLoading("Đang xác nhận thanh toán...")

                    if (webviewSuccess) {
                        // ReturnUrl báo thành công → hiển thị bill ngay
                        val order0 = fetchOrderWithRetry(po.id, retries = 2, delayMs = 300)
                        val wrapped = mutableMapOf<String, Any>().apply {
                            putAll(order0 ?: emptyMap())
                            put("order_id", po.id)
                            put("trangthai", "Đã thanh toán")
                            put("payment_method", "VNPAY")
                        }
                        hideLoading()
                        showSuccessBillDialog(wrapped, po.hoten, po.email, po.sdt, po.diachi, po.method)
                    } else {
                        // ReturnUrl không OK → đợi IPN nhanh khoảng 10s
                        val paid = pollOrderPaidFast(po.id)
                        hideLoading()
                        if (paid) {
                            val order = fetchOrderWithRetry(po.id, retries = 2, delayMs = 300)
                            showSuccessBillDialog(order ?: emptyMap(), po.hoten, po.email, po.sdt, po.diachi, po.method)
                        } else {
                            val order = fetchOrderWithRetry(po.id, retries = 2, delayMs = 300)
                            showVnPayFailDialog(order ?: emptyMap(), po.hoten, po.email, po.sdt, po.diachi)
                        }
                    }
                } catch (e: Exception) {
                    hideLoading()
                    if (isEofError(e)) {
                        showSnack("Kết nối tới server gián đoạn (EOF). Đang thử lại...")
                        val ok = try { pollOrderPaidBurst(po.id) } catch (_: Exception) { false }
                        if (ok) {
                            val order = fetchOrderWithRetry(po.id, retries = 2, delayMs = 300)
                            showSuccessBillDialog(order ?: emptyMap(), po.hoten, po.email, po.sdt, po.diachi, po.method)
                        } else {
                            showSnack("Lỗi cập nhật kết quả VNPAY (EOF). Kiểm tra ngrok/public URL & mạng.")
                        }
                    } else {
                        showSnack("Lỗi cập nhật kết quả VNPAY: ${e.message}")
                    }
                } finally {
                    pendingOrderInfo = null
                }
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        modeBuyNow = arguments?.getBoolean(ARG_BUY_NOW) == true
        if (modeBuyNow) {
            product = arguments?.getParcelable(ARG_PRODUCT)
            quantity = arguments?.getInt(ARG_QTY) ?: 1
            if (quantity <= 0) quantity = 1
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, s: Bundle?): View {
        _binding = FragmentCheckoutBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(v: View, s: Bundle?) {
        super.onViewCreated(v, s)
        api = RetrofitClient.create(requireContext())
        session = SessionManager(requireContext())
        paymentsClient = GooglePayHelper.createClient(requireActivity())

        val methods = listOf("COD", "VNPAY", "GGPAY")
        binding.spPayment.adapter =
            ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, methods)

        paymentsClient.isReadyToPay(GooglePayHelper.buildIsReadyToPayRequest())
            .addOnCompleteListener { /* optional */ }

        binding.btnBack.setOnClickListener { parentFragmentManager.popBackStack() }
        binding.btnPlaceOrder.setOnClickListener { placeOrder() }

        if (session.isLoggedIn()) prefillFromProfile()
        if (modeBuyNow) showBuyNowSummary() else showCartSummary()
    }

    private fun prefillFromProfile() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res: Response<ApiResponse<UserInfo>> = withContext(Dispatchers.IO) { api.me() }
                val b = _binding ?: return@launch
                if (res.isSuccessful && res.body()?.success == true) {
                    res.body()?.data?.let { u ->
                        b.edtHoten.setText(u.hoten)
                        b.edtEmail.setText(u.email)
                        b.edtSdt.setText(u.sdt)
                        b.edtDiachi.setText(u.diachi)
                    }
                }
            } catch (_: Exception) { }
        }
    }

    private fun showBuyNowSummary() {
        val p = product ?: return
        binding.groupBuyNow.isVisible = true
        binding.groupCart.isVisible = false
        val total = p.giaBanAsDouble() * quantity
        binding.tvSummary.text = "Mua ngay: ${p.ten_san_pham} x $quantity\nTổng: ${nf.format(total)} đ"
    }

    private fun showCartSummary() {
        binding.groupBuyNow.isVisible = false
        binding.groupCart.isVisible = true
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res: Response<ApiResponse<CartPayload>> = withContext(Dispatchers.IO) { api.getCart() }
                val b = _binding ?: return@launch
                if (res.isSuccessful) {
                    val data = res.body()?.data
                    val items = data?.items.orEmpty()
                    val total = data?.totalAsDouble() ?: items.sumOf { it.giaBanAsDouble() * it.quantity }
                    b.tvCartTotal.text = "Tổng giỏ: ${nf.format(total)} đ"
                    b.tvCartCount.text = "Sản phẩm: ${items.size}"
                } else {
                    b.tvCartTotal.text = "Không đọc được giỏ hàng"
                    b.tvCartCount.text = ""
                }
            } catch (_: Exception) {
                _binding?.tvCartTotal?.text = "Không đọc được giỏ hàng"
                _binding?.tvCartCount?.text = ""
            }
        }
    }

    private fun placeOrder() {
        val hoten = binding.edtHoten.text.toString().trim()
        val email = binding.edtEmail.text.toString().trim()
        val sdt = binding.edtSdt.text.toString().trim()
        val diachi = binding.edtDiachi.text.toString().trim()
        val method = binding.spPayment.selectedItem?.toString() ?: "COD"

        if (hoten.isEmpty() || email.isEmpty() || sdt.isEmpty() || diachi.isEmpty()) {
            showSnack("Vui lòng nhập đủ họ tên, email, SĐT và địa chỉ")
            return
        }

        if (method == "GGPAY") {
            val totalVnd = if (modeBuyNow)
                ((product?.giaBanAsDouble() ?: 0.0) * quantity).toLong()
            else
                (binding.tvCartTotal.text.toString().replace(Regex("[^0-9]"), "").toLongOrNull() ?: 0L)
            openGooglePay(totalVnd)
            return
        }

        submitOrder(
            paymentToken = null,
            hoten = hoten, email = email, sdt = sdt, diachi = diachi, method = method
        )
    }

    private fun openGooglePay(totalVnd: Long) {
        try {
            val req: PaymentDataRequest =
                GooglePayHelper.buildPaymentDataRequest(requireActivity(), totalVnd)
            paymentsClient.loadPaymentData(req).addOnCompleteListener { task ->
                if (!isAdded || _binding == null) return@addOnCompleteListener
                try {
                    val paymentData = task.getResult(ApiException::class.java)
                    handlePaymentSuccess(paymentData)
                } catch (e: ApiException) {
                    when (e.statusCode) {
                        CommonStatusCodes.RESOLUTION_REQUIRED -> {
                            val rae = e as? ResolvableApiException ?: return@addOnCompleteListener
                            googlePayLauncher.launch(
                                androidx.activity.result.IntentSenderRequest.Builder(rae.resolution).build()
                            )
                        }
                        CommonStatusCodes.CANCELED -> showSnack("Đã huỷ Google Pay")
                        else -> showSnack("Google Pay lỗi: ${e.statusCode}")
                    }
                } catch (e: Exception) {
                    showSnack("Không thể mở Google Pay: ${e.message}")
                }
            }
        } catch (e: Exception) {
            showSnack("Không thể mở Google Pay: ${e.message}")
        }
    }

    private fun handlePaymentSuccess(paymentData: PaymentData?) {
        if (paymentData == null) { showSnack("Không lấy được dữ liệu thanh toán"); return }
        val json = paymentData.toJson() ?: return
        val token = try {
            val root = JSONObject(json)
            val methodData = root.optJSONObject("paymentMethodData")
            val tokenData = methodData?.optJSONObject("tokenizationData")
            tokenData?.optString("token", null)
        } catch (_: Exception) { null }

        if (token.isNullOrBlank()) { showSnack("Không lấy được token thanh toán"); return }

        submitOrder(
            paymentToken = token,
            hoten = binding.edtHoten.text.toString().trim(),
            email = binding.edtEmail.text.toString().trim(),
            sdt = binding.edtSdt.text.toString().trim(),
            diachi = binding.edtDiachi.text.toString().trim(),
            method = "GGPAY"
        )
    }

    private fun submitOrder(
        paymentToken: String?,
        hoten: String,
        email: String,
        sdt: String,
        diachi: String,
        method: String
    ) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res: Response<ApiResponse<JsonObj>> = if (modeBuyNow) {
                    val p = product ?: return@launch
                    withContext(Dispatchers.IO) {
                        // Gọi endpoint MUA NGAY mới
                        api.buyNow(
                            CheckoutBuyNowReq(
                                product_id = p.id,
                                quantity = quantity.coerceAtLeast(1),
                                hoten = hoten,
                                email = email,
                                sdt = sdt,
                                diachi_giaohang = diachi,
                                payment_method = method,
                                payment_token = paymentToken
                            )
                        )
                    }
                } else {
                    withContext(Dispatchers.IO) {
                        api.checkoutFromCart(
                            CheckoutFromCartReq(
                                hoten = hoten,
                                email = email,
                                sdt = sdt,
                                diachi_giaohang = diachi,
                                payment_method = method,
                                payment_token = paymentToken
                            )
                        )
                    }
                }

                if (_binding == null) return@launch

                if (res.isSuccessful && (res.body()?.success == true)) {
                    val data = res.body()!!.data as? JsonObj ?: emptyMap()

                    if (method == "VNPAY") {
                        val paymentUrl   = (data["payment_url"] as? String).orEmpty()
                        val returnPrefix = (data["return_url_prefix"] as? String).orEmpty()

                        // Lấy order_id từ top-level hoặc từ object con
                        val orderIdTop   = (data["order_id"] as? Number)?.toInt()
                            ?: (data["order_id"] as? String)?.toIntOrNull()
                        val orderObj     = (data["order"] as? Map<*, *>) ?: emptyMap<Any, Any>()
                        val orderIdInObj = (orderObj["order_id"] as? Number)?.toInt()
                            ?: (orderObj["order_id"] as? String)?.toIntOrNull()
                        val orderId      = orderIdTop ?: orderIdInObj ?: 0

                        if (paymentUrl.isBlank() || returnPrefix.isBlank() || orderId <= 0) {
                            showSnack("Thiếu payment_url / return_url_prefix / order_id từ server")
                            return@launch
                        }
                        val intent = Intent(requireContext(), VnPayWebViewActivity::class.java).apply {
                            putExtra(VnPayWebViewActivity.EXTRA_URL, paymentUrl)
                            putExtra(VnPayWebViewActivity.EXTRA_RETURN_URL_PREFIX, returnPrefix)
                        }
                        pendingOrderInfo = PendingOrder(orderId, hoten, email, sdt, diachi, method)
                        vnpayLauncher.launch(intent)
                        return@launch
                    }

                    showSuccessBillDialog(data, hoten, email, sdt, diachi, method)
                } else {
                    val rawErr = res.errorBody()?.string()
                    val nice = try {
                        if (!rawErr.isNullOrBlank()) {
                            val j = JSONObject(rawErr)
                            j.optString("message",
                                j.optString("msg",
                                    res.body()?.readableMessage("Đặt hàng thất bại") ?: "Đặt hàng thất bại"
                                )
                            )
                        } else {
                            res.body()?.readableMessage("Đặt hàng thất bại") ?: "Đặt hàng thất bại"
                        }
                    } catch (_: Exception) {
                        res.body()?.readableMessage("Đặt hàng thất bại") ?: "Đặt hàng thất bại"
                    }
                    showSnack("$nice (mã ${res.code()})")
                }
            } catch (e: Exception) {
                if (_binding == null) return@launch
                if (isEofError(e)) {
                    showSnack("Kết nối tới server gián đoạn (EOF). Vui lòng thử lại / kiểm tra ngrok.")
                } else {
                    showSnack("Lỗi kết nối: ${e.message}")
                }
            }
        }
    }

    // === Helpers: fetch & poll trạng thái đơn ===
    private suspend fun fetchOrder(orderId: Int): Map<String, Any>? =
        withContext(Dispatchers.IO) {
            try {
                val res = api.getOrders()
                if (res.isSuccessful && res.body()?.success == true) {
                    val list = res.body()!!.data as? List<Map<String, Any>> ?: emptyList()
                    list.firstOrNull { (it["order_id"] as? Number)?.toInt() == orderId }
                } else null
            } catch (_: Exception) {
                null
            }
        }

    private suspend fun fetchOrderWithRetry(orderId: Int, retries: Int, delayMs: Long): Map<String, Any>? {
        var attempt = 0
        var lastErr: Throwable? = null
        while (attempt <= retries) {
            try {
                val r = fetchOrder(orderId)
                if (r != null) return r
            } catch (e: Throwable) {
                lastErr = e
                if (!isEofError(e) && e !is IOException && e !is SSLException) break
            }
            attempt++
            delay(delayMs)
        }
        if (lastErr != null && isEofError(lastErr!!)) {
            showSnack("Kết nối gián đoạn (EOF) – đã thử lại $attempt lần.")
        }
        return null
    }

    private suspend fun pollOrderPaidFast(orderId: Int): Boolean {
        val fastEnd = System.currentTimeMillis() + 5_000
        while (System.currentTimeMillis() < fastEnd) {
            val order = fetchOrderWithRetry(orderId, retries = 1, delayMs = 200)
            val status = (order?.get("trangthai") as? String)?.trim()?.lowercase()
            if (status == "đã thanh toán" || status == "da thanh toan") return true
            delay(300)
        }
        val slowEnd = System.currentTimeMillis() + 5_000
        while (System.currentTimeMillis() < slowEnd) {
            val order = fetchOrderWithRetry(orderId, retries = 1, delayMs = 300)
            val status = (order?.get("trangthai") as? String)?.trim()?.lowercase()
            if (status == "đã thanh toán" || status == "da thanh toan") return true
            delay(1_000)
        }
        return false
    }

    private suspend fun pollOrderPaidBurst(orderId: Int): Boolean {
        repeat(5) {
            val order = fetchOrderWithRetry(orderId, retries = 1, delayMs = 150)
            val status = (order?.get("trangthai") as? String)?.trim()?.lowercase()
            if (status == "đã thanh toán" || status == "da thanh toan") return true
            delay(250)
        }
        return false
    }

    private fun isEofError(e: Throwable): Boolean =
        e is EOFException || e.message?.contains("end of stream", ignoreCase = true) == true

    private fun showSuccessBillDialog(
        data: JsonObj?,
        hoten: String,
        email: String,
        sdt: String,
        diachi: String,
        method: String
    ) {
        val order = (data?.get("order") as? JsonObj) ?: data ?: emptyMap()

        fun asInt(v: Any?): Int =
            (v as? Number)?.toInt()
                ?: (v as? String)?.toIntOrNull() ?: 0
        fun asDouble(v: Any?): Double =
            (v as? Number)?.toDouble()
                ?: (v as? String)?.toDoubleOrNull() ?: 0.0
        fun asStr(v: Any?): String = v?.toString().orEmpty()

        val orderId = asInt(order["order_id"])
        val tenSp   = asStr(order["ten_san_pham"])
        val qty     = asInt(order["soluong"]).takeIf { it > 0 } ?: quantity
        val total   = listOf(
            asDouble(order["tongtien"]),
            asDouble(order["total"])
        ).firstOrNull { it > 0 } ?: if (modeBuyNow) (product?.giaBanAsDouble() ?: 0.0) * quantity else 0.0
        val pay     = asStr(order["payment_method"]).ifBlank { method }
        val status  = asStr(order["trangthai"]).ifBlank {
            when (pay.uppercase()) {
                "GGPAY", "VNPAY" -> "Đã thanh toán"
                else              -> "Chờ xác nhận"
            }
        }

        val body = buildString {
            if (orderId > 0) append("Mã đơn: #$orderId\n")
            if (tenSp.isNotBlank()) append("Sản phẩm: $tenSp x $qty\n")
            append("Tổng: ${nf.format(total)} đ\n")
            append("Thanh toán: $pay\n")
            append("Trạng thái: $status\n\n")
            append("Người nhận: $hoten\n")
            append("Email: $email\n")
            append("SĐT: $sdt\n")
            append("Địa chỉ: $diachi")
        }

        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Đặt hàng thành công")
            .setMessage(body)
            .setCancelable(false)
            .setPositiveButton("Đóng") { _, _ -> parentFragmentManager.popBackStack() }
            .show()
    }

    private fun showVnPayFailDialog(
        order: Map<String, Any>,
        hoten: String,
        email: String,
        sdt: String,
        diachi: String
    ) {
        val orderId = (order["order_id"] as? Number)?.toInt()
            ?: (order["order_id"] as? String)?.toIntOrNull() ?: 0
        val status  = (order["trangthai"] as? String).orEmpty()
        val tenSp   = (order["ten_san_pham"] as? String).orEmpty()
        val qty     = (order["soluong"] as? Number)?.toInt() ?: quantity
        val total   = when (val t = order["tongtien"] ?: order["total"]) {
            is Number -> t.toDouble()
            is String -> t.toDoubleOrNull() ?: 0.0
            else -> 0.0
        }

        val body = buildString {
            append("Thanh toán VNPAY KHÔNG thành công.\n\n")
            if (orderId > 0) append("Mã đơn: #$orderId\n")
            if (tenSp.isNotBlank()) append("Sản phẩm: $tenSp x $qty\n")
            append("Tổng: ${nf.format(total)} đ\n")
            append("Trạng thái đơn: ${status.ifBlank { "Chờ xác nhận" }}\n\n")
            append("Bạn có thể thử thanh toán lại, chọn phương thức khác (COD/Google Pay) hoặc kiểm tra lịch sử đơn hàng.")
        }

        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Thanh toán thất bại")
            .setMessage(body)
            .setCancelable(false)
            .setPositiveButton("Thử lại") { _, _ -> }
            .setNegativeButton("Đóng") { _, _ -> }
            .show()
    }

    private fun showSnack(msg: String) {
        val b = _binding ?: return
        b.tvSnack.text = msg
        b.tvSnack.visibility = View.VISIBLE
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
        hideLoading()
    }
}
