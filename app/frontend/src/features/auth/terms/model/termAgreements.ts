import type { TermDetail, TermDetailSlug } from './termDetails'

export type TermsKey = 'serviceTermsAgree' | 'privacyAgree'

export interface TermAgreement {
  termId: number
  agreed: boolean
}

export class RequiredTermsNotFoundError extends Error {
  constructor(slug: TermDetailSlug) {
    super(`Required term is not available: ${slug}`)
    this.name = 'RequiredTermsNotFoundError'
  }
}

export function isRequiredTermsNotFoundError(error: unknown): error is RequiredTermsNotFoundError {
  return error instanceof RequiredTermsNotFoundError
}

export function buildRequiredTermAgreements(
  values: {
    serviceTermsAgree: boolean
    privacyAgree: boolean
  },
  terms: TermDetail[],
): TermAgreement[] {
  return [
    { termId: requireRequiredTermId(terms, 'service'), agreed: values.serviceTermsAgree },
    { termId: requireRequiredTermId(terms, 'privacy'), agreed: values.privacyAgree },
  ]
}

function requireRequiredTermId(terms: TermDetail[], slug: TermDetailSlug): number {
  const termId = terms.find(term => term.slug === slug)?.termId
  if (termId === undefined) {
    throw new RequiredTermsNotFoundError(slug)
  }

  return termId
}
