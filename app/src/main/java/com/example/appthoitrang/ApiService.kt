package com.example.appthoitrang

import retrofit2.http.*
import retrofit2.Response as RetrofitResponse

// ======================= API SERVICE =======================
interface ApiService {

    // ---------- Auth ----------
    @POST("api/register")
    suspend fun register(@Body body: RegisterReq)
            : RetrofitResponse<ApiResponse<JsonObj>>

    @POST("api/login")
    suspend fun login(@Body body: LoginReq)
            : RetrofitResponse<ApiResponse<LoginRes>>

    @GET("api/me")
    suspend fun me(): RetrofitResponse<ApiResponse<UserInfo>>

    @GET("api/health")
    suspend fun health(): RetrofitResponse<ApiResponse<JsonObj>>

    // ---------- Products ----------
    @GET("api/products")
    suspend fun getProducts(
        @Query("q") q: String? = null,
        @Query("status") status: String? = null,
        @Query("gender") gender: String? = null,
        @Query("size") size: String? = null,
        @Query("category") category: String? = null,
        @Query("material") material: String? = null,
        @Query("price_min") priceMin: Int? = null,
        @Query("price_max") priceMax: Int? = null,
        @Query("page") page: Int? = 1,
        @Query("page_size") pageSize: Int? = 20
    ): RetrofitResponse<ApiResponse<List<Product>>>

    @GET("api/products/{id}")
    suspend fun getProduct(@Path("id") id: Int)
            : RetrofitResponse<ApiResponse<Product>>

    @GET("api/products/top")
    suspend fun getTopProducts(
        @Query("limit") limit: Int = 3
    ): RetrofitResponse<ApiResponse<List<ProductTop>>>

    // ---------- Suggest ----------
    @GET("api/products/suggest")
    suspend fun suggestProducts(
        @Query("q") q: String,
        @Query("limit") limit: Int = 6
    ): RetrofitResponse<ApiResponse<List<SuggestItem>>>

    // ---------- Cart ----------
    @GET("api/cart")
    suspend fun getCart(): RetrofitResponse<ApiResponse<CartPayload>>

    @POST("api/cart/add")
    suspend fun addToCart(@Body req: AddToCartRequest)
            : RetrofitResponse<ApiResponse<JsonObj>>

    @PUT("api/cart/item/{productId}")
    suspend fun updateCartItem(
        @Path("productId") productId: Int,
        @Body body: UpdateQtyReq
    ): RetrofitResponse<ApiResponse<JsonObj>>

    @DELETE("api/cart/item/{productId}")
    suspend fun deleteCartItem(@Path("productId") productId: Int)
            : RetrofitResponse<ApiResponse<JsonObj>>

    @DELETE("api/cart/clear")
    suspend fun clearCart(): RetrofitResponse<ApiResponse<JsonObj>>

    // ---------- Checkout / Orders ----------
    @POST("api/buy_now")
    suspend fun buyNow(@Body body: CheckoutBuyNowReq)
            : RetrofitResponse<ApiResponse<JsonObj>>

    @POST("api/checkout")
    suspend fun checkoutFromCart(@Body body: CheckoutFromCartReq)
            : RetrofitResponse<ApiResponse<JsonObj>>

    @GET("api/orders")
    suspend fun getOrders()
            : RetrofitResponse<ApiResponse<List<JsonObj>>>

    // ---------- Chatbot AI ----------
    @POST("api/chat")
    suspend fun chat(@Body body: ChatReq)
            : RetrofitResponse<ApiResponse<ChatRes>>
}
