package app.dshremote.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import app.dshremote.R
import app.dshremote.data.Host
import app.dshremote.databinding.ItemHostBinding

class HostAdapter(
    private val onClick: (Host) -> Unit,
    private val onLongClick: (Host) -> Unit,
) : RecyclerView.Adapter<HostAdapter.Holder>() {

    private val items = mutableListOf<Host>()

    fun submit(list: List<Host>) {
        items.clear()
        items.addAll(list)
        notifyDataSetChanged()
    }

    inner class Holder(val binding: ItemHostBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
        Holder(ItemHostBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val host = items[position]
        holder.binding.name.text = host.name
        holder.binding.detail.text = detailOf(host)
        holder.binding.dot.setBackgroundResource(
            if (System.currentTimeMillis() - host.lastSeen < FIVE_MINUTES) {
                R.drawable.dot_online
            } else {
                R.drawable.dot_offline
            },
        )
        holder.binding.root.setOnClickListener { onClick(host) }
        holder.binding.root.setOnLongClickListener {
            onLongClick(host)
            true
        }
    }

    private fun detailOf(host: Host): String {
        val address = host.url
            .removePrefix("http://")
            .removePrefix("https://")
            .trimEnd('/')
        val seen = if (host.lastSeen <= 0L) {
            "未连接"
        } else {
            val minutes = (System.currentTimeMillis() - host.lastSeen) / 60_000L
            when {
                minutes < 1 -> "刚刚在线"
                minutes < 60 -> "$minutes 分钟前"
                else -> "${minutes / 60} 小时前"
            }
        }
        return "$address · $seen"
    }

    companion object {
        private const val FIVE_MINUTES = 5 * 60_000L
    }
}
