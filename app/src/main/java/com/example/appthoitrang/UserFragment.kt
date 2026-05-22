package com.example.appthoitrang

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.Toast
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.example.appthoitrang.databinding.FragmentUserBinding
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class UserFragment : Fragment() {

    private var _binding: FragmentUserBinding? = null
    private val binding get() = _binding!!

    private lateinit var api: ApiService
    private lateinit var session: SessionManager

    private var openedForAuth = false

    private enum class Screen { LOGIN, REGISTER, PROFILE }

    companion object {
        private const val ARG_OPENED_FOR_AUTH = "opened_for_auth"
        fun newInstance(openedForAuth: Boolean = false) = UserFragment().apply {
            arguments = Bundle().apply { putBoolean(ARG_OPENED_FOR_AUTH, openedForAuth) }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        openedForAuth = arguments?.getBoolean(ARG_OPENED_FOR_AUTH) == true
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentUserBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        session = SessionManager(requireContext())
        api = RetrofitClient.create(requireContext())

        // IME action cho mật khẩu
        binding.edtMatkhau.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                doLogin(); true
            } else false
        }

        // Nút hành động
        binding.btnRegister.setOnClickListener { doRegister() }
        binding.btnLogin.setOnClickListener { doLogin() }
        binding.btnLogout.setOnClickListener { confirmLogout() }

        // Link chuyển đổi
        binding.tvGotoRegister.setOnClickListener { setScreen(Screen.REGISTER) }
        binding.tvGotoLogin.setOnClickListener { setScreen(Screen.LOGIN) }

        // Nếu có token -> lấy profile, ngược lại -> login
        if (session.getToken() != null) fetchProfile() else setScreen(Screen.LOGIN)
    }

    // ---------- Quản lý trạng thái màn hình ----------
    private fun setScreen(screen: Screen) {
        val b = _binding ?: return
        when (screen) {
            Screen.LOGIN -> {
                b.sectionLogin.visibility = View.VISIBLE
                b.sectionRegister.visibility = View.GONE
                b.sectionProfile.visibility = View.GONE
            }
            Screen.REGISTER -> {
                b.sectionLogin.visibility = View.GONE
                b.sectionRegister.visibility = View.VISIBLE
                b.sectionProfile.visibility = View.GONE
            }
            Screen.PROFILE -> {
                b.sectionLogin.visibility = View.GONE
                b.sectionRegister.visibility = View.GONE
                b.sectionProfile.visibility = View.VISIBLE
            }
        }
    }

    // ---------- Đăng ký ----------
    private fun doRegister() {
        val b = _binding ?: return
        val body = RegisterReq(
            taikhoan = b.edtRegTaikhoan.text.toString().trim(),
            matkhau  = b.edtRegMatkhau.text.toString(),
            hoten    = b.edtRegHoten.text.toString().trim(),
            email    = b.edtRegEmail.text.toString().trim(),
            sdt      = b.edtRegSdt.text.toString().trim(),
            diachi   = b.edtRegDiachi.text.toString().trim()
        )

        val err = when {
            body.taikhoan.isEmpty()      -> "Vui lòng nhập tài khoản"
            body.matkhau.length < 6      -> "Mật khẩu tối thiểu 6 ký tự"
            body.hoten.isEmpty()         -> "Vui lòng nhập họ tên"
            !isValidEmail(body.email)    -> "Email không hợp lệ"
            body.sdt.isEmpty()           -> "Vui lòng nhập SĐT"
            else -> null
        }
        if (err != null) { toast(err); return }

        setEnableRegister(false)
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res = withContext(Dispatchers.IO) { api.register(body) }
                val payload = res.body()
                if (res.isSuccessful && payload?.success == true) {
                    toast("Đăng ký thành công! Hãy đăng nhập.")
                    _binding?.let {
                        it.edtTaikhoan.setText(body.taikhoan)
                        it.edtMatkhau.setText(body.matkhau)
                    }
                    setScreen(Screen.LOGIN)
                } else {
                    val msg = payload?.message ?: res.errorBody()?.string() ?: "Đăng ký thất bại"
                    toast(msg)
                }
            } catch (e: Exception) {
                toast("Lỗi: ${e.message}")
            } finally {
                setEnableRegister(true)
            }
        }
    }

    // ---------- Đăng nhập ----------
    private fun doLogin() {
        val b = _binding ?: return
        val tk = b.edtTaikhoan.text.toString().trim()
        val mk = b.edtMatkhau.text.toString()

        val err = when {
            tk.isEmpty() -> "Nhập tài khoản"
            mk.isEmpty() -> "Nhập mật khẩu"
            else -> null
        }
        if (err != null) { toast(err); return }

        setEnableLogin(false)
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res = withContext(Dispatchers.IO) { api.login(LoginReq(tk, mk)) }
                val payload = res.body()
                val data = payload?.data
                if (res.isSuccessful && payload?.success == true && data != null) {
                    session.saveToken(data.access_token)
                    bindProfile(data.user)
                    setScreen(Screen.PROFILE)

                    if (openedForAuth) {
                        parentFragmentManager.setFragmentResult(
                            "auth_result", bundleOf("ok" to true)
                        )
                        parentFragmentManager.popBackStack()
                    }
                } else {
                    val msg = payload?.message ?: res.errorBody()?.string() ?: "Đăng nhập thất bại"
                    toast(msg)
                }
            } catch (e: Exception) {
                toast("Lỗi: ${e.message}")
            } finally {
                setEnableLogin(true)
            }
        }
    }

    // ---------- Lấy profile ----------
    private fun fetchProfile() {
        setProfileLoading(true)
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res = withContext(Dispatchers.IO) { api.me() }
                val payload = res.body()
                val u = payload?.data
                if (res.isSuccessful && payload?.success == true && u != null) {
                    bindProfile(u)
                    setScreen(Screen.PROFILE)
                } else {
                    if (res.code() == 401) {
                        session.clear()
                        setScreen(Screen.LOGIN)
                        toast(payload?.message ?: "Phiên đăng nhập hết hạn (401)")
                    } else {
                        val msg = payload?.message ?: res.errorBody()?.string() ?: "Không lấy được hồ sơ"
                        toast(msg)
                        setScreen(Screen.LOGIN)
                    }
                }
            } catch (e: Exception) {
                toast("Lỗi mạng: ${e.message}")
                setScreen(Screen.LOGIN)
            } finally {
                setProfileLoading(false)
            }
        }
    }

    // ---------- Đăng xuất ----------
    private fun confirmLogout() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Đăng xuất")
            .setMessage("Bạn có chắc muốn đăng xuất?")
            .setNegativeButton("Hủy", null)
            .setPositiveButton("Đăng xuất") { _, _ -> doLogout() }
            .show()
    }

    private fun doLogout() {
        session.clear()
        setScreen(Screen.LOGIN)
        toast("Đã đăng xuất")
    }

    // ---------- Bind dữ liệu ----------
    private fun bindProfile(u: UserInfo) {
        val b = _binding ?: return
        b.tvWelcome.text   = "Xin chào, ${u.hoten}"
        b.tvTaikhoan.text  = "Tài khoản: ${u.taikhoan}"
        b.tvHoten.text     = "Họ tên: ${u.hoten}"
        b.tvEmail.text     = "Email: ${u.email}"
        b.tvSdt.text       = "SĐT: ${u.sdt}"
        b.tvDiachi.text    = "Địa chỉ: ${u.diachi}"
    }

    // ---------- UI helpers ----------
    private fun setEnableLogin(enable: Boolean) {
        val b = _binding ?: return
        b.btnLogin.isEnabled = enable
        b.edtTaikhoan.isEnabled = enable
        b.edtMatkhau.isEnabled = enable
    }

    private fun setEnableRegister(enable: Boolean) {
        val b = _binding ?: return
        b.btnRegister.isEnabled = enable
        b.edtRegTaikhoan.isEnabled = enable
        b.edtRegMatkhau.isEnabled = enable
        b.edtRegHoten.isEnabled = enable
        b.edtRegEmail.isEnabled = enable
        b.edtRegSdt.isEnabled = enable
        b.edtRegDiachi.isEnabled = enable
    }

    private fun setProfileLoading(loading: Boolean) {
        val b = _binding ?: return
        b.btnLogout.isEnabled = !loading
    }

    private fun isValidEmail(email: String): Boolean =
        android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()

    private fun toast(msg: String) {
        context?.let { Toast.makeText(it, msg, Toast.LENGTH_SHORT).show() }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
