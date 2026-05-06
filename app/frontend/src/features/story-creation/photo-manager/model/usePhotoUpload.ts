import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import exifr from 'exifr'
import { presignPhoto } from '../api/presignPhoto'
import { postPhoto } from '../api/postPhoto'
import type { UploadablePhotoPurpose } from '../api/types'

/**
 * 업로드 중인 한 장의 로컬 상태.
 * 서버 commit 성공하면 이 엔트리는 제거되고, 대신 `usePhotosQuery` 의 서버 데이터로 대체된다.
 */
export interface PendingPhoto {
  tempId: string
  previewUrl: string
  fileName: string
  status: 'uploading' | 'error'
  error?: string
}

/**
 * 3-phase 사진 업로드 오케스트레이션 훅.
 *
 *  Phase 1: presignPhoto → BE 에 PUT URL 요청
 *  Phase 2: fetch(PUT)   → 브라우저가 S3 에 직접 업로드
 *  Phase 3: postPhoto    → BE commit (DB INSERT, takenAt 포함)
 *  Phase 4: invalidateQueries(['photos', storyId]) → 서버 목록 자동 리로드
 *
 * 사용자 UX 향상을 위해:
 *  - Phase 1 시작 직후 blob URL 로 썸네일 즉시 표시 (`pending` 에 추가)
 *  - Phase 3 성공 시 `pending` 에서 제거, blob URL revoke
 *  - 실패 시 `pending` 항목의 status 를 'error' 로 남김 (사용자가 재시도 or 제거)
 *
 * `uploadMany` 는 EXIF DateTimeOriginal 을 병렬 추출 → 촬영 시각 오름차순으로 정렬한 후
 * 그 순서대로 업로드를 시작한다. 업로드 자체는 Promise.all 병렬이지만 BE 의 displayOrder
 * 가 INSERT 시점 createdAt 으로 매겨지는 한 (실측상) 시작 순서가 곧 displayOrder 가 된다.
 *
 * 정확한 인서트 순서가 중요해지면 future: uploadMany 를 직렬화 (순차 await) 또는
 * BE 가 takenAt 기준 정렬을 응답에서 적용. 현재는 FE 가 정렬한 순서로 시작 → BE 가
 * 받아오는 순서대로 displayOrder 가 매겨진다.
 */
export function usePhotoUpload(
  storyId: number | null,
  purpose: UploadablePhotoPurpose = 'STORYBOARD',
) {
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<PendingPhoto[]>([])

  // 언마운트 시 아직 남아있는 blob URL 정리.
  useEffect(() => {
    return () => {
      pending.forEach(p => URL.revokeObjectURL(p.previewUrl))
    }
    // 의도적 1회: 마운트/언마운트만 감시. pending 변화로 revoke 되면 화면이 깜빡임.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const uploadOne = useCallback(
    async (file: File, takenAt: string | null = null) => {
      if (storyId === null) {
        throw new Error('storyId 가 아직 없습니다. step 1 저장 후 업로드 가능합니다.')
      }

      const tempId = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(file)

      // 즉시 썸네일 표시
      setPending(prev => [
        ...prev,
        { tempId, previewUrl, fileName: file.name, status: 'uploading' },
      ])

      try {
        // Phase 1: presign — purpose 가 CHARACTER_REF 이면 BE 가 lock 검증을 함께 수행.
        const presigned = await presignPhoto(storyId, { contentType: file.type, purpose })
        // Phase 2: PUT to S3 (BE 통과 없음)
        const putRes = await fetch(presigned.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (!putRes.ok) {
          throw new Error(`S3 업로드 실패 (${putRes.status})`)
        }
        // Phase 3: commit — purpose + takenAt 전달. CHARACTER_REF 면 BE 가 max-3 + lock 검증.
        await postPhoto(storyId, { s3Key: presigned.s3Key, purpose, takenAt })

        // 성공 — pending 제거 + 서버 목록 invalidate
        setPending(prev => prev.filter(p => p.tempId !== tempId))
        URL.revokeObjectURL(previewUrl)
        queryClient.invalidateQueries({ queryKey: ['photos', storyId] })
      } catch (err) {
        const message = err instanceof Error ? err.message : '업로드 실패'
        setPending(prev =>
          prev.map(p => (p.tempId === tempId ? { ...p, status: 'error', error: message } : p)),
        )
      }
    },
    [storyId, purpose, queryClient],
  )

  /**
   * 여러 파일을 EXIF 촬영 시각 오름차순으로 정렬 후 병렬 업로드.
   *
   * EXIF DateTimeOriginal 이 없는 파일은 정렬 시 뒤로 밀린다 (NULL 후행).
   * 같은 시각이거나 둘 다 EXIF 가 없으면 원본 입력 순서를 보존 (Array#sort stable).
   */
  const uploadMany = useCallback(
    async (files: File[] | FileList) => {
      const list = Array.from(files).filter(f => f.type.startsWith('image/'))

      // EXIF 병렬 추출 — 각 파일에서 DateTimeOriginal 만. 실패해도 무시 (null 처리).
      const enriched = await Promise.all(
        list.map(async (file, index) => {
          const taken = await readExifTakenAt(file)
          return { file, takenAt: taken, originalIndex: index }
        }),
      )

      // 촬영 시각 오름차순. 없으면 뒤로. 같으면 원본 인덱스 보존.
      enriched.sort((a, b) => {
        if (a.takenAt && b.takenAt) {
          const cmp = a.takenAt.getTime() - b.takenAt.getTime()
          return cmp !== 0 ? cmp : a.originalIndex - b.originalIndex
        }
        if (a.takenAt) return -1
        if (b.takenAt) return 1
        return a.originalIndex - b.originalIndex
      })

      await Promise.all(
        enriched.map(({ file, takenAt }) => uploadOne(file, toLocalDateTimeIso(takenAt))),
      )
    },
    [uploadOne],
  )

  /** 에러 난 pending 엔트리를 사용자가 dismiss. */
  const dismissPending = useCallback((tempId: string) => {
    setPending(prev => {
      const target = prev.find(p => p.tempId === tempId)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter(p => p.tempId !== tempId)
    })
  }, [])

  return { pending, uploadMany, dismissPending }
}

/**
 * 파일 헤더만 부분 fetch 해서 EXIF DateTimeOriginal 추출.
 * exifr 가 자동으로 SubIFD 까지 따라가며 가장 정확한 촬영 시각을 돌려준다.
 * 파싱 실패 / EXIF 없음 / 타입이 JPEG/HEIC 등이 아닌 경우 null.
 */
async function readExifTakenAt(file: File): Promise<Date | null> {
  try {
    const exif = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate', 'ModifyDate'])
    const date = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.ModifyDate
    if (!date) return null
    if (date instanceof Date) return Number.isNaN(date.getTime()) ? null : date
    const parsed = new Date(date as string | number)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  } catch {
    return null
  }
}

/**
 * BE 의 `LocalDateTime` 은 'YYYY-MM-DDTHH:mm:ss' 형식 (timezone offset 없음).
 * Date → 로컬 시각 ISO 로 변환. EXIF DateTimeOriginal 은 보통 카메라 로컬 시각이라
 * 그대로 LocalDateTime 으로 보내는 게 적절.
 */
function toLocalDateTimeIso(date: Date | null): string | null {
  if (!date) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const mi = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`
}
