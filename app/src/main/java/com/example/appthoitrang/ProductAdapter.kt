package com.example.appthoitrang

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.DecodeFormat
import com.bumptech.glide.load.engine.DiskCacheStrategy
import com.bumptech.glide.request.target.Target
import java.text.NumberFormat
import java.util.Locale

class ProductAdapter(
    private val onClick: (Product) -> Unit
) : ListAdapter<Product, ProductAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<Product>() {
            override fun areItemsTheSame(oldItem: Product, newItem: Product) = oldItem.id == newItem.id
            override fun areContentsTheSame(oldItem: Product, newItem: Product) = oldItem == newItem
        }

        private val vndFormat: NumberFormat = NumberFormat.getInstance(Locale("vi", "VN"))
    }

    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val img: ImageView = v.findViewById(R.id.img)
        val tvId: TextView = v.findViewById(R.id.tvId)
        val tvName: TextView = v.findViewById(R.id.tvName)
        val tvCategorySize: TextView = v.findViewById(R.id.tvCategorySize)
        val tvMaterialGender: TextView = v.findViewById(R.id.tvMaterialGender)
        val tvPrice: TextView = v.findViewById(R.id.tvPrice)
        val tvStatus: TextView = v.findViewById(R.id.tvStatus)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_product, parent, false)
        return VH(view)
    }

    override fun onBindViewHolder(h: VH, position: Int) {
        val p = getItem(position)

        // --- ẢNH: chuẩn hoá URL để tránh 404 khi thay ngrok ---
        val normalizedUrl = normalizedImageUrl(p.hinh_anh)

        // Dùng built-in placeholder/error để không phụ thuộc drawable tuỳ biến
        Glide.with(h.itemView.context)
            .load(normalizedUrl)
            .placeholder(android.R.drawable.ic_menu_gallery)
            .error(android.R.drawable.ic_menu_report_image)
            .timeout(5_000)
            .diskCacheStrategy(DiskCacheStrategy.AUTOMATIC)
            .format(DecodeFormat.PREFER_RGB_565)  // giảm memory footprint
            .dontAnimate()
            // .override(Target.SIZE_ORIGINAL) // hoặc .override(w,h) nếu bạn biết kích thước item
            .centerCrop()
            .into(h.img)

        // ID + Tên
        h.tvId.text = "ID: ${p.id}"
        h.tvName.text = p.ten_san_pham

        // Meta
        val loai = p.loai ?: "-"
        val sz = p.size ?: "-"
        val cl = p.chat_lieu ?: "-"
        val gt = p.gioi_tinh ?: "-"
        h.tvCategorySize.text = "$loai  •  Size: $sz"
        h.tvMaterialGender.text = "Chất liệu: $cl  •  $gt"

        // Giá
        h.tvPrice.text = "${vndFormat.format(p.giaBanAsDouble())} đ"

        // Trạng thái (tiếng Việt trong DB)
        val isOnSale = p.trang_thai == "Đang bán"
        h.tvStatus.text = if (isOnSale) "Đang bán" else "Ngừng bán"
        val color = ContextCompat.getColor(
            h.itemView.context,
            if (isOnSale) R.color.status_on_sale else R.color.status_off_sale
        )
        h.tvStatus.setTextColor(color)

        // Click item
        h.itemView.setOnClickListener { if (p.id > 0) onClick(p) }
    }

    /** Chuẩn hoá URL ảnh: thay domain cũ -> BASE_URL hiện tại hoặc build từ relative path. */
    private fun normalizedImageUrl(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        // 1) Nếu server trả sai domain cũ -> thay host về BASE_URL hiện tại, giữ nguyên path
        val fixedHost = RetrofitClient.normalizeToBase(raw)
        // 2) Nếu server trả relative path -> build tuyệt đối từ BASE_URL
        return RetrofitClient.absoluteUrl(fixedHost)
    }
}
