package com.example.appthoitrang

import android.os.Bundle
import android.view.*
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.appthoitrang.databinding.FragmentSearchBinding
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.channels.awaitClose

class SearchFragment : Fragment() {

    private var _binding: FragmentSearchBinding? = null
    private val binding get() = _binding!!

    private lateinit var api: ApiService

    private val resultAdapter = ProductAdapter { product ->
        if (product.id <= 0) return@ProductAdapter
        parentFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, ProductDetailFragment.newInstance(product))
            .addToBackStack("product_detail")
            .commit()
    }

    private val suggestAdapter = SuggestAdapter { item ->
        binding.edtQuery.setText(item.name)
        binding.edtQuery.setSelection(item.name.length)
        performSearch(item.name)
        binding.rvSuggest.isVisible = false
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentSearchBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        api = RetrofitClient.create(requireContext())

        binding.rvResults.layoutManager = LinearLayoutManager(requireContext())
        binding.rvResults.adapter = resultAdapter

        binding.rvSuggest.layoutManager = LinearLayoutManager(requireContext())
        binding.rvSuggest.adapter = suggestAdapter

        binding.btnClear.setOnClickListener {
            binding.edtQuery.setText("")
            suggestAdapter.submitList(emptyList())
            binding.rvSuggest.isVisible = false
            resultAdapter.submitList(emptyList())
            binding.tvEmpty.isVisible = false
        }

        binding.edtQuery.setOnEditorActionListener { v, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                performSearch((v as EditText).text.toString())
                true
            } else false
        }

        listenTextForSuggestions()
    }

    private fun listenTextForSuggestions() {
        fun EditText.textChanges(): Flow<CharSequence> = callbackFlow {
            val watcher = object : android.text.TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { trySend(s ?: "") }
                override fun afterTextChanged(s: android.text.Editable?) {}
            }
            addTextChangedListener(watcher)
            awaitClose { removeTextChangedListener(watcher) }
        }

        binding.edtQuery.textChanges()
            .debounce(300)
            .map { it.toString().trim() }
            .distinctUntilChanged()
            .onEach { q ->
                if (q.isEmpty()) {
                    binding.rvSuggest.isVisible = false
                    suggestAdapter.submitList(emptyList())
                } else {
                    fetchSuggestions(q)
                }
            }
            .launchIn(viewLifecycleOwner.lifecycleScope)
    }

    private var suggestJob: Job? = null
    private fun fetchSuggestions(q: String) {
        suggestJob?.cancel()
        suggestJob = viewLifecycleOwner.lifecycleScope.launch {
            try {
                binding.progress.isVisible = true
                val res = withContext(Dispatchers.IO) {
                    api.suggestProducts(q = q, limit = 6)
                }
                val payload = res.body()
                val items = if (res.isSuccessful && payload?.success == true) {
                    payload.data.orEmpty()
                } else emptyList()

                suggestAdapter.submitList(items)
                binding.rvSuggest.isVisible = items.isNotEmpty()
            } catch (_: Exception) {
                binding.rvSuggest.isVisible = false
                suggestAdapter.submitList(emptyList())
            } finally {
                binding.progress.isVisible = false
            }
        }
    }

    private var searchJob: Job? = null
    private fun performSearch(q: String) {
        searchJob?.cancel()
        searchJob = viewLifecycleOwner.lifecycleScope.launch {
            try {
                binding.progress.isVisible = true
                binding.tvEmpty.isVisible = false
                binding.rvSuggest.isVisible = false

                val res = withContext(Dispatchers.IO) {
                    api.getProducts(
                        q = q,
                        status = null, gender = null, size = null,
                        category = null, material = null,
                        priceMin = null, priceMax = null,
                        page = 1, pageSize = 20
                    )
                }
                val payload = res.body()
                val list = if (res.isSuccessful && payload?.success == true) {
                    payload.data.orEmpty().filter { it.id > 0 }
                } else emptyList()

                resultAdapter.submitList(list)
                binding.tvEmpty.isVisible = list.isEmpty()
            } catch (_: Exception) {
                resultAdapter.submitList(emptyList())
                binding.tvEmpty.isVisible = true
            } finally {
                binding.progress.isVisible = false
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
