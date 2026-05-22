package com.example.appthoitrang

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.PopupMenu
import androidx.appcompat.widget.Toolbar
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.appthoitrang.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale



class ChatbotActivity : AppCompatActivity(), ChatAdapter.Callbacks {

    private lateinit var api: ApiService
    private lateinit var session: SessionManager

    private lateinit var rv: RecyclerView
    private lateinit var et: EditText
    private lateinit var btnSend: Button
    private lateinit var adapter: ChatAdapter

    // UI state hiện tại (đoạn chat đang mở)
    private val messages = mutableListOf<ChatMessage>()

    // Danh sách tất cả cuộc hội thoại
    private val conversations = mutableListOf<Conversation>()
    private var activeConversationId: Long? = null

    // SharedPreferences
    private val PREF_CHAT = "chat_pref"
    private val KEY_CONVERSATIONS = "chat_conversations"
    private val KEY_ACTIVE_ID = "chat_active_id"

    private val prefs by lazy {
        getSharedPreferences(PREF_CHAT, MODE_PRIVATE)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chatbot)

        api = RetrofitClient.create(this)
        session = SessionManager(this)

        // ---- Bắt buộc login để dùng Chatbot ----
        if (!session.isLoggedIn()) {
            AlertDialog.Builder(this)
                .setTitle("Yêu cầu đăng nhập")
                .setMessage("Bạn cần đăng nhập để sử dụng Chatbot AI.\nBạn có muốn chuyển sang trang đăng nhập không?")
                .setPositiveButton("Có") { _, _ ->
                    val intent = Intent(this, MainActivity::class.java).apply {
                        putExtra("navigate_to", "login")
                    }
                    startActivity(intent)
                    finish()
                }
                .setNegativeButton("Không") { _, _ -> finish() }
                .setCancelable(false)
                .show()
            return
        }

        val toolbar = findViewById<Toolbar>(R.id.chatToolbar)
        setSupportActionBar(toolbar)

        // NHẤN ICON 3 GẠCH -> HIỆN MENU (Lịch sử / Đoạn mới / Thoát)
        toolbar.setNavigationOnClickListener {
            showNavMenu(it)
        }

        rv      = findViewById(R.id.rvMessages)
        et      = findViewById(R.id.etMessage)
        btnSend = findViewById(R.id.btnSend)

        adapter = ChatAdapter(this)
        rv.layoutManager = LinearLayoutManager(this).apply { stackFromEnd = true }
        rv.adapter = adapter

        // Load tất cả conversation + đoạn đang active
        loadAllConversations()

        btnSend.setOnClickListener { sendMessage() }
        et.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEND || actionId == EditorInfo.IME_ACTION_DONE) {
                sendMessage()
                true
            } else false
        }
    }

    // ------ MENU NAVIGATION (3 GẠCH) ------
    private fun showNavMenu(anchor: View) {
        val popup = PopupMenu(this, anchor)
        popup.menuInflater.inflate(R.menu.menu_chatbot, popup.menu)
        popup.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                R.id.action_history -> {
                    showConversationChooser()
                    true
                }
                R.id.action_new_chat -> {
                    startNewChat()
                    true
                }
                R.id.action_exit -> {
                    finish()
                    true
                }
                else -> false
            }
        }
        popup.show()
    }

    // =================== Callbacks từ Adapter ===================
    override fun onOpenProduct(p: ChatProduct) {
        // Mở MainActivity và hiển thị ProductDetailFragment
        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra("navigate_to", "product_detail")
            putExtra("product_id", p.id)
            putExtra("product_name", p.name)
            putExtra("product_price", p.price)
            putExtra("product_category", p.category)
            putExtra("product_size", p.size)
            putExtra("product_material", p.material)
            putExtra("product_gender", p.gender)
            putExtra("product_image", p.image)
            putExtra("product_status", p.status)
        }
        startActivity(intent)
    }

    override fun onAddToCart(p: ChatProduct) {
        if (!session.isLoggedIn()) {
            Toast.makeText(this, "Bạn cần đăng nhập để thêm vào giỏ", Toast.LENGTH_SHORT).show()
            return
        }
        lifecycleScope.launch {
            try {
                val res = withContext(Dispatchers.IO) {
                    api.addToCart(AddToCartRequest(product_id = p.id, quantity = 1))
                }
                if (res.isSuccessful && (res.body()?.success == true)) {
                    Toast.makeText(this@ChatbotActivity, "Đã thêm vào giỏ!", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(
                        this@ChatbotActivity,
                        res.body()?.readableMessage("Không thể thêm vào giỏ") ?: "Không thể thêm vào giỏ",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            } catch (_: Exception) {
                Toast.makeText(this@ChatbotActivity, "Lỗi kết nối, vui lòng thử lại", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // =================== Gửi tin nhắn ===================
    private fun sendMessage() {
        val text = et.text?.toString()?.trim().orEmpty()
        if (text.isBlank()) return

        addUser(text)
        et.setText("")
        addBot("Đang soạn trả lời…")

        lifecycleScope.launch(Dispatchers.IO) {
            // ---- GỬI HISTORY CHO BACKEND ----
            val hist: List<ChatTurn> = messages
                .takeLast(6)
                .filter { it.kind != ChatKind.PRODUCT && !it.text.isNullOrBlank() }
                .map {
                    if (it.fromBot) ChatTurn(role = "assistant", content = it.text!!)
                    else            ChatTurn(role = "user",      content = it.text!!)
                }

            val errorText = try {
                val res = api.chat(ChatReq(query = text, history = hist))
                val body = res.body()
                if (res.isSuccessful && body?.success == true) {
                    val payload = body.data
                    val botText = payload?.response?.ifBlank { null }
                        ?: body.readableMessage("AI chưa có phản hồi.")

                    withContext(Dispatchers.Main) {
                        // cập nhật câu trả lời text
                        replaceLastBot(botText)
                        // nếu có products thì hiển thị card
                        if (!payload?.products.isNullOrEmpty()) {
                            addProductCards(payload!!.products!!.take(6))
                        }
                        scrollToBottom()
                    }
                    null
                } else {
                    body?.readableMessage("Có lỗi khi gọi AI.") ?: "Có lỗi khi gọi AI."
                }
            } catch (_: Exception) {
                "Không thể kết nối máy chủ. Vui lòng thử lại."
            }

            if (errorText != null) {
                withContext(Dispatchers.Main) {
                    replaceLastBot(errorText)
                    scrollToBottom()
                }
            }
        }
    }

    private fun addUser(t: String) {
        messages.add(
            ChatMessage(
                text = t,
                fromBot = false,
                kind = ChatKind.USER
            )
        )
        adapter.submit(messages.toList())
        scrollToBottom()
        saveAllConversations()
    }

    private fun addBot(t: String) {
        messages.add(
            ChatMessage(
                text = t,
                fromBot = true,
                kind = ChatKind.BOT
            )
        )
        adapter.submit(messages.toList())
        scrollToBottom()
        saveAllConversations()
    }

    private fun replaceLastBot(t: String) {
        for (i in messages.size - 1 downTo 0) {
            if (messages[i].fromBot && messages[i].kind == ChatKind.BOT) {
                val old = messages[i]
                messages[i] = ChatMessage(
                    text = t,
                    fromBot = true,
                    time = old.time,
                    product = old.product,
                    kind = ChatKind.BOT
                )
                adapter.submit(messages.toList())
                saveAllConversations()
                return
            }
        }
        addBot(t) // nếu không tìm thấy bot trước đó thì thêm mới
    }

    private fun addProductCards(list: List<ChatProduct>) {
        val now = System.currentTimeMillis()
        list.forEach { p ->
            messages.add(
                ChatMessage(
                    text = null,
                    fromBot = true,
                    time = now,
                    product = p,
                    kind = ChatKind.PRODUCT
                )
            )
        }
        adapter.submit(messages.toList())
        saveAllConversations()
    }

    private fun scrollToBottom() {
        rv.post { rv.scrollToPosition(adapter.itemCount - 1) }
    }

    // --------- ĐOẠN CHAT MỚI ---------
    private fun startNewChat() {
        if (messages.isEmpty()) {
            messages.clear()
            adapter.submit(emptyList())
            scrollToBottom()
            return
        }

        saveAllConversations()

        val now = System.currentTimeMillis()
        val newConv = Conversation(
            id = now,
            title = "Đoạn chat mới",
            createdAt = now,
            updatedAt = now,
            messages = mutableListOf()
        )
        conversations.add(newConv)
        activeConversationId = newConv.id

        messages.clear()
        adapter.submit(emptyList())
        scrollToBottom()

        saveAllConversations()
    }

    // --------- CHỌN CONVERSATION TỪ LỊCH SỬ ---------
    private fun showConversationChooser() {
        saveAllConversations()
        val nonEmptyConversations = conversations.filter { it.messages.isNotEmpty() }

        if (nonEmptyConversations.isEmpty()) {
            Toast.makeText(this, "Chưa có đoạn chat nào trong lịch sử", Toast.LENGTH_SHORT).show()
            return
        }

        val sorted = nonEmptyConversations.sortedByDescending { it.updatedAt }

        val items = sorted.map { conv ->
            val title = if (conv.title.isNotBlank()) conv.title else "Đoạn chat không tiêu đề"
            val timeStr = formatTimeFull(conv.updatedAt)
            "$title\n$timeStr"
        }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle("Chọn đoạn chat")
            .setItems(items) { _, which ->
                val conv = sorted[which]
                showConversationOptions(conv)
            }
            .setNegativeButton("Đóng", null)
            .show()
    }

    private fun showConversationOptions(conv: Conversation) {
        val title = if (conv.title.isNotBlank()) conv.title else "Đoạn chat không tiêu đề"
        val timeStr = formatTimeFull(conv.updatedAt)

        AlertDialog.Builder(this)
            .setTitle("Tùy chọn đoạn chat")
            .setMessage("$title\nCập nhật lần cuối: $timeStr")
            .setPositiveButton("Mở") { _, _ ->
                switchToConversation(conv.id)
            }
            .setNegativeButton("Xóa") { _, _ ->
                confirmDeleteConversation(conv.id)
            }
            .setNeutralButton("Hủy", null)
            .show()
    }

    private fun confirmDeleteConversation(id: Long) {
        AlertDialog.Builder(this)
            .setTitle("Xóa đoạn chat")
            .setMessage("Bạn có chắc muốn xóa đoạn chat này không?")
            .setPositiveButton("Xóa") { _, _ ->
                deleteConversation(id)
            }
            .setNegativeButton("Hủy", null)
            .show()
    }

    private fun deleteConversation(id: Long) {
        val index = conversations.indexOfFirst { it.id == id }
        if (index == -1) return

        val deletingActive = (activeConversationId == id)

        conversations.removeAt(index)

        if (conversations.isEmpty()) {
            val now = System.currentTimeMillis()
            val first = Conversation(
                id = now,
                title = "Đoạn chat mới",
                createdAt = now,
                updatedAt = now,
                messages = mutableListOf()
            )
            conversations.add(first)
            activeConversationId = first.id
            messages.clear()
            adapter.submit(messages.toList())
        } else if (deletingActive) {
            val fallback = conversations.maxByOrNull { it.updatedAt }
            activeConversationId = fallback?.id
            messages.clear()
            fallback?.messages?.let { messages.addAll(it) }
            adapter.submit(messages.toList())
        }

        saveAllConversations()
        scrollToBottom()
        Toast.makeText(this, "Đã xóa đoạn chat", Toast.LENGTH_SHORT).show()
    }

    private fun switchToConversation(id: Long) {
        saveAllConversations()

        activeConversationId = id
        val conv = conversations.find { it.id == id } ?: return

        messages.clear()
        messages.addAll(conv.messages)
        adapter.submit(messages.toList())
        scrollToBottom()
    }

    // --------- LƯU / LOAD TẤT CẢ CONVERSATION ---------
    private fun saveAllConversations() {
        try {
            val activeId = activeConversationId
            if (activeId != null) {
                val conv = conversations.find { it.id == activeId }
                if (conv != null) {
                    conv.messages = ArrayList(messages)
                    conv.updatedAt = System.currentTimeMillis()

                    // Cập nhật title từ tin nhắn user đầu tiên (nếu chưa có)
                    if (conv.title.isBlank() || conv.title == "Đoạn chat mới") {
                        val firstUserMsg = conv.messages.firstOrNull { it.kind == ChatKind.USER }?.text
                        if (!firstUserMsg.isNullOrBlank()) {
                            conv.title = firstUserMsg.take(40)
                        }
                    }
                }
            }

            val arr = JSONArray()
            for (c in conversations) {
                val obj = JSONObject()
                obj.put("id", c.id)
                obj.put("title", c.title)
                obj.put("createdAt", c.createdAt)
                obj.put("updatedAt", c.updatedAt)

                val msgArr = JSONArray()
                for (m in c.messages) {
                    val mObj = JSONObject()
                    mObj.put("text", m.text)
                    mObj.put("fromBot", m.fromBot)
                    mObj.put("time", m.time)
                    mObj.put("kind", m.kind.name)
                    m.product?.let { p ->
                        val pObj = JSONObject().apply {
                            put("id", p.id)
                            put("name", p.name)
                            put("price", p.price)
                            put("image", p.image)
                            put("category", p.category)
                            put("size", p.size)
                            put("material", p.material)
                            put("gender", p.gender)
                            put("status", p.status)
                        }
                        mObj.put("product", pObj)
                    }
                    msgArr.put(mObj)
                }
                obj.put("messages", msgArr)
                arr.put(obj)
            }

            prefs.edit()
                .putString(KEY_CONVERSATIONS, arr.toString())
                .putLong(KEY_ACTIVE_ID, activeConversationId ?: -1L)
                .apply()
        } catch (_: Exception) {
        }
    }

    private fun loadAllConversations() {
        val json = prefs.getString(KEY_CONVERSATIONS, null)
        conversations.clear()

        if (json != null) {
            try {
                val arr = JSONArray(json)
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    val id = obj.getLong("id")
                    val title = obj.optString("title", "Đoạn chat mới")
                    val createdAt = obj.optLong("createdAt", System.currentTimeMillis())
                    val updatedAt = obj.optLong("updatedAt", createdAt)

                    val msgArr = obj.optJSONArray("messages") ?: JSONArray()
                    val msgs = mutableListOf<ChatMessage>()
                    for (j in 0 until msgArr.length()) {
                        val mObj = msgArr.getJSONObject(j)
                        val text = if (mObj.has("text") && !mObj.isNull("text")) mObj.optString("text") else null
                        val fromBot = mObj.optBoolean("fromBot", false)
                        val time = mObj.optLong("time", System.currentTimeMillis())
                        val kindStr = mObj.optString("kind", if (fromBot) ChatKind.BOT.name else ChatKind.USER.name)
                        val product = if (mObj.has("product")) {
                            val p = mObj.optJSONObject("product")
                            if (p != null) ChatProduct(
                                id = p.optInt("id"),
                                name = p.optString("name", ""),
                                price = p.optDouble("price", 0.0),
                                image = p.optString("image", null),
                                category = p.optString("category", null),
                                size = p.optString("size", null),
                                material = p.optString("material", null),
                                gender = p.optString("gender", null),
                                status = p.optString("status", null)
                            ) else null
                        } else null

                        val kind = try {
                            ChatKind.valueOf(kindStr)
                        } catch (_: Exception) {
                            if (product != null) ChatKind.PRODUCT else if (fromBot) ChatKind.BOT else ChatKind.USER
                        }

                        msgs.add(
                            ChatMessage(
                                text = text,
                                fromBot = fromBot,
                                time = time,
                                product = product,
                                kind = kind
                            )
                        )
                    }

                    conversations.add(
                        Conversation(
                            id = id,
                            title = title,
                            createdAt = createdAt,
                            updatedAt = updatedAt,
                            messages = msgs
                        )
                    )
                }
            } catch (_: Exception) {
            }
        }

        if (conversations.isEmpty()) {
            val now = System.currentTimeMillis()
            val first = Conversation(
                id = now,
                title = "Đoạn chat mới",
                createdAt = now,
                updatedAt = now,
                messages = mutableListOf()
            )
            conversations.add(first)
            activeConversationId = first.id
        } else {
            val savedActiveId = prefs.getLong(KEY_ACTIVE_ID, -1L)
            activeConversationId =
                conversations.find { it.id == savedActiveId }?.id ?: conversations.last().id
        }

        val active = conversations.find { it.id == activeConversationId }
        messages.clear()
        if (active != null) {
            messages.addAll(active.messages)
        }
        adapter.submit(messages.toList())
        scrollToBottom()
    }

    // --------- FORMAT THỜI GIAN ---------
    private fun formatTimeFull(millis: Long): String {
        val df = SimpleDateFormat("HH:mm dd/MM/yyyy", Locale.getDefault())
        return df.format(Date(millis))
    }
}
