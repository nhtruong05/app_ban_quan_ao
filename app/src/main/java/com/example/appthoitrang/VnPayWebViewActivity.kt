package com.example.appthoitrang

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import com.example.appthoitrang.databinding.ActivityVnpayWebviewBinding

class VnPayWebViewActivity : AppCompatActivity() {

    private lateinit var binding: ActivityVnpayWebviewBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityVnpayWebviewBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val paymentUrl = intent.getStringExtra(EXTRA_URL) ?: run {
            setResult(Activity.RESULT_OK, Intent().putExtra(EXTRA_SUCCESS, false))
            finish()
            return
        }
        val returnUrlPrefix = intent.getStringExtra(EXTRA_RETURN_URL_PREFIX) ?: ""

        binding.btnClose.setOnClickListener {
            setResult(Activity.RESULT_OK, Intent().putExtra(EXTRA_SUCCESS, false))
            finish()
        }

        binding.web.settings.javaScriptEnabled = true
        binding.web.settings.domStorageEnabled = true
        binding.web.settings.loadWithOverviewMode = true
        binding.web.settings.useWideViewPort = true

        binding.web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                return handleMaybeReturnUrl(url, returnUrlPrefix)
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                binding.progress.visibility = View.VISIBLE
                url?.let { handleMaybeReturnUrl(it, returnUrlPrefix) }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                binding.progress.visibility = View.GONE
            }
        }

        binding.web.loadUrl(paymentUrl)
    }

    private fun handleMaybeReturnUrl(url: String, returnPrefix: String): Boolean {
        val looksLikeVnp = url.contains("vnp_TxnRef=") || url.contains("vnp_ResponseCode=")
        val isMatch = (returnPrefix.isNotBlank() && url.startsWith(returnPrefix, ignoreCase = true)) || looksLikeVnp
        if (isMatch) {
            val uri = Uri.parse(url)

            val respCode = uri.getQueryParameter("vnp_ResponseCode") ?: ""
            val transStatus = uri.getQueryParameter("vnp_TransactionStatus") ?: ""
            val txnRef = uri.getQueryParameter("vnp_TxnRef") ?: ""
            val amount = uri.getQueryParameter("vnp_Amount") ?: ""

            val isSuccess = respCode == "00" && transStatus == "00"

            val data = Intent().apply {
                putExtra(EXTRA_SUCCESS, isSuccess)
                putExtra(EXTRA_VNP_RESPONSE_CODE, respCode)
                putExtra(EXTRA_VNP_TRANSACTION_STATUS, transStatus)
                putExtra(EXTRA_VNP_TXN_REF, txnRef)
                putExtra(EXTRA_VNP_AMOUNT, amount)
                putExtra(EXTRA_RETURN_URL, url)
            }

            setResult(Activity.RESULT_OK, data)
            finish()
            return true
        }
        return false
    }

    companion object {
        const val EXTRA_URL = "extra_url"
        const val EXTRA_RETURN_URL_PREFIX = "extra_return_url_prefix"

        const val EXTRA_SUCCESS = "extra_success"
        const val EXTRA_VNP_RESPONSE_CODE = "extra_vnp_response_code"
        const val EXTRA_VNP_TRANSACTION_STATUS = "extra_vnp_transaction_status"
        const val EXTRA_VNP_TXN_REF = "extra_vnp_txn_ref"
        const val EXTRA_VNP_AMOUNT = "extra_vnp_amount"
        const val EXTRA_RETURN_URL = "extra_return_url"
    }
}
