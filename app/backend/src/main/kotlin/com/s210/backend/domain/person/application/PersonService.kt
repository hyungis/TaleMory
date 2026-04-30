package com.s210.backend.domain.person.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.domain.person.application.dto.CreatePersonCommand
import com.s210.backend.domain.person.application.dto.ModifyPersonCommand
import com.s210.backend.domain.person.application.dto.PersonResult
import com.s210.backend.domain.person.entity.Person
import com.s210.backend.domain.person.infrastructure.repository.PersonRepository
import com.s210.backend.domain.person.model.PersonRole
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

/**
 * 인물 (아이/동행자) 프로필을 관리하는 유스케이스 서비스.
 *
 * 설계 규칙 (docs/conventions/backend-structure-and-conventions.md):
 *  - `@Transactional` 기본 + 조회는 `readOnly = true`
 *  - 메서드명은 "액션 + 도메인" 규칙 (`addPerson`, `findPerson` …)
 *  - 모든 조회/변경에 `userId` 를 같이 받아 **다른 사용자 리소스 접근 차단**
 */
@Service
@Transactional
class PersonService(
    private val personRepository: PersonRepository,
) {
    @Transactional(readOnly = true)
    fun findPersons(userId: Long, role: PersonRole?): List<PersonResult> =
        (role?.let { personRepository.findAllByUserIdAndRoleAndDeletedAtIsNull(userId, it) }
            ?: personRepository.findAllByUserIdAndDeletedAtIsNull(userId))
            .map(PersonResult::from)

    @Transactional(readOnly = true)
    fun findPerson(userId: Long, personId: Long): PersonResult =
        ownedPerson(userId, personId).let(PersonResult::from)

    fun addPerson(userId: Long, command: CreatePersonCommand): PersonResult =
        personRepository.save(
            Person(
                userId = userId,
                name = command.name,
                age = command.age,
                gender = command.gender,
                role = command.role,
            ),
        ).let(PersonResult::from)

    fun modifyPerson(userId: Long, personId: Long, command: ModifyPersonCommand): PersonResult {
        val person = ownedPerson(userId, personId)
        command.name?.let { person.name = it }
        command.age?.let { person.age = it }
        command.gender?.let { person.gender = it }
        // role 변경은 마이페이지 별도 플로우에서 다루므로 이번 API 에선 의도적으로 제외.
        return PersonResult.from(person)
    }

    fun removePerson(userId: Long, personId: Long) {
        val person = ownedPerson(userId, personId)
        person.deletedAt = LocalDateTime.now()
    }

    /**
     * 단건 조회 + 소유권 검증 공통 헬퍼.
     *  - 존재하지 않음 → 404 RESOURCE_NOT_FOUND
     *  - 다른 유저의 리소스 → 403 FORBIDDEN
     */
    private fun ownedPerson(userId: Long, personId: Long): Person {
        val person = personRepository.findByIdAndDeletedAtIsNull(personId)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        if (person.userId != userId) {
            throw BusinessException(CommonErrorCode.FORBIDDEN)
        }
        return person
    }
}
