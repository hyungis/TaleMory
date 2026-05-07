import { useCallback, useState, type CSSProperties, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { isApiError } from '../../../../shared/api'
import { formatPhoneNumber } from '../../../../shared/lib'
import { FeedbackDialog } from '../../../../shared/ui'
import { getLoginIdAvailability, getNicknameAvailability } from '../../api/getAuthAvailability'
import {
  buildRequiredTermAgreements,
  getTerms,
  isRequiredTermsNotFoundError,
  TermsCheckboxes,
} from '../../terms'
import { useSignupPost } from '../model/useSignupPost'
import type { SignupRequest } from '../types'

interface SignupFormValues {
  id: string
  password: string
  passwordCheck: string
  email: string
  name: string
  nickname: string
  phone: string
  serviceTermsAgree: boolean
  privacyAgree: boolean
}

const INITIAL_VALUES: SignupFormValues = {
  id: '',
  password: '',
  passwordCheck: '',
  email: '',
  name: '',
  nickname: '',
  phone: '',
  serviceTermsAgree: false,
  privacyAgree: false,
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[0-9\-+\s]{7,}$/
const WITHDRAWN_ACCOUNT_CODE = 'AUTH_007'
const MIN_LOGIN_ID_LENGTH = 4
const MIN_PASSWORD_LENGTH = 6

type AvailabilityCheckStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'error'

interface AvailabilityCheckState {
  status: AvailabilityCheckStatus
  value: string
}

interface FieldValidationFeedback {
  message: string
}

interface FieldValidationOptions {
  showRequired?: boolean
}

interface SignupSuccessDialogState {
  title: string
  message: string
  idHint: string
}

const INITIAL_AVAILABILITY_CHECK: AvailabilityCheckState = {
  status: 'idle',
  value: '',
}

function isAvailabilityConfirmed(state: AvailabilityCheckState, value: string): boolean {
  return state.status === 'available' && state.value === value.trim()
}

function getAvailabilityMessage(
  label: '아이디' | '닉네임',
  state: AvailabilityCheckState,
  currentValue: string,
): string | null {
  if (state.status === 'idle' || state.value !== currentValue.trim()) return null
  if (state.status === 'checking') return `${label} 중복 여부를 확인하고 있어요.`
  if (state.status === 'available') return `사용 가능한 ${label}입니다.`
  if (state.status === 'unavailable') return `이미 사용 중인 ${label}입니다.`
  return `${label} 중복 확인에 실패했어요. 잠시 후 다시 시도해주세요.`
}

function getAvailabilityMessageColor(status: AvailabilityCheckStatus): string {
  if (status === 'available') return '#5f7d50'
  if (status === 'unavailable' || status === 'error') return '#8c3a1f'
  return '#8a7558'
}

function getLoginIdFormatFeedback(
  value: string,
  options: FieldValidationOptions = {},
): FieldValidationFeedback | null {
  const loginId = value.trim()

  if (!loginId) {
    return options.showRequired ? { message: '아이디를 입력해주세요.' } : null
  }

  if (loginId.length < MIN_LOGIN_ID_LENGTH) {
    return {
      message: `아이디는 ${MIN_LOGIN_ID_LENGTH}자 이상 입력해주세요.`,
    }
  }

  return null
}

function getPasswordFormatFeedback(
  value: string,
  options: FieldValidationOptions = {},
): FieldValidationFeedback | null {
  if (!value) {
    return options.showRequired ? { message: '비밀번호를 입력해주세요.' } : null
  }

  if (value.length < MIN_PASSWORD_LENGTH) {
    return {
      message: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해주세요.`,
    }
  }

  return null
}

function getPasswordCheckFeedback(
  password: string,
  passwordCheck: string,
): FieldValidationFeedback | null {
  if (!password) return null

  if (!passwordCheck) {
    return {
      message: '비밀번호 확인을 입력해주세요.',
    }
  }

  if (password !== passwordCheck) {
    return {
      message: '비밀번호가 서로 일치하지 않아요.',
    }
  }

  return null
}

function getEmailFormatFeedback(
  value: string,
  options: FieldValidationOptions = {},
): FieldValidationFeedback | null {
  const email = value.trim()
  if (!email) {
    return options.showRequired ? { message: '이메일을 입력해주세요.' } : null
  }

  if (!EMAIL_PATTERN.test(email)) {
    return {
      message: '올바른 이메일 형식으로 입력해주세요.',
    }
  }

  return null
}

function getPhoneFormatFeedback(value: string): FieldValidationFeedback | null {
  if (value && !PHONE_PATTERN.test(value)) {
    return {
      message: '휴대폰 번호 형식을 확인해주세요.',
    }
  }

  return null
}

function validate(values: SignupFormValues): string | null {
  const loginIdFeedback = getLoginIdFormatFeedback(values.id, { showRequired: true })
  if (loginIdFeedback) return loginIdFeedback.message

  const passwordFeedback = getPasswordFormatFeedback(values.password, { showRequired: true })
  if (passwordFeedback) return passwordFeedback.message

  const passwordCheckFeedback = getPasswordCheckFeedback(values.password, values.passwordCheck)
  if (passwordCheckFeedback) return passwordCheckFeedback.message

  const emailFeedback = getEmailFormatFeedback(values.email, { showRequired: true })
  if (emailFeedback) return emailFeedback.message

  if (!values.name.trim()) return '실명을 입력해주세요.'
  if (!values.nickname.trim()) return '닉네임을 입력해주세요.'

  const phoneFeedback = getPhoneFormatFeedback(values.phone)
  if (phoneFeedback) return phoneFeedback.message

  if (!values.serviceTermsAgree) return '서비스 이용약관에 동의해주세요.'
  if (!values.privacyAgree) return '개인정보 수집 및 이용에 동의해주세요.'
  return null
}

function getSignupErrorMessage(error: unknown): string {
  if (isRequiredTermsNotFoundError(error)) {
    return '약관 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'
  }

  if (!isApiError(error)) {
    return '회원가입 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.'
  }
  if (error.code === 'AUTH_001') return '이미 사용 중인 아이디입니다.'
  if (error.code === 'AUTH_002') return '이미 사용 중인 이메일입니다.'
  if (error.code === 'USER_002') return '이미 사용 중인 닉네임입니다.'
  if (error.code === 'NETWORK_ERROR') return '서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.'
  if (error.code === 'REQUEST_TIMEOUT') return '응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.'
  return error.message
}

interface SignupFormProps {
  onSignedUp: (idHint: string) => void
  onSwitchToLogin: () => void
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-display)',
  fontSize: 16,
  fontWeight: 700,
  color: '#6b5638',
  marginBottom: 6,
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  background: '#f7eccd',
  border: '2px solid #a37548',
  color: '#4a3b2a',
  fontFamily: 'var(--font-display)',
  fontSize: 17,
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  boxShadow: 'inset 0 1px 2px rgba(140, 100, 60, 0.08)',
}

const fieldActionRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 8,
  alignItems: 'center',
}

const checkButtonStyle: CSSProperties = {
  height: 48,
  padding: '0 14px',
  borderRadius: 12,
  border: '2px solid #5f7d50',
  background: '#eef5df',
  color: '#4f7140',
  fontFamily: 'var(--font-display)',
  fontSize: 15,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
}

const fieldFeedbackStyle: CSSProperties = {
  margin: '6px 0 0',
  fontFamily: 'var(--font-display)',
  fontSize: 13,
  lineHeight: 1.4,
}

/**
 * 회원가입 폼 — paper-craft 톤.
 */
export function SignupForm({ onSignedUp, onSwitchToLogin }: SignupFormProps) {
  const [values, setValues] = useState<SignupFormValues>(INITIAL_VALUES)
  const [error, setError] = useState('')
  const [loginIdCheck, setLoginIdCheck] = useState<AvailabilityCheckState>(INITIAL_AVAILABILITY_CHECK)
  const [nicknameCheck, setNicknameCheck] = useState<AvailabilityCheckState>(INITIAL_AVAILABILITY_CHECK)
  const [restoreRequest, setRestoreRequest] = useState<SignupRequest | null>(null)
  const [successDialog, setSuccessDialog] = useState<SignupSuccessDialogState | null>(null)
  const { isPending, signup } = useSignupPost()

  const handleChange = useCallback(
    <K extends keyof SignupFormValues>(key: K, value: SignupFormValues[K]) => {
      setError('')
      setValues(prev => ({ ...prev, [key]: value }))
    },
    [],
  )

  const handleLoginIdCheck = useCallback(async () => {
    const loginId = values.id.trim()
    if (getLoginIdFormatFeedback(loginId, { showRequired: true })) {
      return
    }

    setLoginIdCheck({ status: 'checking', value: loginId })

    try {
      const result = await getLoginIdAvailability(loginId)
      setLoginIdCheck({ status: result.available ? 'available' : 'unavailable', value: loginId })
    } catch {
      setLoginIdCheck({ status: 'error', value: loginId })
    }
  }, [values.id])

  const handleNicknameCheck = useCallback(async () => {
    const nickname = values.nickname.trim()
    if (!nickname) {
      return
    }

    setNicknameCheck({ status: 'checking', value: nickname })

    try {
      const result = await getNicknameAvailability(nickname)
      setNicknameCheck({ status: result.available ? 'available' : 'unavailable', value: nickname })
    } catch {
      setNicknameCheck({ status: 'error', value: nickname })
    }
  }, [values.nickname])

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (isPending) return

      const validationError = validate(values)
      if (validationError) {
        setError(validationError)
        return
      }

      if (!isAvailabilityConfirmed(loginIdCheck, values.id)) {
        setError(
          loginIdCheck.status === 'unavailable' && loginIdCheck.value === values.id.trim()
            ? '이미 사용 중인 아이디입니다.'
            : '아이디 중복 확인을 완료해주세요.',
        )
        return
      }

      if (!isAvailabilityConfirmed(nicknameCheck, values.nickname)) {
        setError(
          nicknameCheck.status === 'unavailable' && nicknameCheck.value === values.nickname.trim()
            ? '이미 사용 중인 닉네임입니다.'
            : '닉네임 중복 확인을 완료해주세요.',
        )
        return
      }

      let request: SignupRequest | null = null

      try {
        const terms = await getTerms()
        request = {
          loginId: values.id.trim(),
          password: values.password,
          passwordCheck: values.passwordCheck,
          email: values.email.trim(),
          name: values.name.trim(),
          nickname: values.nickname.trim(),
          phone: values.phone.trim() || undefined,
          termAgreements: buildRequiredTermAgreements(values, terms),
        }

        await signup(request)

        setError('')
        setSuccessDialog({
          title: '가입 완료',
          message: `"${values.nickname.trim()}" 님 가입이 완료됐어요! 로그인 해주세요.`,
          idHint: values.id.trim(),
        })
      } catch (submitError) {
        if (isApiError(submitError) && submitError.code === WITHDRAWN_ACCOUNT_CODE && request !== null) {
          setError('')
          setRestoreRequest(request)
          return
        }

        setError(getSignupErrorMessage(submitError))
      }
    },
    [isPending, loginIdCheck, nicknameCheck, signup, values],
  )

  const handleRestoreCancel = useCallback(() => {
    if (!isPending) {
      setRestoreRequest(null)
    }
  }, [isPending])

  const handleRestoreConfirm = useCallback(async () => {
    if (restoreRequest === null || isPending) return

    try {
      await signup({
        ...restoreRequest,
        restoreConfirmed: true,
      })

      setError('')
      setRestoreRequest(null)
      setSuccessDialog({
        title: '계정 복구 완료',
        message: '계정이 복구됐어요! 로그인 해주세요.',
        idHint: restoreRequest.loginId,
      })
    } catch (restoreError) {
      setRestoreRequest(null)
      setError(getSignupErrorMessage(restoreError))
    }
  }, [isPending, restoreRequest, signup])

  const loginIdMessage = getAvailabilityMessage('아이디', loginIdCheck, values.id)
  const nicknameMessage = getAvailabilityMessage('닉네임', nicknameCheck, values.nickname)
  const loginIdFormatFeedback = getLoginIdFormatFeedback(values.id)
  const passwordFormatFeedback = getPasswordFormatFeedback(values.password)
  const passwordCheckFeedback = getPasswordCheckFeedback(values.password, values.passwordCheck)
  const emailFormatFeedback = getEmailFormatFeedback(values.email)

  const required = (
    <span style={{ color: '#c47254', fontWeight: 700, marginLeft: 2 }}>*</span>
  )

  return (
    <>
      <form
        onSubmit={handleSubmit}
        aria-busy={isPending}
        style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div>
          <label style={labelStyle}>아이디 {required}</label>
          <div style={fieldActionRowStyle}>
            <input
              type="text"
              value={values.id}
              disabled={isPending}
              onChange={e => {
                setLoginIdCheck(INITIAL_AVAILABILITY_CHECK)
                handleChange('id', e.target.value)
              }}
              autoComplete="username"
              placeholder="4자 이상"
              style={inputStyle}
            />
            <button
              type="button"
              disabled={isPending || loginIdCheck.status === 'checking'}
              onClick={handleLoginIdCheck}
              style={{
                ...checkButtonStyle,
                cursor: isPending || loginIdCheck.status === 'checking' ? 'not-allowed' : 'pointer',
                opacity: isPending || loginIdCheck.status === 'checking' ? 0.6 : 1,
              }}
            >
              {loginIdCheck.status === 'checking' ? '확인 중' : '중복 확인'}
            </button>
          </div>
          {loginIdFormatFeedback && <FieldFeedback feedback={loginIdFormatFeedback} />}
          {loginIdMessage && (
            <p
              style={{
                margin: '6px 0 0',
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                color: getAvailabilityMessageColor(loginIdCheck.status),
              }}
            >
              {loginIdMessage}
            </p>
          )}
        </div>
        <div>
          <label style={labelStyle}>비밀번호 {required}</label>
          <input
            type="password"
            value={values.password}
            disabled={isPending}
            onChange={e => handleChange('password', e.target.value)}
            autoComplete="new-password"
            placeholder="6자 이상"
            style={inputStyle}
          />
          {passwordFormatFeedback && <FieldFeedback feedback={passwordFormatFeedback} />}
        </div>
        <div>
          <label style={labelStyle}>비밀번호 확인 {required}</label>
          <input
            type="password"
            value={values.passwordCheck}
            disabled={isPending}
            onChange={e => handleChange('passwordCheck', e.target.value)}
            autoComplete="new-password"
            placeholder="비밀번호 재입력"
            style={inputStyle}
          />
          {passwordCheckFeedback && <FieldFeedback feedback={passwordCheckFeedback} />}
        </div>
        <div>
          <label style={labelStyle}>이메일 {required}</label>
          <input
            type="email"
            value={values.email}
            disabled={isPending}
            onChange={e => handleChange('email', e.target.value)}
            autoComplete="email"
            placeholder="example@email.com"
            style={inputStyle}
          />
          {emailFormatFeedback && <FieldFeedback feedback={emailFormatFeedback} />}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>실명 {required}</label>
            <input
              type="text"
              value={values.name}
              disabled={isPending}
              onChange={e => handleChange('name', e.target.value)}
              autoComplete="name"
              placeholder="홍길동"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>닉네임 {required}</label>
            <div style={fieldActionRowStyle}>
              <input
                type="text"
                value={values.nickname}
                disabled={isPending}
                onChange={e => {
                  setNicknameCheck(INITIAL_AVAILABILITY_CHECK)
                  handleChange('nickname', e.target.value)
                }}
                placeholder="해솔맘"
                style={inputStyle}
              />
              <button
                type="button"
                disabled={isPending || nicknameCheck.status === 'checking'}
                onClick={handleNicknameCheck}
                style={{
                  ...checkButtonStyle,
                  cursor: isPending || nicknameCheck.status === 'checking' ? 'not-allowed' : 'pointer',
                  opacity: isPending || nicknameCheck.status === 'checking' ? 0.6 : 1,
                }}
              >
                {nicknameCheck.status === 'checking' ? '확인 중' : '중복 확인'}
              </button>
            </div>
            {nicknameMessage && (
              <p
                style={{
                  margin: '6px 0 0',
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  color: getAvailabilityMessageColor(nicknameCheck.status),
                }}
              >
                {nicknameMessage}
              </p>
            )}
          </div>
        </div>
        <div>
          <label style={labelStyle}>
            휴대폰 <span style={{ fontSize: 13, color: '#a37548', fontWeight: 400, marginLeft: 4 }}>(선택)</span>
          </label>
          <input
            type="tel"
            value={values.phone}
            disabled={isPending}
            onChange={e => handleChange('phone', formatPhoneNumber(e.target.value))}
            autoComplete="tel"
            placeholder="010-1234-5678"
            style={inputStyle}
          />
        </div>

        <TermsCheckboxes
          serviceTermsAgree={values.serviceTermsAgree}
          privacyAgree={values.privacyAgree}
          onChange={(key, value) => handleChange(key, value)}
        />

        {error && (
          <div
            style={{
              background: 'rgba(196, 114, 84, 0.12)',
              border: '1.5px solid rgba(196, 114, 84, 0.45)',
              color: '#8c3a1f',
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              padding: '8px 12px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          style={{
            width: '100%',
            background: '#7a9968',
            color: '#fdfaf0',
            border: '2px solid #5f7d50',
            padding: '14px 20px',
            borderRadius: 999,
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            cursor: isPending ? 'not-allowed' : 'pointer',
            opacity: isPending ? 0.6 : 1,
            boxShadow: '0 3px 0 #5f7d50, 0 6px 14px rgba(95, 125, 80, 0.25)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            marginTop: 6,
          }}
        >
          {isPending ? '가입 처리 중...' : '가입하기'}
        </button>

        <p
          className="text-center"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            color: '#8a7558',
            paddingTop: 4,
          }}
        >
          이미 계정이 있으신가요?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: '#5f7d50',
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            로그인
          </button>
        </p>
      </form>

      {restoreRequest && (
        <RestoreConfirmDialog
          isPending={isPending}
          onCancel={handleRestoreCancel}
          onConfirm={handleRestoreConfirm}
        />
      )}
      {successDialog && (
        <FeedbackDialog
          variant="success"
          title={successDialog.title}
          message={successDialog.message}
          onClose={() => {
            const idHint = successDialog.idHint
            setSuccessDialog(null)
            onSignedUp(idHint)
          }}
        />
      )}
    </>
  )
}

function FieldFeedback({ feedback }: { feedback: FieldValidationFeedback }) {
  return (
    <p
      style={{
        ...fieldFeedbackStyle,
        color: '#8c3a1f',
      }}
    >
      {feedback.message}
    </p>
  )
}

function RestoreConfirmDialog({
  isPending,
  onCancel,
  onConfirm,
}: {
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      style={{ background: 'rgba(74, 59, 42, 0.55)', backdropFilter: 'blur(4px)' }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="restore-account-title"
      onClick={() => {
        if (!isPending) onCancel()
      }}
    >
      <div
        className="w-full max-w-sm"
        onClick={event => event.stopPropagation()}
        style={{
          background: '#fbf2da',
          border: '2.5px solid #a37548',
          borderRadius: 20,
          boxShadow: '0 4px 0 #a37548, 0 16px 36px rgba(74, 59, 42, 0.32)',
          padding: '24px',
        }}
      >
        <h3
          id="restore-account-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            color: '#5f7d50',
            margin: '0 0 10px',
          }}
        >
          계정 복구
        </h3>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            lineHeight: 1.5,
            color: '#5c4932',
            margin: '0 0 20px',
          }}
        >
          기존에 가입한 이력이 있습니다. 복구를 진행할까요?
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            style={{
              flex: 1,
              background: '#f7eccd',
              border: '2px solid #a37548',
              color: '#6b5638',
              borderRadius: 999,
              padding: '11px 16px',
              fontFamily: 'var(--font-display)',
              fontSize: 17,
              fontWeight: 700,
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            아니오
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            style={{
              flex: 1,
              background: '#7a9968',
              border: '2px solid #5f7d50',
              color: '#fdfaf0',
              borderRadius: 999,
              padding: '11px 16px',
              fontFamily: 'var(--font-display)',
              fontSize: 17,
              fontWeight: 700,
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
              boxShadow: '0 3px 0 #5f7d50',
            }}
          >
            {isPending ? '복구 중...' : '예'}
          </button>
        </div>
      </div>
    </div>
  )
}
