package com.s210.backend.common.exception

class BusinessException(val errorCode: ErrorCode) : RuntimeException(errorCode.message)
