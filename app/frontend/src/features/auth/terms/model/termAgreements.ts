export type TermsKey = 'serviceTermsAgree' | 'privacyAgree'

export interface TermAgreement {
  termId: number
  agreed: boolean
}

export const REQUIRED_TERM_IDS = {
  serviceTerms: 1,
  privacy: 2,
} as const

export function buildRequiredTermAgreements(values: {
  serviceTermsAgree: boolean
  privacyAgree: boolean
}): TermAgreement[] {
  return [
    { termId: REQUIRED_TERM_IDS.serviceTerms, agreed: values.serviceTermsAgree },
    { termId: REQUIRED_TERM_IDS.privacy, agreed: values.privacyAgree },
  ]
}
