package com.s210.backend.domain.user.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.user.application.dto.ModifyUserCommand
import com.s210.backend.domain.user.application.dto.UserResult
import com.s210.backend.domain.user.entity.User
import com.s210.backend.domain.user.exception.UserErrorCode
import com.s210.backend.domain.user.infrastructure.repository.OauthAccountRepository
import com.s210.backend.domain.user.infrastructure.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
@Transactional
class UserService(
    private val userRepository: UserRepository,
    private val oauthAccountRepository: OauthAccountRepository,
) {
    @Transactional(readOnly = true)
    fun findUser(userId: Long): UserResult = ownedUser(userId).toResult()

    fun modifyUser(userId: Long, command: ModifyUserCommand): UserResult {
        val user = ownedUser(userId)
        command.name?.let { user.name = it }
        command.nickname?.let { nickname ->
            if (nickname != user.nickname &&
                userRepository.existsByNicknameAndDeletedAtIsNullAndIdNot(nickname, user.id)
            ) {
                throw BusinessException(UserErrorCode.NICKNAME_DUPLICATED)
            }
            user.nickname = nickname
        }
        command.phone?.let { user.phone = it }
        command.agreeSms?.let { user.agreeSms = it }
        command.agreeMarketing?.let { user.agreeMarketing = it }
        return user.toResult()
    }

    fun removeUser(userId: Long) {
        val user = ownedUser(userId)
        user.deletedAt = LocalDateTime.now()
    }

    private fun ownedUser(userId: Long): User =
        userRepository.findByIdAndDeletedAtIsNull(userId)
            ?: throw BusinessException(UserErrorCode.USER_NOT_FOUND)

    private fun User.toResult(): UserResult = UserResult(
        id = id,
        loginId = loginId,
        email = email,
        name = name,
        nickname = nickname,
        phone = phone,
        agreeSms = agreeSms,
        agreeMarketing = agreeMarketing,
        provider = oauthAccountRepository
            .findFirstByUser_IdAndDeletedAtIsNullOrderByCreatedAtAsc(id)
            ?.provider,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )
}
