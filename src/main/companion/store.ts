import { initialState, reduce, type AgentEvent, type AgentState } from "@blueberry/protocol";

type Listener = (event: AgentEvent, state: AgentState) => void;

// Authoritative agent state on the desktop. Every change goes through emit(),
// so the snapshot sent to a reconnecting phone is always consistent with the events.
export class CompanionStore {
  private _state: AgentState = initialState;
  private listeners = new Set<Listener>();

  get state(): AgentState {
    return this._state;
  }

  emit(event: AgentEvent): void {
    this._state = reduce(this._state, event);
    this.listeners.forEach((listener) => listener(event, this._state));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
