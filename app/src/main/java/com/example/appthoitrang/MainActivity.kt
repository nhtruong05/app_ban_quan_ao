package com.example.appthoitrang

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.google.android.material.bottomnavigation.BottomNavigationView

class MainActivity : AppCompatActivity() {

    private val homeFragment by lazy { HomeFragment() }
    private val productsFragment by lazy { ProductsFragment() }
    private val searchFragment by lazy { SearchFragment() }
    private val cartFragment by lazy { CartFragment() }
    private val userFragment by lazy { UserFragment() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val bottomNav = findViewById<BottomNavigationView>(R.id.bottom_nav)

        // ==== Điều hướng mặc định ====
        if (savedInstanceState == null) {
            replaceFragment(homeFragment)
        }

        // ==== Nếu được gọi từ ChatbotActivity ====
        val navigateTo = intent?.getStringExtra("navigate_to")
        when (navigateTo) {
            "login" -> {
                supportFragmentManager.beginTransaction()
                    .replace(R.id.fragment_container, UserFragment.newInstance(openedForAuth = true))
                    .addToBackStack("login")
                    .commit()
            }
            "product_detail" -> {
                val productId = intent.getIntExtra("product_id", -1)
                if (productId > 0) {
                    val stub = Product(
                        id = productId,
                        ten_san_pham = intent.getStringExtra("product_name") ?: "",
                        gia_ban = intent.getDoubleExtra("product_price", 0.0),
                        loai = intent.getStringExtra("product_category"),
                        mo_ta = null,
                        size = intent.getStringExtra("product_size"),
                        chat_lieu = intent.getStringExtra("product_material"),
                        gioi_tinh = intent.getStringExtra("product_gender"),
                        hinh_anh = intent.getStringExtra("product_image"),
                        trang_thai = intent.getStringExtra("product_status")
                    )
                    supportFragmentManager.beginTransaction()
                        .replace(R.id.fragment_container, ProductDetailFragment.newInstance(stub))
                        .addToBackStack("product_detail")
                        .commit()
                }
            }
        }

        // ==== Xử lý điều hướng bottom nav ====
        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_home     -> replaceFragment(homeFragment)
                R.id.nav_products -> replaceFragment(productsFragment)
                R.id.nav_search   -> replaceFragment(searchFragment)
                R.id.nav_cart     -> replaceFragment(cartFragment)
                R.id.nav_user     -> replaceFragment(userFragment)
                else -> false
            }
            true
        }
    }

    private fun replaceFragment(fragment: Fragment): Boolean {
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commit()
        return true
    }
}
