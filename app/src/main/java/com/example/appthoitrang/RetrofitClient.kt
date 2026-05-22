package com.example.appthoitrang

import android.content.Context
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {

    const val BASE_URL: String = "https://robbyn-canvaslike-jeannie.ngrok-free.dev"
//"https://fccd2972542f.ngrok-free.app"
    @Volatile private var retrofit: Retrofit? = null

    fun create(ctx: Context): ApiService {
        val instance = retrofit ?: synchronized(this) {
            retrofit ?: buildRetrofit(ctx.applicationContext).also { retrofit = it }
        }
        return instance.create(ApiService::class.java)
    }

    private fun buildRetrofit(appCtx: Context): Retrofit {
        val session = SessionManager(appCtx)

        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val builder = original.newBuilder()
            session.getToken()?.let { token ->
                if (token.isNotBlank()) builder.header("Authorization", "Bearer $token")
            }
            chain.proceed(builder.build())
        }

        val logging = HttpLoggingInterceptor().apply {
            // BODY để debug; khi release có thể hạ xuống BASIC/NONE
            level = HttpLoggingInterceptor.Level.BODY
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .build()

        return Retrofit.Builder()
            .baseUrl(ensureTrailingSlash(BASE_URL)) // Retrofit cần "/" cuối
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    private fun ensureTrailingSlash(u: String) =
        if (u.endsWith("/")) u else "$u/"


    fun absoluteUrl(pathOrUrl: String?): String? {
        if (pathOrUrl.isNullOrBlank()) return null
        if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl
        return ensureTrailingSlash(BASE_URL) + pathOrUrl.trimStart('/')
    }


    fun normalizeToBase(url: String?): String? {
        if (url.isNullOrBlank()) return null
        if (!url.startsWith("http://") && !url.startsWith("https://")) return url
        // Giữ nguyên path/query/fragment, chỉ thay host + scheme
        val newBase = ensureTrailingSlash(BASE_URL).removeSuffix("/")
        return url.replace(Regex("^https?://[^/]+"), newBase)
    }
}
