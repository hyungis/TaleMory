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
 * 주인공 관리 섹션 — Pastel Forest 톤.
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
    <section className="rounded-3xl bg-[#E9DBBE] border-2 border-[#B9D38F]/55 shadow-[0_4px_14px_rgba(154,117,72,0.14)] p-6 md:p-8 space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#3E2A18]">주인공 관리</h2>
          <p className="text-sm text-[#6B4A28] mt-1">동화책에 등장할 아이 정보를 관리해요.</p>
        </div>
        <button
          type="button"
          onClick={onAddClick}
          disabled={isBusy}
          className="px-5 py-2.5 rounded-full bg-[#8DBA64] text-[#1F3318] text-sm font-bold border border-[#B9D38F] shadow-[0_3px_0_#3F6B2E] hover:translate-y-0.5 hover:shadow-[0_1px_0_#3F6B2E] hover:bg-[#A6CB45] transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_3px_0_#3F6B2E]"
        >
          + 주인공 추가
        </button>
      </header>

      {isLoading ? (
        <p className="text-sm text-[#6B4A28] px-1 py-4">주인공 목록을 불러오는 중이에요.</p>
      ) : children.length === 0 ? (
        <p className="text-sm text-[#9A7548] italic px-1 py-4">아직 등록된 주인공이 없어요.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
    <div className="rounded-2xl bg-[#F4E4BC] border border-[#9A7548]/30 p-4 flex items-center gap-3 shadow-sm">
      <div className="w-10 h-10 rounded-full bg-[#B9D38F]/45 border border-[#3F6B2E]/40 text-[#3F6B2E] text-sm font-bold flex items-center justify-center shrink-0">
        {person.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#3E2A18] font-bold truncate">{person.name}</p>
        <p className="text-xs text-[#6B4A28] truncate">
          {person.age}세 · {genderLabel}
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(person)}
          disabled={isBusy}
          className="px-2.5 py-1 rounded-md text-xs font-bold text-[#3F6B2E] hover:bg-[#B9D38F]/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          수정
        </button>
        <button
          type="button"
          onClick={() => onDelete(person)}
          disabled={isBusy}
          className="px-2.5 py-1 rounded-md text-xs font-bold text-[#a3413f] hover:bg-[#D8857C]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
