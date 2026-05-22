package com.example.appthoitrang

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.AsyncListDiffer
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.DecodeFormat
import com.bumptech.glide.load.engine.DiskCacheStrategy

class HomeTopAdapter(
    private val onClick: (ProductTop) -> Unit
) : RecyclerView.Adapter<HomeTopAdapter.VH>() {

    /** DiffUtil để cập nhật mượt hơn thay cho notifyDataSetChanged */
    private val DIFF = object : DiffUtil.ItemCallback<ProductTop>() {
        override fun areItemsTheSame(old: ProductTop, new: ProductTop) = old.id == new.id
        override fun areContentsTheSame(old: ProductTop, new: ProductTop) = old == new
    }
    private val differ = AsyncListDiffer(this, DIFF)

    /** Giữ nguyên API cũ để HomeFragment không phải sửa */
    fun submit(items: List<ProductTop>) {
        differ.submitList(items)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_top_product, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(differ.currentList[position], onClick)
    }

    override fun getItemCount(): Int = differ.currentList.size

    class VH(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val ivThumb: ImageView = itemView.findViewById(R.id.ivThumb)
        private val ivHot: ImageView = itemView.findViewById(R.id.ivHot)
        private val tvName: TextView = itemView.findViewById(R.id.tvName)
        private val tvId: TextView = itemView.findViewById(R.id.tvId)
        private val tvPrice: TextView = itemView.findViewById(R.id.tvPrice)
        private val tvSold: TextView = itemView.findViewById(R.id.tvSold)

        fun bind(item: ProductTop, onClick: (ProductTop) -> Unit) {
            tvName.text = item.ten_san_pham
            tvId.text = "#${item.id}"
            tvPrice.text = item.giaBanAsDouble().toVnd()
            tvSold.text = "Đã bán: ${item.total_sold}"

            // --- Chuẩn hoá URL ảnh: thay host cũ -> BASE_URL hiện tại, hỗ trợ cả relative path ---
            val normalizedUrl = RetrofitClient.absoluteUrl(
                RetrofitClient.normalizeToBase(item.hinh_anh)
            )

            // ẢNH SẢN PHẨM — thêm timeout/format để đỡ tốn RAM và tránh block UI
            Glide.with(itemView)
                .load(normalizedUrl)
                .placeholder(android.R.drawable.ic_menu_gallery)
                .error(android.R.drawable.ic_menu_report_image)
                .timeout(5_000)
                .diskCacheStrategy(DiskCacheStrategy.AUTOMATIC)
                .format(DecodeFormat.PREFER_RGB_565)
                .dontAnimate()
                .centerCrop()
                .into(ivThumb)

            // Icon "HOT" động (GIF), fallback về drawable tĩnh nếu môi trường không hỗ trợ
            ivHot.visibility = View.VISIBLE
            try {
                Glide.with(itemView)
                    .asGif()
                    .load(R.drawable.icon_hot)
                    .diskCacheStrategy(DiskCacheStrategy.AUTOMATIC)
                    .into(ivHot)
            } catch (_: Exception) {
                ivHot.setImageResource(R.drawable.icon_hot)
            }

            itemView.setOnClickListener { onClick(item) }
        }
    }
}
