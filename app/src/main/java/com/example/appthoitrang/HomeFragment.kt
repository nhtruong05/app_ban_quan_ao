package com.example.appthoitrang

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.AlphaAnimation
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.appthoitrang.ChatbotActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class HomeFragment : Fragment() {

    private lateinit var api: ApiService
    private lateinit var session: SessionManager

    private lateinit var rvTop: RecyclerView
    private lateinit var tvBestSellerTitle: View
    private lateinit var cardChat: View

    private val topAdapter by lazy {
        HomeTopAdapter { item: ProductTop ->
            // Chuyển ProductTop -> Product để dùng lại ProductDetailFragment
            val p = Product(
                id = item.id,
                ten_san_pham = item.ten_san_pham,
                gia_ban = item.gia_ban,
                loai = item.loai,
                mo_ta = item.mo_ta,
                size = item.size,
                chat_lieu = item.chat_lieu,
                gioi_tinh = item.gioi_tinh,
                // CHÚ Ý: chuẩn hoá URL trước khi dùng ở màn chi tiết
                hinh_anh = RetrofitClient.absoluteUrl(RetrofitClient.normalizeToBase(item.hinh_anh)),
                trang_thai = item.trang_thai
            )
            parentFragmentManager.beginTransaction()
                .replace(R.id.fragment_container, ProductDetailFragment.newInstance(p))
                .addToBackStack("product_detail_from_home_top")
                .commit()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        api = RetrofitClient.create(requireContext())
        session = SessionManager(requireContext())
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_home, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        rvTop = view.findViewById(R.id.rvTopProducts)
        tvBestSellerTitle = view.findViewById(R.id.tvBestSellerTitle)
        cardChat = view.findViewById(R.id.cardChat)

        // Nhấp nháy "Bán chạy nhất"
        tvBestSellerTitle.startAnimation(
            AlphaAnimation(0.5f, 1f).apply {
                duration = 1000
                repeatMode = AlphaAnimation.REVERSE
                repeatCount = AlphaAnimation.INFINITE
            }
        )

        rvTop.layoutManager = LinearLayoutManager(
            requireContext(),
            LinearLayoutManager.HORIZONTAL,
            false
        )
        rvTop.setHasFixedSize(true)
        rvTop.adapter = topAdapter

        loadTopProducts()

        cardChat.setOnClickListener {
            if (session.getToken().isNullOrBlank()) {
                Toast.makeText(
                    requireContext(),
                    "Vui lòng đăng nhập để dùng Chatbot AI.",
                    Toast.LENGTH_SHORT
                ).show()
                return@setOnClickListener
            }
            startActivity(Intent(requireContext(), ChatbotActivity::class.java))
        }
    }

    private fun loadTopProducts() {
        viewLifecycleOwner.lifecycleScope.launch(Dispatchers.IO) {
            try {
                val res = api.getTopProducts(limit = 3)
                val body = res.body()
                val list = if (res.isSuccessful && body?.success == true) {
                    // Chuẩn hoá URL ảnh của từng item ngay khi nhận
                    body.data.orEmpty().map { it.copy(
                        hinh_anh = RetrofitClient.absoluteUrl(RetrofitClient.normalizeToBase(it.hinh_anh))
                    ) }
                } else emptyList()

                withContext(Dispatchers.Main) {
                    topAdapter.submit(list)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(
                        requireContext(),
                        "Không tải được danh sách bán chạy.",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }
}
