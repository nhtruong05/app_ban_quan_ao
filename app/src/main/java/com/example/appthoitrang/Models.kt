package com.example.appthoitrang

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize
import kotlinx.parcelize.RawValue
import java.text.NumberFormat
import java.util.Locale

// Dùng chung trong toàn app
typealias JsonObj = Map<String, Any>

// -------------------- Generic API wrapper --------------------
data class ApiResponse<T>(
    val success: Boolean = false,
    val data: T? = null,
    val message: String? = null,
    val msg: String? = null
) {
    fun readableMessage(defaultMsg: String) =
        when {
            !message.isNullOrBlank() -> message!!
            !msg.isNullOrBlank()     -> msg!!
            else                     -> defaultMsg
        }
}

// -------------------- Auth / User --------------------
data class RegisterReq(
    val taikhoan: String,
    val matkhau: String,
    val hoten: String,
    val email: String,
    val sdt: String,
    val diachi: String
)

data class LoginReq(val taikhoan: String, val matkhau: String)
data class LoginRes(val access_token: String, val user: UserInfo)

data class UserInfo(
    val taikhoan: String,
    val hoten: String,
    val email: String,
    val sdt: String,
    val diachi: String
)

// -------------------- Product --------------------
@Parcelize
data class Product(
    @SerializedName(value = "id", alternate = ["product_id", "products_id"])
    val id: Int,
    @SerializedName("ten_san_pham") val ten_san_pham: String,
    @SerializedName("gia_ban")      val gia_ban: @RawValue Any,
    @SerializedName("loai")         val loai: String? = null,
    @SerializedName("mo_ta")        val mo_ta: String? = null,
    @SerializedName("size")         val size: String? = null,
    @SerializedName("chat_lieu")    val chat_lieu: String? = null,
    @SerializedName("gioi_tinh")    val gioi_tinh: String? = null,
    @SerializedName("hinh_anh")     val hinh_anh: String? = null,
    @SerializedName("trang_thai")   val trang_thai: String? = null
) : Parcelable {
    fun giaBanAsDouble(): Double = when (gia_ban) {
        is Number -> (gia_ban as Number).toDouble()
        is String -> (gia_ban as String).toDoubleOrNull() ?: 0.0
        else      -> 0.0
    }
    fun getFullImageUrl(): String? {
        if (hinh_anh.isNullOrBlank()) return null
        if (hinh_anh.startsWith("http")) return hinh_anh
        return RetrofitClient.BASE_URL.trimEnd('/') + "/" + hinh_anh.trimStart('/')
    }
}

@Parcelize
data class ProductTop(
    @SerializedName(value = "id", alternate = ["product_id", "products_id"])
    val id: Int,
    @SerializedName("ten_san_pham") val ten_san_pham: String,
    @SerializedName("gia_ban")      val gia_ban: @RawValue Any,
    @SerializedName("loai")         val loai: String? = null,
    @SerializedName("mo_ta")        val mo_ta: String? = null,
    @SerializedName("size")         val size: String? = null,
    @SerializedName("chat_lieu")    val chat_lieu: String? = null,
    @SerializedName("gioi_tinh")    val gioi_tinh: String? = null,
    @SerializedName("hinh_anh")     val hinh_anh: String? = null,
    @SerializedName("trang_thai")   val trang_thai: String? = null,
    @SerializedName("total_sold")   val total_sold: Int = 0
) : Parcelable {
    fun giaBanAsDouble(): Double = when (gia_ban) {
        is Number -> (gia_ban as Number).toDouble()
        is String -> (gia_ban as String).toDoubleOrNull() ?: 0.0
        else      -> 0.0
    }
    fun getFullImageUrl(): String? {
        if (hinh_anh.isNullOrBlank()) return null
        if (hinh_anh.startsWith("http")) return hinh_anh
        return RetrofitClient.BASE_URL.trimEnd('/') + "/" + hinh_anh.trimStart('/')
    }
}

// -------------------- Suggest --------------------
data class SuggestItem(
    val id: Int,
    val name: String,
    val price: Double,
    val image: String?
)

// -------------------- Cart --------------------
data class AddToCartRequest(val product_id: Int, val quantity: Int)
data class UpdateQtyReq(val quantity: Int)

data class CartItem(
    @SerializedName(value = "cart_item_id", alternate = ["cart_id"])
    val cart_item_id: Int? = null,
    val product_id: Int,
    val quantity: Int,
    val ten_san_pham: String,
    val gia_ban: Any,
    val hinh_anh: String?,
    val size: String?,
    val chat_lieu: String?,
    val gioi_tinh: String?
) {
    fun giaBanAsDouble(): Double = when (gia_ban) {
        is Number -> (gia_ban as Number).toDouble()
        is String -> (gia_ban as String).toDoubleOrNull() ?: 0.0
        else      -> 0.0
    }
    fun getFullImageUrl(): String? {
        if (hinh_anh.isNullOrBlank()) return null
        if (hinh_anh.startsWith("http")) return hinh_anh
        return RetrofitClient.BASE_URL.trimEnd('/') + "/" + hinh_anh.trimStart('/')
    }
}

data class CartPayload(
    val items: List<CartItem>,
    val total_price: Any
) {
    fun totalAsDouble(): Double = when (total_price) {
        is Number -> (total_price as Number).toDouble()
        is String -> (total_price as String).toDoubleOrNull() ?: 0.0
        else      -> 0.0
    }
}

// -------------------- Checkout --------------------
data class CheckoutBuyNowReq(
    val product_id: Int,
    val quantity: Int,
    val hoten: String,
    val email: String,
    val sdt: String,
    val diachi_giaohang: String,
    val payment_method: String,
    val payment_token: String? = null
)

data class CheckoutFromCartReq(
    val from_cart: Boolean = true,
    val hoten: String,
    val email: String,
    val sdt: String,
    val diachi_giaohang: String,
    val payment_method: String,
    val payment_token: String? = null
)

// -------------------- Chatbot --------------------
data class ChatTurn(
    val role: String,      // "user" hoặc "assistant"
    val content: String
)

// Request khớp backend: { query, history: [{role,content}, ...] }
data class ChatReq(
    val query: String,
    val history: List<ChatTurn> = emptyList()
)

// Product rút gọn từ chatbot (khớp JSON backend trả về)
data class ChatProduct(
    val id: Int,
    val name: String,
    val price: Double,
    val image: String?,
    val category: String?,
    val size: String?,
    val material: String?,
    val gender: String?,
    val status: String?
)

// Response từ chatbot: text + products + intent
data class ChatRes(
    val response: String,
    val products: List<ChatProduct>?,
    val intent: String?
)

// -------------------- Extensions --------------------
fun Double.toVnd(): String {
    val nf = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))
    return nf.format(this)
}
fun Any?.asDoubleOrZero(): Double = when (this) {
    is Number -> this.toDouble()
    is String -> this.toDoubleOrNull() ?: 0.0
    else      -> 0.0
}
