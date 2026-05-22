package com.example.appthoitrang

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.appthoitrang.databinding.FragmentProductsBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ProductsFragment : Fragment() {

    private var _binding: FragmentProductsBinding? = null
    private val binding get() = _binding!!

    private lateinit var api: ApiService

    private val adapter = ProductAdapter { product ->
        if (product.id <= 0) return@ProductAdapter
        parentFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, ProductDetailFragment.newInstance(product))
            .addToBackStack("product_detail")
            .commit()
    }

    // ---- Filters ----
    private var status: String? = null
    private var priceMin: Int? = null
    private var priceMax: Int? = null
    private var size: String? = null
    private var gender: String? = null
    private var category: String? = null
    private var material: String? = null

    // ---- Pagination ----
    private var currentPage = 1
    private val pageSize = 5
    private var hasNextPage = true

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProductsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        api = RetrofitClient.create(requireContext())

        binding.rvProducts.apply {
            layoutManager = LinearLayoutManager(requireContext())
            setHasFixedSize(true) // giảm layout pass, mượt hơn
            adapter = this@ProductsFragment.adapter
        }

        binding.swipe.setOnRefreshListener { loadProducts() }

        binding.btnToggleFilter.setOnClickListener {
            binding.filterPanel.isVisible = !binding.filterPanel.isVisible
        }

        // ---- Status (tiếng Việt) ----
        binding.chipAll.setOnClickListener    { status = null;         loadFirstPage() }
        binding.chipOnSale.setOnClickListener { status = "Đang bán";   loadFirstPage() }
        binding.chipOut.setOnClickListener    { status = "Ngừng bán";  loadFirstPage() }

        // ---- Price ----
        binding.chipPriceAll.setOnClickListener  { priceMin = null;     priceMax = null;     loadFirstPage() }
        binding.chipPriceLow.setOnClickListener  { priceMin = 0;        priceMax = 200_000;  loadFirstPage() }
        binding.chipPriceMid.setOnClickListener  { priceMin = 200_000;  priceMax = 500_000;  loadFirstPage() }
        binding.chipPriceHigh.setOnClickListener { priceMin = 500_000;  priceMax = null;     loadFirstPage() }

        // ---- Size ----
        binding.chipSizeAll.setOnClickListener { size = null;  loadFirstPage() }
        binding.chipSizeS.setOnClickListener   { size = "S";   loadFirstPage() }
        binding.chipSizeM.setOnClickListener   { size = "M";   loadFirstPage() }
        binding.chipSizeL.setOnClickListener   { size = "L";   loadFirstPage() }
        binding.chipSizeXL.setOnClickListener  { size = "XL";  loadFirstPage() }

        // ---- Gender ----
        binding.chipGenderAll.setOnClickListener { gender = null;     loadFirstPage() }
        binding.chipMale.setOnClickListener      { gender = "Nam";    loadFirstPage() }
        binding.chipFemale.setOnClickListener    { gender = "Nữ";     loadFirstPage() }
        binding.chipUnisex.setOnClickListener    { gender = "Unisex"; loadFirstPage() }

        // ---- Category ----
        binding.chipCatAll.setOnClickListener  { category = null;   loadFirstPage() }
        binding.chipCatAo.setOnClickListener   { category = "Áo";   loadFirstPage() }
        binding.chipCatQuan.setOnClickListener { category = "Quần"; loadFirstPage() }

        // ---- Material ----
        binding.chipMatAll.setOnClickListener  { material = null;        loadFirstPage() }
        binding.chipCotton.setOnClickListener  { material = "Cotton";    loadFirstPage() }
        binding.chipPoly.setOnClickListener    { material = "Polyester"; loadFirstPage() }
        binding.chipJean.setOnClickListener    { material = "Jean";      loadFirstPage() }
        binding.chipLeather.setOnClickListener { material = "Da";        loadFirstPage() }

        binding.btnPrev.setOnClickListener {
            if (currentPage > 1) {
                currentPage--
                loadProducts()
            }
        }
        binding.btnNext.setOnClickListener {
            if (hasNextPage) {
                currentPage++
                loadProducts()
            }
        }

        loadFirstPage()
    }

    private fun loadFirstPage() {
        currentPage = 1
        loadProducts()
    }

    private fun loadProducts() {
        _binding?.let { it.swipe.isRefreshing = true }

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res = withContext(Dispatchers.IO) {
                    api.getProducts(
                        status = status,
                        gender = gender,
                        size = size,
                        category = category,
                        material = material,
                        priceMin = priceMin,
                        priceMax = priceMax,
                        page = currentPage,
                        pageSize = pageSize
                    )
                }

                val b = _binding ?: return@launch
                val payload = res.body()
                val list = if (res.isSuccessful && payload?.success == true) {
                    payload.data.orEmpty()
                } else emptyList()

                val clean = list.filter { it.id > 0 }

                adapter.submitList(clean)
                b.tvEmpty.visibility = if (clean.isEmpty()) View.VISIBLE else View.GONE

                hasNextPage = clean.size == pageSize
                b.tvPage.text = "Trang $currentPage"
                b.btnPrev.isEnabled = currentPage > 1
                b.btnNext.isEnabled = hasNextPage
                b.paginationBar.isVisible = clean.isNotEmpty()

            } catch (_: Exception) {
                val b = _binding ?: return@launch
                adapter.submitList(emptyList())
                b.tvEmpty.visibility = View.VISIBLE
                b.paginationBar.isVisible = false
            } finally {
                _binding?.let { it.swipe.isRefreshing = false }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
