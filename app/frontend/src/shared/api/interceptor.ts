/**
 * 인터셉터는 동기/비동기 함수 모두 허용한다.
 * 예를 들어 토큰 조회는 async, 단순 헤더 수정은 sync가 될 수 있다.
 */
type MaybePromise<TValue> = TValue | Promise<TValue>

/**
 * request/response처럼 "성공 흐름의 값"을 순차적으로 가공하는 체인이다.
 * 앞 인터셉터의 반환값을 다음 인터셉터가 그대로 이어받는다.
 */
export class InterceptorManager<TValue> {
  private nextId = 0
  private readonly handlers = new Map<number, (value: TValue) => MaybePromise<TValue>>()

  use(onFulfilled: (value: TValue) => MaybePromise<TValue>): number {
    const id = this.nextId
    this.nextId += 1
    this.handlers.set(id, onFulfilled)
    return id
  }

  eject(id: number): void {
    this.handlers.delete(id)
  }

  clear(): void {
    this.handlers.clear()
  }

  /**
   * 현재 등록된 인터셉터를 순서대로 실행한다.
   * 마지막 인터셉터가 반환한 값이 최종 결과가 된다.
   */
  async run(value: TValue): Promise<TValue> {
    let current = value

    for (const handler of this.handlers.values()) {
      current = await handler(current)
    }

    return current
  }
}

/**
 * error 흐름 전용 체인이다.
 * 핸들러가 `undefined`를 반환하면 기존 에러를 유지하고,
 * 새 에러를 반환하면 그 에러로 교체해서 다음 단계로 넘긴다.
 */
export class ErrorInterceptorManager<TError> {
  private nextId = 0
  private readonly handlers = new Map<number, (error: TError) => MaybePromise<TError | void>>()

  use(onRejected: (error: TError) => MaybePromise<TError | void>): number {
    const id = this.nextId
    this.nextId += 1
    this.handlers.set(id, onRejected)
    return id
  }

  eject(id: number): void {
    this.handlers.delete(id)
  }

  clear(): void {
    this.handlers.clear()
  }

  /**
   * 에러 인터셉터를 순서대로 실행한다.
   * 로깅만 하는 인터셉터와 에러를 치환하는 인터셉터를 함께 지원한다.
   */
  async run(error: TError): Promise<TError> {
    let current = error

    for (const handler of this.handlers.values()) {
      const next = await handler(current)
      if (next !== undefined) {
        current = next
      }
    }

    return current
  }
}
