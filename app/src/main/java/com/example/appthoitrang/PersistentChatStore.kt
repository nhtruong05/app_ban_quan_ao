package com.example.appthoitrang

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

data class SavedMsg(val role: String, val content: String, val ts: Long = System.currentTimeMillis())

class PersistentChatStore(context: Context) {
    private val prefs = context.getSharedPreferences("chat_store", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val KEY = "one_conversation"  // chỉ 1 cuộc chat duy nhất

    fun loadAll(): MutableList<SavedMsg> {
        val json = prefs.getString(KEY, "[]") ?: "[]"
        val type = object : TypeToken<MutableList<SavedMsg>>() {}.type
        return gson.fromJson(json, type)
    }

    fun saveAll(list: MutableList<SavedMsg>) {
        // giữ tối đa 300 tin nhắn
        if (list.size > 300) list.subList(0, list.size - 300).clear()
        prefs.edit().putString(KEY, gson.toJson(list)).apply()
    }

    fun appendUser(text: String) {
        val all = loadAll()
        all.add(SavedMsg("user", text))
        saveAll(all)
    }

    fun appendBot(text: String) {
        val all = loadAll()
        all.add(SavedMsg("assistant", text))
        saveAll(all)
    }

    fun replaceLastBot(text: String) {
        val all = loadAll()
        for (i in all.size - 1 downTo 0) {
            if (all[i].role == "assistant") {
                all[i] = SavedMsg("assistant", text, all[i].ts)
                saveAll(all); return
            }
        }
        appendBot(text)
    }

    fun clear() = prefs.edit().remove(KEY).apply()
}
