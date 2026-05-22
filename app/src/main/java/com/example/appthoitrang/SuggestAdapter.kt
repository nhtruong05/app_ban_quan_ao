package com.example.appthoitrang

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide

class SuggestAdapter(
    private val onClick: (SuggestItem) -> Unit
) : ListAdapter<SuggestItem, SuggestAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<SuggestItem>() {
            override fun areItemsTheSame(oldItem: SuggestItem, newItem: SuggestItem) =
                oldItem.id == newItem.id
            override fun areContentsTheSame(oldItem: SuggestItem, newItem: SuggestItem) =
                oldItem == newItem
        }
    }

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        private val imgThumb: ImageView = view.findViewById(R.id.imgThumb)
        private val tvName: TextView = view.findViewById(R.id.tvName)
        private val tvPrice: TextView = view.findViewById(R.id.tvPrice)

        fun bind(item: SuggestItem) {
            tvName.text = item.name
            tvPrice.text = tvPrice.context.getString(R.string.price_format, item.price)

            Glide.with(imgThumb.context)
                .load(item.image)
                .placeholder(R.drawable.ic_placeholder)
                .into(imgThumb)

            itemView.setOnClickListener { onClick(item) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_suggest, parent, false)
        return VH(view)
    }

    override fun onBindViewHolder(holder: VH, position: Int) =
        holder.bind(getItem(position))
}
