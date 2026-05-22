package com.example.appthoitrang

import com.example.appthoitrang.ChatProduct

enum class ChatKind { USER, BOT, PRODUCT }

data class ChatMessage(
    val text: String? = null,
    val fromBot: Boolean,
    val time: Long = System.currentTimeMillis(),
    val product: ChatProduct? = null,
    val kind: ChatKind
)
