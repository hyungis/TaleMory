package com.s210.backend.common.filter

import com.fasterxml.jackson.databind.ObjectMapper
import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.exception.ErrorCode
import com.s210.backend.common.response.ApiErrorResponse
import com.s210.backend.common.response.ErrorDetail
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.MediaType
import org.springframework.security.core.AuthenticationException
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.stereotype.Component

@Component
class JwtAuthenticationEntryPoint : AuthenticationEntryPoint {

    private val objectMapper: ObjectMapper = ObjectMapper()

    override fun commence(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authException: AuthenticationException,
    ) {
        val errorCode = resolveErrorCode(request)

        response.status = errorCode.status.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.characterEncoding = Charsets.UTF_8.name()

        val body = ApiErrorResponse(
            success = false,
            error = ErrorDetail(
                code = errorCode.code,
                message = errorCode.message,
            ),
        )

        response.writer.write(objectMapper.writeValueAsString(body))
    }

    private fun resolveErrorCode(request: HttpServletRequest): ErrorCode {
        val cause = request.getAttribute(EXCEPTION_ATTRIBUTE)
        return when (cause) {
            is BusinessException -> cause.errorCode
            else -> CommonErrorCode.INVALID_ACCESS_TOKEN
        }
    }

    companion object {
        const val EXCEPTION_ATTRIBUTE: String = "exception"
    }
}
