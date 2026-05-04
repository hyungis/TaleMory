export interface SignupRequest {
  loginId: string
  password: string
  passwordCheck: string
  email: string
  name: string
  nickname: string
  phone?: string
  agreeSms: boolean
  agreeMarketing: boolean
  restoreConfirmed?: boolean
}

export interface SignupResponse {
  userId: number
}
