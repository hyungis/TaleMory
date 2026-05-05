export type TermDetailSlug = 'service' | 'privacy'

export interface TermResponse {
  termId: number
  type: string
  version: number
  title: string
  content: string
  isRequired: boolean
  effectiveAt: string
  createdAt: string
}

export interface TermDetailSection {
  title: string
  body: string[]
}

export interface TermDetail {
  slug: TermDetailSlug
  termId?: number
  title: string
  summary: string
  effectiveDate: string
  sections: TermDetailSection[]
}

export function mapTermResponseToDetail(response: TermResponse): TermDetail | null {
  const slug = getTermSlug(response.type)
  if (slug === null) return null

  return {
    slug,
    termId: response.termId,
    title: response.title,
    summary: getTermSummary(slug),
    effectiveDate: response.effectiveAt.slice(0, 10),
    sections: parseTermContent(response.content),
  }
}

function getTermSlug(type: string): TermDetailSlug | null {
  const normalizedType = type.trim().toUpperCase()
  if (normalizedType === 'SERVICE' || normalizedType === 'SERVICE_TERMS') return 'service'
  if (normalizedType === 'PRIVACY' || normalizedType === 'PRIVACY_POLICY') return 'privacy'
  return null
}

function getTermSummary(slug: TermDetailSlug): string {
  if (slug === 'service') {
    return '영어 동화 제작 서비스 이용에 필요한 기본 권리, 의무, 이용 제한 사항을 안내합니다.'
  }

  return '회원가입과 서비스 제공에 필요한 개인정보 수집 항목, 이용 목적, 보관 기간을 안내합니다.'
}

function parseTermContent(content: string): TermDetailSection[] {
  const sections: TermDetailSection[] = []
  let currentSection: TermDetailSection | null = null

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('## ')) {
      currentSection = {
        title: line.slice(3).trim(),
        body: [],
      }
      sections.push(currentSection)
      continue
    }

    if (currentSection === null) {
      currentSection = {
        title: '상세 내용',
        body: [],
      }
      sections.push(currentSection)
    }

    currentSection.body.push(line)
  }

  return sections
}
