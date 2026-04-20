package com.s210.backend.domain.dictionary.application.dto

data class WordResult(
    val word: String,
    val pos: String?,
    val meanings: List<String>,
    val pronunciation: String?
)
