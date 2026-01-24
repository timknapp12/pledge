declare module 'react-native-event-source' {
  interface EventSourceInit {
    withCredentials?: boolean;
    headers?: Record<string, string>;
  }

  class EventSource {
    constructor(url: string, eventSourceInitDict?: EventSourceInit);
    readonly url: string;
    readonly readyState: number;
    readonly withCredentials: boolean;
    readonly CONNECTING: number;
    readonly OPEN: number;
    readonly CLOSED: number;
    onopen: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    addEventListener(
      type: string,
      listener: (event: MessageEvent) => void
    ): void;
    removeEventListener(
      type: string,
      listener: (event: MessageEvent) => void
    ): void;
    close(): void;
  }

  export default EventSource;
}
