package com.s210.backend.domain.dictionary.presentation.response

data class WordResponse(
    val word: String,
    val pos: String?,
    val meanings: List<String>,
    val pronunciation: String?
)
