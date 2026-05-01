import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
 *  Phase 3: postPhoto    → BE commit (DB INSERT)
 *  Phase 4: invalidateQueries(['photos', storyId]) → 서버 목록 자동 리로드
 *
 * 사용자 UX 향상을 위해:
 *  - Phase 1 시작 직후 blob URL 로 썸네일 즉시 표시 (`pending` 에 추가)
 *  - Phase 3 성공 시 `pending` 에서 제거, blob URL revoke
 *  - 실패 시 `pending` 항목의 status 를 'error' 로 남김 (사용자가 재시도 or 제거)
 *
 * 여러 파일을 동시에 올리려면 `uploadMany` 사용 — 각 파일이 독립적으로 병렬 진행.
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
    async (file: File) => {
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
        // Phase 3: commit — purpose 그대로 전달. CHARACTER_REF 면 BE 가 max-3 + lock 검증.
        await postPhoto(storyId, { s3Key: presigned.s3Key, purpose })

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

  /** 여러 파일을 병렬로 업로드. */
  const uploadMany = useCallback(
    async (files: File[] | FileList) => {
      const list = Array.from(files).filter(f => f.type.startsWith('image/'))
      await Promise.all(list.map(uploadOne))
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
