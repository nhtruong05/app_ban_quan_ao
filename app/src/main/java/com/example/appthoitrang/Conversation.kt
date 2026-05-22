package com.example.appthoitrang

data class Conversation(
    val id: Long,
    var title: String,
    val createdAt: Long,
    var updatedAt: Long,
    var messages: MutableList<ChatMessage>
)
