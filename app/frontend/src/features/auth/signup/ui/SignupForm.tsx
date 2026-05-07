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
import type { LoginResponse } from '../../login'
import { useKakaoSignupPost } from '../../oauth/model/useKakaoSignupPost'
import type { KakaoSignupProfile, KakaoSignupRequest } from '../../oauth/types'
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

interface AvailabilityFeedback {
  message: string
  tone: 'error' | 'neutral' | 'success'
}

interface SignupSuccessDialogState {
  title: string
  message: string
  idHint: string
}

interface KakaoSignupContext {
  signupToken: string
  profile: KakaoSignupProfile
}

const INITIAL_AVAILABILITY_CHECK: AvailabilityCheckState = {
  status: 'idle',
  value: '',
}

function isAvailabilityConfirmed(state: AvailabilityCheckState, value: string): boolean {
  return state.status === 'available' && state.value === value.trim()
}

function getAvailabilityFeedback(
  label: '아이디' | '닉네임',
  state: AvailabilityCheckState,
  currentValue: string,
  options: { showPrompt?: boolean } = {},
): AvailabilityFeedback | null {
  const value = currentValue.trim()

  if (!value) {
    return options.showPrompt
      ? { message: `${label}를 입력한 뒤 중복 확인 버튼을 눌러주세요.`, tone: 'neutral' }
      : null
  }

  if (state.status === 'idle') {
    return options.showPrompt
      ? { message: `${label} 중복 확인 버튼을 눌러주세요.`, tone: 'neutral' }
      : null
  }

  if (state.value !== value) {
    return { message: `${label} 중복 확인 버튼을 다시 눌러주세요.`, tone: 'neutral' }
  }

  if (state.status === 'checking') {
    return { message: `${label} 중복 여부를 확인하고 있어요.`, tone: 'neutral' }
  }

  if (state.status === 'available') {
    return { message: `사용 가능한 ${label}입니다.`, tone: 'success' }
  }

  if (state.status === 'unavailable') {
    return { message: `이미 사용 중인 ${label}입니다.`, tone: 'error' }
  }

  return { message: `${label} 중복 확인에 실패했어요. 잠시 후 다시 시도해주세요.`, tone: 'error' }
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

function validate(values: SignupFormValues, options: { isKakaoSignup?: boolean } = {}): string | null {
  if (!options.isKakaoSignup) {
    const loginIdFeedback = getLoginIdFormatFeedback(values.id, { showRequired: true })
    if (loginIdFeedback) return loginIdFeedback.message

    const passwordFeedback = getPasswordFormatFeedback(values.password, { showRequired: true })
    if (passwordFeedback) return passwordFeedback.message

    const passwordCheckFeedback = getPasswordCheckFeedback(values.password, values.passwordCheck)
    if (passwordCheckFeedback) return passwordCheckFeedback.message
  }

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

function getKakaoSignupErrorMessage(error: unknown): string {
  if (isRequiredTermsNotFoundError(error)) {
    return '약관 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'
  }

  if (!isApiError(error)) {
    return '카카오 회원가입 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.'
  }

  if (error.code === 'AUTH_001') return '기존 계정 비밀번호를 확인해주세요.'
  if (error.code === 'AUTH_002') return '이미 사용 중인 이메일입니다.'
  if (error.code === 'USER_002') return '이미 사용 중인 닉네임입니다.'
  if (error.code === 'AUTH_008') return '카카오 인증 시간이 만료됐어요. 다시 카카오로 시작해주세요.'
  if (error.code === 'NETWORK_ERROR') return '서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.'
  if (error.code === 'REQUEST_TIMEOUT') return '응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.'
  return error.message
}

interface SignupFormProps {
  onSignedUp: (idHint: string) => void
  onSwitchToLogin: () => void
  kakaoSignup?: KakaoSignupContext | null
  onKakaoSignedUp?: (result: LoginResponse) => void
  onKakaoSignupCancel?: () => void
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

const readonlyInputStyle: CSSProperties = {
  ...inputStyle,
  background: '#efe2bd',
  color: '#5f7d50',
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

function createInitialValues(kakaoSignup?: KakaoSignupContext | null): SignupFormValues {
  if (!kakaoSignup) return { ...INITIAL_VALUES }

  return {
    ...INITIAL_VALUES,
    email: kakaoSignup.profile.email.trim(),
    name: kakaoSignup.profile.name ?? '',
    nickname: kakaoSignup.profile.nickname ?? '',
    phone: formatPhoneNumber(kakaoSignup.profile.phone ?? ''),
  }
}

/**
 * 회원가입 폼 — paper-craft 톤.
 */
export function SignupForm({
  onSignedUp,
  onSwitchToLogin,
  kakaoSignup,
  onKakaoSignedUp,
  onKakaoSignupCancel,
}: SignupFormProps) {
  const [values, setValues] = useState<SignupFormValues>(() => createInitialValues(kakaoSignup))
  const [error, setError] = useState('')
  const [loginIdCheck, setLoginIdCheck] = useState<AvailabilityCheckState>(INITIAL_AVAILABILITY_CHECK)
  const [nicknameCheck, setNicknameCheck] = useState<AvailabilityCheckState>(INITIAL_AVAILABILITY_CHECK)
  const [restoreRequest, setRestoreRequest] = useState<SignupRequest | null>(null)
  const [kakaoRestoreRequest, setKakaoRestoreRequest] = useState<KakaoSignupRequest | null>(null)
  const [kakaoRestorePassword, setKakaoRestorePassword] = useState('')
  const [kakaoRestorePasswordError, setKakaoRestorePasswordError] = useState('')
  const [successDialog, setSuccessDialog] = useState<SignupSuccessDialogState | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [hasLoginIdCheckTriggered, setHasLoginIdCheckTriggered] = useState(false)
  const [hasNicknameCheckTriggered, setHasNicknameCheckTriggered] = useState(false)
  const { isPending, signup } = useSignupPost()
  const { isPending: isKakaoPending, signup: kakaoSignupPost } = useKakaoSignupPost()
  const isKakaoSignup = kakaoSignup !== null && kakaoSignup !== undefined
  const isSubmitting = isPending || isKakaoPending

  const handleChange = useCallback(
    <K extends keyof SignupFormValues>(key: K, value: SignupFormValues[K]) => {
      setError('')
      setValues(prev => ({ ...prev, [key]: value }))
    },
    [],
  )

  const handleLoginIdCheck = useCallback(async () => {
    const loginId = values.id.trim()
    setHasLoginIdCheckTriggered(true)
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
    setHasNicknameCheckTriggered(true)
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
      if (isSubmitting) return

      setHasSubmitted(true)

      const validationError = validate(values, { isKakaoSignup })
      if (validationError) {
        setError(validationError)
        return
      }

      if (!isKakaoSignup && !isAvailabilityConfirmed(loginIdCheck, values.id)) {
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

      if (isKakaoSignup && kakaoSignup) {
        let kakaoRequest: KakaoSignupRequest | null = null

        try {
          const terms = await getTerms()
          kakaoRequest = {
            signupToken: kakaoSignup.signupToken,
            email: values.email.trim(),
            name: values.name.trim(),
            nickname: values.nickname.trim(),
            phone: values.phone.trim() || undefined,
            termAgreements: buildRequiredTermAgreements(values, terms),
          }

          const result = await kakaoSignupPost(kakaoRequest)

          setError('')
          onKakaoSignedUp?.(result)
        } catch (submitError) {
          if (isApiError(submitError) && submitError.code === WITHDRAWN_ACCOUNT_CODE && kakaoRequest !== null) {
            setError('')
            setKakaoRestoreRequest(kakaoRequest)
            setKakaoRestorePassword('')
            setKakaoRestorePasswordError('')
            return
          }

          setError(getKakaoSignupErrorMessage(submitError))
        }
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
    [
      isKakaoSignup,
      isSubmitting,
      kakaoSignup,
      kakaoSignupPost,
      loginIdCheck,
      nicknameCheck,
      onKakaoSignedUp,
      signup,
      values,
    ],
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

  const handleKakaoRestoreCancel = useCallback(() => {
    if (!isKakaoPending) {
      setKakaoRestoreRequest(null)
      setKakaoRestorePassword('')
      setKakaoRestorePasswordError('')
    }
  }, [isKakaoPending])

  const handleKakaoRestoreConfirm = useCallback(async () => {
    if (kakaoRestoreRequest === null || isKakaoPending) return

    try {
      const result = await kakaoSignupPost({
        ...kakaoRestoreRequest,
        password: kakaoRestorePassword.trim() || undefined,
        restoreConfirmed: true,
      })
      setError('')
      setKakaoRestoreRequest(null)
      setKakaoRestorePassword('')
      setKakaoRestorePasswordError('')
      onKakaoSignedUp?.(result)
    } catch (restoreError) {
      if (isApiError(restoreError) && restoreError.code === 'AUTH_001') {
        setKakaoRestorePasswordError('기존 계정 비밀번호를 확인해주세요.')
        return
      }

      setKakaoRestoreRequest(null)
      setKakaoRestorePassword('')
      setKakaoRestorePasswordError('')
      setError(getKakaoSignupErrorMessage(restoreError))
    }
  }, [isKakaoPending, kakaoRestorePassword, kakaoRestoreRequest, kakaoSignupPost, onKakaoSignedUp])

  const loginIdFormatFeedback = isKakaoSignup
    ? null
    : getLoginIdFormatFeedback(values.id, { showRequired: hasSubmitted || hasLoginIdCheckTriggered })
  const passwordFormatFeedback = isKakaoSignup
    ? null
    : getPasswordFormatFeedback(values.password, { showRequired: hasSubmitted })
  const passwordCheckFeedback = isKakaoSignup ? null : getPasswordCheckFeedback(values.password, values.passwordCheck)
  const emailFormatFeedback = getEmailFormatFeedback(values.email, { showRequired: hasSubmitted })
  const nameRequiredFeedback =
    hasSubmitted && !values.name.trim() ? { message: '실명을 입력해주세요.' } : null
  const nicknameRequiredFeedback =
    (hasSubmitted || hasNicknameCheckTriggered) && !values.nickname.trim()
      ? { message: '닉네임을 입력해주세요.' }
      : null
  const phoneFormatFeedback = getPhoneFormatFeedback(values.phone)
  const loginIdAvailabilityFeedback = loginIdFormatFeedback
    ? null
    : getAvailabilityFeedback('아이디', loginIdCheck, values.id, {
        showPrompt: hasSubmitted || hasLoginIdCheckTriggered || Boolean(values.id.trim()),
      })
  const nicknameAvailabilityFeedback = nicknameRequiredFeedback
    ? null
    : getAvailabilityFeedback('닉네임', nicknameCheck, values.nickname, {
        showPrompt: hasSubmitted || hasNicknameCheckTriggered || Boolean(values.nickname.trim()),
      })

  const required = (
    <span style={{ color: '#c47254', fontWeight: 700, marginLeft: 2 }}>*</span>
  )

  return (
    <>
      <form
        onSubmit={handleSubmit}
        aria-busy={isSubmitting}
        style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {!isKakaoSignup && (
          <>
            <div>
              <label style={labelStyle}>아이디 {required}</label>
              <div style={fieldActionRowStyle}>
                <input
                  type="text"
                  value={values.id}
                  disabled={isSubmitting}
                  onChange={e => {
                    setLoginIdCheck(INITIAL_AVAILABILITY_CHECK)
                    setHasLoginIdCheckTriggered(false)
                    handleChange('id', e.target.value)
                  }}
                  autoComplete="username"
                  placeholder="4자 이상"
                  style={inputStyle}
                />
                <button
                  type="button"
                  disabled={isSubmitting || loginIdCheck.status === 'checking'}
                  onClick={handleLoginIdCheck}
                  style={{
                    ...checkButtonStyle,
                    cursor: isSubmitting || loginIdCheck.status === 'checking' ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting || loginIdCheck.status === 'checking' ? 0.6 : 1,
                  }}
                >
                  {loginIdCheck.status === 'checking' ? '확인 중' : '중복 확인'}
                </button>
              </div>
              {loginIdFormatFeedback && <FieldFeedback feedback={loginIdFormatFeedback} />}
              {loginIdAvailabilityFeedback && (
                <FieldFeedback
                  feedback={{ message: loginIdAvailabilityFeedback.message }}
                  tone={loginIdAvailabilityFeedback.tone}
                />
              )}
            </div>
            <div>
              <label style={labelStyle}>비밀번호 {required}</label>
              <input
                type="password"
                value={values.password}
                disabled={isSubmitting}
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
                disabled={isSubmitting}
                onChange={e => handleChange('passwordCheck', e.target.value)}
                autoComplete="new-password"
                placeholder="비밀번호 재입력"
                style={inputStyle}
              />
              {passwordCheckFeedback && <FieldFeedback feedback={passwordCheckFeedback} />}
            </div>
          </>
        )}
        <div>
          <label style={labelStyle}>이메일 {required}</label>
          {isKakaoSignup ? (
            <input
              type="email"
              value={values.email}
              readOnly
              autoComplete="email"
              placeholder="example@email.com"
              style={readonlyInputStyle}
            />
          ) : (
            <input
              type="email"
              value={values.email}
              disabled={isSubmitting}
              onChange={e => handleChange('email', e.target.value)}
              autoComplete="email"
              placeholder="example@email.com"
              style={inputStyle}
            />
          )}
          {isKakaoSignup && (
            <p
              style={{
                ...fieldFeedbackStyle,
                color: '#8a7558',
              }}
            >
              카카오 계정에서 인증된 이메일이라 수정할 수 없어요.
            </p>
          )}
          {emailFormatFeedback && <FieldFeedback feedback={emailFormatFeedback} />}
        </div>
        <div>
          <label style={labelStyle}>실명 {required}</label>
          <input
            type="text"
            value={values.name}
            disabled={isSubmitting}
            onChange={e => handleChange('name', e.target.value)}
            autoComplete="name"
            placeholder="홍길동"
            style={inputStyle}
          />
          {nameRequiredFeedback && <FieldFeedback feedback={nameRequiredFeedback} />}
        </div>
        <div>
          <label style={labelStyle}>닉네임 {required}</label>
          <div style={fieldActionRowStyle}>
            <input
              type="text"
              value={values.nickname}
              disabled={isSubmitting}
              onChange={e => {
                setNicknameCheck(INITIAL_AVAILABILITY_CHECK)
                setHasNicknameCheckTriggered(false)
                handleChange('nickname', e.target.value)
              }}
              placeholder="해솔맘"
              style={inputStyle}
            />
            <button
              type="button"
              disabled={isSubmitting || nicknameCheck.status === 'checking'}
              onClick={handleNicknameCheck}
              style={{
                ...checkButtonStyle,
                cursor: isSubmitting || nicknameCheck.status === 'checking' ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || nicknameCheck.status === 'checking' ? 0.6 : 1,
              }}
            >
              {nicknameCheck.status === 'checking' ? '확인 중' : '중복 확인'}
            </button>
          </div>
          {nicknameRequiredFeedback && <FieldFeedback feedback={nicknameRequiredFeedback} />}
          {nicknameAvailabilityFeedback && (
            <FieldFeedback
              feedback={{ message: nicknameAvailabilityFeedback.message }}
              tone={nicknameAvailabilityFeedback.tone}
            />
          )}
        </div>
        <div>
          <label style={labelStyle}>
            휴대폰 <span style={{ fontSize: 13, color: '#a37548', fontWeight: 400, marginLeft: 4 }}>(선택)</span>
          </label>
          <input
            type="tel"
            value={values.phone}
            disabled={isSubmitting}
            onChange={e => handleChange('phone', formatPhoneNumber(e.target.value))}
            autoComplete="tel"
            placeholder="010-1234-5678"
            style={inputStyle}
          />
          {phoneFormatFeedback && <FieldFeedback feedback={phoneFormatFeedback} />}
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
          disabled={isSubmitting}
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
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
            boxShadow: '0 3px 0 #5f7d50, 0 6px 14px rgba(95, 125, 80, 0.25)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            marginTop: 6,
          }}
        >
          {isSubmitting ? '가입 처리 중...' : isKakaoSignup ? '가입하고 시작하기' : '가입하기'}
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
          {isKakaoSignup ? (
            <button
              type="button"
              onClick={onKakaoSignupCancel}
              disabled={isSubmitting}
              style={{
                background: 'none',
                border: 'none',
                color: '#5f7d50',
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              다음에 할게요
            </button>
          ) : (
            <>
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
            </>
          )}
        </p>
      </form>

      {restoreRequest && (
        <RestoreConfirmDialog
          isPending={isPending}
          onCancel={handleRestoreCancel}
          onConfirm={handleRestoreConfirm}
        />
      )}
      {kakaoRestoreRequest && (
        <KakaoRestoreConfirmDialog
          password={kakaoRestorePassword}
          passwordError={kakaoRestorePasswordError}
          isPending={isKakaoPending}
          onCancel={handleKakaoRestoreCancel}
          onConfirm={handleKakaoRestoreConfirm}
          onPasswordChange={value => {
            setKakaoRestorePassword(value)
            setKakaoRestorePasswordError('')
          }}
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

function FieldFeedback({
  feedback,
  tone = 'error',
}: {
  feedback: FieldValidationFeedback
  tone?: 'error' | 'neutral' | 'success'
}) {
  return (
    <p
      style={{
        ...fieldFeedbackStyle,
        color: tone === 'success' ? '#5f7d50' : tone === 'error' ? '#8c3a1f' : '#8a7558',
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

function KakaoRestoreConfirmDialog({
  password,
  passwordError,
  isPending,
  onCancel,
  onConfirm,
  onPasswordChange,
}: {
  password: string
  passwordError: string
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
  onPasswordChange: (value: string) => void
}) {
  return (
    <FeedbackDialog
      variant="info"
      title="계정 복구"
      message={(
        <>
          <p style={{ margin: 0 }}>
            기존에 가입한 이력이 있습니다. 복구를 진행할까요?
          </p>
          <div style={{ marginTop: 16, textAlign: 'left' }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 14,
                fontWeight: 700,
                color: '#6b5638',
              }}
            >
              기존 계정 비밀번호 <span style={{ color: '#a37548', fontWeight: 400 }}>(필요 시)</span>
            </label>
            <input
              type="password"
              value={password}
              disabled={isPending}
              onChange={event => onPasswordChange(event.target.value)}
              autoComplete="current-password"
              placeholder="비밀번호가 있던 계정이면 입력하세요"
              style={{
                ...inputStyle,
                fontSize: 16,
                opacity: isPending ? 0.6 : 1,
                cursor: isPending ? 'not-allowed' : 'text',
              }}
            />
            {passwordError && (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#8c3a1f' }}>
                {passwordError}
              </p>
            )}
          </div>
        </>
      )}
      cancelLabel="아니오"
      confirmLabel={isPending ? '복구 중...' : '예'}
      isPending={isPending}
      onClose={onCancel}
      onConfirm={onConfirm}
    />
  )
}
