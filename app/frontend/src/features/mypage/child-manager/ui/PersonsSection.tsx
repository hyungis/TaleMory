import type { Person } from '../../../../entities/person'

interface Props {
  persons: Person[]
  onAddClick: () => void
  onEditClick: (person: Person) => void
  onDeleteClick: (person: Person) => void
  isLoading?: boolean
  isBusy?: boolean
}

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
    <section className="rounded-2xl bg-[#2a1b12] border border-[#4a3a24] p-6 md:p-8 space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#e4d4b4]">주인공 관리</h2>
          <p className="text-sm text-[#b4c4a4] mt-1">동화책에 등장할 아이 정보를 관리해요.</p>
        </div>
        <button
          type="button"
          onClick={onAddClick}
          disabled={isBusy}
          className="px-4 py-2 rounded-lg bg-[#3ca55c] text-[#1a0f08] text-sm font-medium hover:bg-[#4cb56c] transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + 주인공 추가
        </button>
      </header>

      {isLoading ? (
        <p className="text-sm text-[#b4c4a4] px-1 py-4">주인공 목록을 불러오는 중이에요.</p>
      ) : children.length === 0 ? (
        <p className="text-sm text-[#6a5a44] italic px-1 py-4">아직 등록된 주인공이 없어요.</p>
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
    <div className="rounded-xl bg-[#1a0f08] border border-[#4a3a24] p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-[#4a3a24] text-[#e4d4b4] text-sm font-bold flex items-center justify-center shrink-0">
        {person.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#e4d4b4] font-medium truncate">{person.name}</p>
        <p className="text-xs text-[#b4c4a4] truncate">
          {person.birthDate ?? '생년월일 미입력'} · {genderLabel}
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(person)}
          disabled={isBusy}
          className="px-2 py-1 rounded-md text-xs text-[#b4c4a4] hover:bg-[#4a3a24] hover:text-[#e4d4b4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          수정
        </button>
        <button
          type="button"
          onClick={() => onDelete(person)}
          disabled={isBusy}
          className="px-2 py-1 rounded-md text-xs text-[#e85c5c] hover:bg-[#e85c5c] hover:text-[#1a0f08] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
