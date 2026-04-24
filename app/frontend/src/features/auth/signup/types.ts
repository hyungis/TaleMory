export interface SignupRequest {
  loginId: string
  password: string
  email: string
  name: string
  nickname: string
  phone?: string
  agreeSms: boolean
  agreeMarketing: boolean
}
