import type { Level } from '../../model/types'

const LEVELS: readonly Level[] = ['초급', '중급', '고급'] as const

/**
 * 워커 프롬프트(`storyboard_prompt.py`) 의 [AGE AND DIFFICULTY RULES] / [WRITING STYLE]
 * 규칙에 정확히 맞춘 정적 예문. 사용자가 난이도를 선택하면 어떤 톤·길이로 동화가
 * 생성되는지 미리 보여주는 용도. AI 워커는 이 예문을 직접 참조하지 않으며 (FE-only),
 * 톤이 어긋나면 두 곳을 같이 손대야 함.
 *
 * 길이 규칙 (워커 프롬프트):
 * - BEGINNER  / Age 5-6 : 2-3문장, 8-14단어/문장, 25-45단어/페이지
 * - INTERMEDIATE / Age 7-9 : 3-5문장, 8-16단어/문장, 40-75단어/페이지
 * - ADVANCED  / Age 10-12 : 4-6문장, 10-20단어/문장, 70-120단어/페이지
 *
 * 모든 예문은 같은 장면("해변에서 작은 게를 발견하는 순간") 으로 통일하여
 * 사용자가 난이도 차이를 직접 비교할 수 있게 설계.
 */
const LEVEL_EXAMPLES: Record<
  Level,
  {
    ageRange: string
    rule: string
    sentences: ReadonlyArray<{ en: string; ko: string }>
  }
> = {
  초급: {
    ageRange: '5-6세',
    rule: '한 페이지 2-3문장 / 한 문장 8-14단어',
    sentences: [
      {
        en: 'Mia walked slowly on the warm, soft sand by the sea.',
        ko: '미아가 따뜻하고 부드러운 바닷가 모래 위를 천천히 걸었어요.',
      },
      {
        en: 'She saw a tiny crab and her heart felt so warm.',
        ko: '작은 게 한 마리를 발견하고, 미아의 마음이 따뜻해졌어요.',
      },
      {
        en: '"Hello, little friend," she whispered with a soft, kind smile.',
        ko: '"안녕, 작은 친구야," 미아가 부드럽고 다정한 미소로 속삭였어요.',
      },
    ],
  },
  중급: {
    ageRange: '7-9세',
    rule: '한 페이지 3-5문장 / 한 문장 8-16단어',
    sentences: [
      {
        en: 'One sunny morning, Mia walked along the shore and spotted something tiny in the sand.',
        ko: '어느 화창한 아침, 미아는 바닷가를 걷다가 모래 속에서 무언가 작은 것을 발견했어요.',
      },
      {
        en: 'A bright orange crab popped up from the wet sand and waved its little claws shyly!',
        ko: '밝은 주황색 게 한 마리가 젖은 모래에서 폴짝 튀어나와 작은 집게발을 수줍게 흔들었어요!',
      },
      {
        en: '"Mom, come and see!" she called out, her voice full of bright wonder.',
        ko: '"엄마, 와서 봐요!" 미아가 환한 놀라움이 가득한 목소리로 외쳤어요.',
      },
      {
        en: 'The crab scuttled sideways across the shore, leaving a tiny trail of footprints.',
        ko: '게는 옆으로 사삭 걸어가며 작은 발자국을 한 줄로 남겼어요.',
      },
    ],
  },
  고급: {
    ageRange: '10-12세',
    rule: '한 페이지 4-6문장 / 한 문장 10-20단어',
    sentences: [
      {
        en: 'As the morning waves whispered softly across the shore, Mia paused on the cool, damp sand.',
        ko: '아침 파도가 해변을 따라 부드럽게 속삭일 때, 미아는 시원하고 촉촉한 모래 위에 멈춰 섰어요.',
      },
      {
        en: 'There, half-hidden beneath a curl of seaweed, a tiny tangerine-bright crab peeked up at her.',
        ko: '그곳, 한 줄기 해초에 반쯤 숨어, 귤처럼 환한 작은 게 한 마리가 미아를 빼꼼 올려다보았어요.',
      },
      {
        en: 'Its two beady eyes shone with quiet curiosity, as if greeting a small new friend.',
        ko: '두 개의 까만 눈에는 조용한 호기심이 담겨 있었어요. 마치 새 친구를 반기는 것 같았지요.',
      },
      {
        en: '"Mom, you have to see this!" she called over her shoulder, her voice trembling with wonder.',
        ko: '"엄마, 이거 꼭 봐야 해요!" 미아는 어깨 너머로 외쳤어요. 목소리가 경이로움으로 떨렸지요.',
      },
      {
        en: 'The little crab lifted one claw, almost like a wave, before scuttling a perfect zigzag across the glistening sand.',
        ko: '작은 게는 한쪽 집게발을 살며시 들어 올렸어요. 마치 손을 흔드는 것처럼요. 그러고는 반짝이는 모래 위에 완벽한 지그재그를 그리며 걸어갔지요.',
      },
    ],
  },
} as const

interface LevelPickerProps {
  value: Level
  onChange: (level: Level) => void
  /** 잠금 상태 시 모든 버튼 disabled (예: SUMMARY 락). */
  disabled?: boolean
}

/**
 * 3-column 난이도 선택 — paper-craft segmented control.
 * `.cr-seg` 클래스로 active(`.on`) 상태 시 sage-darker 배경 + cream 글자.
 * 선택된 난이도의 예문이 바로 아래 `.cr-level-preview` 카드에 표시됨.
 */
export function LevelPicker({ value, onChange, disabled = false }: LevelPickerProps) {
  const example = LEVEL_EXAMPLES[value]

  return (
    <div className="cr-field">
      <label className="cr-label">
        난이도 <span className="star">*</span>
      </label>
      <div className="cr-seg">
        {LEVELS.map(lv => (
          <button
            key={lv}
            type="button"
            onClick={() => onChange(lv)}
            disabled={disabled}
            className={value === lv ? 'on' : ''}
            aria-pressed={value === lv}
          >
            {lv}
          </button>
        ))}
      </div>

      <div
        key={value}
        className="cr-level-preview"
        role="region"
        aria-label={`${value} 영어 예문`}
      >
        <div className="cr-level-preview-meta">
          추천 {example.ageRange} · {example.rule}
        </div>
        <ol className="cr-level-preview-list">
          {example.sentences.map((s, i) => (
            <li key={i}>
              <p className="en">{s.en}</p>
              <p className="ko">{s.ko}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
