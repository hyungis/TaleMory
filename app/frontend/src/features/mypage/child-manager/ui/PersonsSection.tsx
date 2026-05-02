import type { Person } from '../../../../entities/person'

interface Props {
  persons: Person[]
  onAddClick: () => void
  onEditClick: (person: Person) => void
  onDeleteClick: (person: Person) => void
  isLoading?: boolean
  isBusy?: boolean
}

/**
 * 주인공 관리 섹션 — paper-craft 톤.
 */
export function PersonsSection({
  persons,
  onAddClick,
  onEditClick,
  onDeleteClick,
  isLoading = false,
  isBusy = false,
}: Props) {
  const children = persons.filter(person => person.role === 'child')

  return (
    <section className="mp-card">
      <span className="mp-tape mp-tape--alt" aria-hidden="true" />
      <header className="mp-card-header">
        <div>
          <h2 className="mp-card-title">주인공 관리</h2>
          <div className="mp-card-sub">동화책에 등장할 아이 정보를 관리해요.</div>
        </div>
        <button
          type="button"
          onClick={onAddClick}
          disabled={isBusy}
          className="mp-btn mp-btn-sage"
        >
          + 주인공 추가
        </button>
      </header>

      {isLoading ? (
        <p className="mp-muted">주인공 목록을 불러오는 중이에요.</p>
      ) : children.length === 0 ? (
        <p className="mp-muted mp-muted--italic">아직 등록된 주인공이 없어요.</p>
      ) : (
        <div className="mp-char-grid">
          {children.map(person => (
            <PersonCard
              key={person.id}
              person={person}
              onEdit={onEditClick}
              onDelete={onDeleteClick}
              isBusy={isBusy}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function PersonCard({
  person,
  onEdit,
  onDelete,
  isBusy,
}: {
  person: Person
  onEdit: (person: Person) => void
  onDelete: (person: Person) => void
  isBusy: boolean
}) {
  const genderLabel = getGenderLabel(person.gender)

  return (
    <div className="mp-char-card">
      <div className="mp-char-avatar">{person.name.charAt(0)}</div>
      <div style={{ minWidth: 0 }}>
        <div className="mp-char-name">{person.name}</div>
        <div className="mp-char-meta">
          {person.age}세 · {genderLabel}
        </div>
      </div>
      <div className="mp-char-actions">
        <button
          type="button"
          onClick={() => onEdit(person)}
          disabled={isBusy}
          className="mp-icon-action"
        >
          수정
        </button>
        <button
          type="button"
          onClick={() => onDelete(person)}
          disabled={isBusy}
          className="mp-icon-action danger"
        >
          삭제
        </button>
      </div>
    </div>
  )
}

function getGenderLabel(gender: Person['gender']): string {
  switch (gender) {
    case 'male':
      return '남아'
    case 'female':
      return '여아'
    case 'other':
      return '기타'
    default:
      return '미설정'
  }
}
