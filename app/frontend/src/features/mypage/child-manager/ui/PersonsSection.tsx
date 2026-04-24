import type { Person } from '../../../../entities/person'

interface Props {
  persons: Person[]
  onAddClick: () => void
  onEditClick: (person: Person) => void
  onDeleteClick: (person: Person) => void
}

/**
 * 등장 인물 섹션 — 주인공 아이만 표시.
 * 디자인 결정: 동행자는 마이페이지에서 노출하지 않음.
 * 카드 각각에 편집/삭제 버튼. 추가는 섹션 헤더 우측 버튼.
 */
export function PersonsSection({ persons, onAddClick, onEditClick, onDeleteClick }: Props) {
  const children = persons.filter((p) => p.role === 'child')

  return (
    <section className="rounded-2xl bg-[#2a1b12] border border-[#4a3a24] p-6 md:p-8 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#e4d4b4]">주인공</h2>
          <p className="text-sm text-[#b4c4a4] mt-1">동화책 주인공을 관리해요.</p>
        </div>
        <button
          type="button"
          onClick={onAddClick}
          className="px-4 py-2 rounded-lg bg-[#3ca55c] text-[#1a0f08] text-sm font-medium hover:bg-[#4cb56c] transition-colors shrink-0"
        >
          + 주인공 추가
        </button>
      </header>

      {children.length === 0 ? (
        <p className="text-sm text-[#6a5a44] italic px-1 py-4">등록된 주인공이 없어요</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {children.map((p) => (
            <PersonCard key={p.id} person={p} onEdit={onEditClick} onDelete={onDeleteClick} />
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
}: {
  person: Person
  onEdit: (p: Person) => void
  onDelete: (p: Person) => void
}) {
  const genderLabel =
    person.gender === 'male' ? '남' : person.gender === 'female' ? '여' : person.gender ? '기타' : '—'

  return (
    <div className="rounded-xl bg-[#1a0f08] border border-[#4a3a24] p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-[#4a3a24] text-[#e4d4b4] text-sm font-bold flex items-center justify-center shrink-0">
        {person.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#e4d4b4] font-medium truncate">{person.name}</p>
        <p className="text-xs text-[#b4c4a4] truncate">
          {person.birthDate ?? '생일 미입력'} · {genderLabel}
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(person)}
          className="px-2 py-1 rounded-md text-xs text-[#b4c4a4] hover:bg-[#4a3a24] hover:text-[#e4d4b4] transition-colors"
        >
          편집
        </button>
        <button
          type="button"
          onClick={() => onDelete(person)}
          className="px-2 py-1 rounded-md text-xs text-[#e85c5c] hover:bg-[#e85c5c] hover:text-[#1a0f08] transition-colors"
        >
          삭제
        </button>
      </div>
    </div>
  )
}
