package com.example.appthoitrang

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.google.android.material.imageview.ShapeableImageView
import java.text.NumberFormat
import java.util.Locale

class CartAdapter(
    private val items: MutableList<CartItem>,
    private val onPlus: (CartItem) -> Unit,
    private val onMinus: (CartItem) -> Unit,
    private val onDelete: (CartItem) -> Unit
) : RecyclerView.Adapter<CartAdapter.VH>() {


    class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvStt: TextView = v.findViewById(R.id.tvStt)
        val img: ImageView = v.findViewById(R.id.imgThumb)
        val tvId: TextView = v.findViewById(R.id.tvId)
        val tvName: TextView = v.findViewById(R.id.tvName)
        val tvMeta: TextView = v.findViewById(R.id.tvMeta)
        val tvPrice: TextView = v.findViewById(R.id.tvPrice)
        val tvQty: TextView = v.findViewById(R.id.tvQty)
        val btnPlus: View = v.findViewById(R.id.btnPlus)
        val btnMinus: View = v.findViewById(R.id.btnMinus)
        val btnDelete: ShapeableImageView = v.findViewById(R.id.btnDelete)
    }

    private val nf = NumberFormat.getNumberInstance(Locale("vi", "VN"))

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_cart, parent, false)
        return VH(v)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(h: VH, position: Int) {
        val item = items[position]

        // STT
        h.tvStt.text = (position + 1).toString()

        // Ảnh sản phẩm
        Glide.with(h.itemView)
            .load(item.hinh_anh)
            .centerCrop()
            .placeholder(android.R.color.darker_gray)
            .into(h.img)

        // Thông tin
        h.tvId.text = "ID: ${item.product_id}"
        h.tvName.text = item.ten_san_pham
        h.tvMeta.text = "Size: ${item.size ?: "-"}"

        // Giá + số lượng (gia_ban có thể là String/Number -> dùng helper)
        h.tvPrice.text = nf.format(item.giaBanAsDouble()) + " đ"
        h.tvQty.text = item.quantity.toString()

        // Hành động
        h.btnPlus.setOnClickListener { onPlus(item) }
        h.btnMinus.setOnClickListener { if (item.quantity > 0) onMinus(item) }
        h.btnDelete.setOnClickListener { onDelete(item) }
    }

    fun replaceAll(newItems: List<CartItem>) {
        items.clear()
        items.addAll(newItems)
        notifyDataSetChanged()
    }
}
