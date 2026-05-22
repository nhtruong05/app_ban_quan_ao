package com.example.appthoitrang

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.appthoitrang.ChatProduct
import com.example.appthoitrang.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ChatAdapter(
    private val callbacks: Callbacks
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    interface Callbacks {
        fun onOpenProduct(p: ChatProduct)
        fun onAddToCart(p: ChatProduct)
    }

    private val data = mutableListOf<ChatMessage>()

    fun submit(msgs: List<ChatMessage>) {
        data.clear()
        data.addAll(msgs)
        notifyDataSetChanged()
    }

    fun add(message: ChatMessage) {
        data.add(message)
        notifyItemInserted(data.size - 1)
    }

    override fun getItemCount(): Int = data.size

    override fun getItemViewType(position: Int): Int = when (data[position].kind) {
        ChatKind.USER    -> 0
        ChatKind.BOT     -> 1
        ChatKind.PRODUCT -> 2
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            1 -> BotVH(inflater.inflate(R.layout.item_message_bot, parent, false))
            2 -> ProductVH(inflater.inflate(R.layout.item_chat_product_card, parent, false), callbacks)
            else -> UserVH(inflater.inflate(R.layout.item_message_user, parent, false))
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val msg = data[position]
        when (holder) {
            is BotVH     -> holder.bind(msg)
            is UserVH    -> holder.bind(msg)
            is ProductVH -> msg.product?.let { holder.bind(it, msg.time) }
        }
    }

    class UserVH(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tv: TextView = itemView.findViewById(R.id.tvMsg)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)

        fun bind(msg: ChatMessage) {
            tv.text = msg.text.orEmpty()
            val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
            tvTime.text = timeFormat.format(Date(msg.time))
        }
    }

    class BotVH(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tv: TextView = itemView.findViewById(R.id.tvMsg)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)

        fun bind(msg: ChatMessage) {
            tv.text = msg.text.orEmpty()
            val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
            tvTime.text = timeFormat.format(Date(msg.time))
        }
    }

    class ProductVH(
        itemView: View,
        private val callbacks: Callbacks
    ) : RecyclerView.ViewHolder(itemView) {

        private val iv: ImageView = itemView.findViewById(R.id.img)
        private val tvName: TextView = itemView.findViewById(R.id.tvName)
        private val tvPrice: TextView = itemView.findViewById(R.id.tvPrice)
        private val tvMeta: TextView = itemView.findViewById(R.id.tvMeta)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)
        private val btnAdd: Button = itemView.findViewById(R.id.btnAdd)
        private val btnDetail: Button = itemView.findViewById(R.id.btnDetail)

        fun bind(p: ChatProduct, timeMillis: Long) {
            tvName.text = p.name
            tvPrice.text = "%.0f đ".format(p.price)
            val meta = buildString {
                p.category?.let { append(it) }
                if (!p.size.isNullOrBlank()) append(" • Size: ${p.size}")
                if (!p.material.isNullOrBlank()) append(" • ${p.material}")
                if (!p.gender.isNullOrBlank()) append(" • ${p.gender}")
                if (!p.status.isNullOrBlank()) append(" • ${p.status}")
            }
            tvMeta.text = meta

            Glide.with(itemView)
                .load(p.image)
                .centerCrop()
                .placeholder(android.R.color.darker_gray)
                .error(android.R.color.darker_gray)
                .into(iv)

            val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
            tvTime.text = timeFormat.format(Date(timeMillis))

            btnAdd.setOnClickListener { callbacks.onAddToCart(p) }
            btnDetail.setOnClickListener { callbacks.onOpenProduct(p) }
            itemView.setOnClickListener { callbacks.onOpenProduct(p) }
        }
    }
}
