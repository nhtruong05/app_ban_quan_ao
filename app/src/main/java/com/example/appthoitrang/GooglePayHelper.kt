package com.example.appthoitrang

import android.app.Activity
import android.content.Intent
import com.google.android.gms.wallet.*
import org.json.JSONObject

object GooglePayHelper {
    const val LOAD_PAYMENT_DATA_REQUEST_CODE = 991

    fun createClient(activity: Activity): PaymentsClient {
        val opts = Wallet.WalletOptions.Builder()
            .setEnvironment(WalletConstants.ENVIRONMENT_TEST) // đổi sang PROD khi live
            .build()
        return Wallet.getPaymentsClient(activity, opts)
    }

    fun buildIsReadyToPayRequest(): IsReadyToPayRequest {
        val json = JSONObject()
            .put("apiVersion", 2)
            .put("apiVersionMinor", 0)
            .put("allowedPaymentMethods", listOf(
                JSONObject().apply {
                    put("type", "CARD")
                    put("parameters", JSONObject().apply {
                        put("allowedAuthMethods", listOf("PAN_ONLY", "CRYPTOGRAM_3DS"))
                        put("allowedCardNetworks", listOf("VISA", "MASTERCARD"))
                    })
                }
            ))
        return IsReadyToPayRequest.fromJson(json.toString())
    }

    fun buildPaymentDataRequest(activity: Activity, totalVnd: Long): PaymentDataRequest {
        val raw = activity.resources.openRawResource(R.raw.payment_config)
            .bufferedReader().use { it.readText() }
        val json = JSONObject(raw)
        json.getJSONObject("transactionInfo")
            .put("totalPrice", "%.2f".format(totalVnd.toDouble()))
        return PaymentDataRequest.fromJson(json.toString())
    }

    fun extractToken(data: Intent?): String? {
        val paymentData = data?.let { PaymentData.getFromIntent(it) } ?: return null
        val json = paymentData.toJson() ?: return null
        val root = JSONObject(json)
        val methodData = root.optJSONObject("paymentMethodData") ?: return null
        val tokenData = methodData.optJSONObject("tokenizationData") ?: return null
        return tokenData.optString("token", null)
    }
}
