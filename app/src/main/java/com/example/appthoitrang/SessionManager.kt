package com.example.appthoitrang

import android.content.Context
import android.content.SharedPreferences

class SessionManager(context: Context) {

    companion object {
        private const val PREF_NAME = "app_session"       // tên pref cố định
        private const val KEY_TOKEN = "access_token"
    }

    // Dùng applicationContext để tránh memory leak & thống nhất nguồn pref
    private val pref: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    /** Lưu token sau khi đăng nhập */
    fun saveToken(token: String) {
        pref.edit().putString(KEY_TOKEN, token).apply()
    }

    /** Lấy token hiện tại, nếu chưa có thì trả null */
    fun getToken(): String? = pref.getString(KEY_TOKEN, null)

    /** Kiểm tra trạng thái đăng nhập */
    fun isLoggedIn(): Boolean = !getToken().isNullOrBlank()

    /** Xoá session (đăng xuất) */
    fun clear() {
        pref.edit().remove(KEY_TOKEN).apply()
    }
}
