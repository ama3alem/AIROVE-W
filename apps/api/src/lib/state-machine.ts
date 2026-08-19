import { BAGGAGE_STATE_TRANSITIONS, OPERATIONAL_EVENT_TO_STATE } from '@airove/shared';
import type { BaggageLifecycleState, OperationalEventType, StateTransitionResult } from '@airove/shared';

export class BaggageStateMachine {
  canTransition(from: string, to: string): boolean {
    const allowed = BAGGAGE_STATE_TRANSITIONS[from];
    if (!allowed) return false;
    return (allowed as readonly string[]).includes(to);
  }

  getStateForEvent(eventType: OperationalEventType): BaggageLifecycleState | null {
    const state = OPERATIONAL_EVENT_TO_STATE[eventType];
    return (state && typeof state === 'string') ? (state as BaggageLifecycleState) : null;
  }

  validateTransition(
    currentState: string,
    eventType: OperationalEventType,
  ): StateTransitionResult {
    const newState = this.getStateForEvent(eventType);

    if (!newState) {
      return {
        allowed: true,
        previousState: currentState as BaggageLifecycleState,
        newState: currentState as BaggageLifecycleState,
        reason: 'Event type does not cause a state change',
      };
    }

    if (newState === currentState) {
      return {
        allowed: true,
        previousState: currentState as BaggageLifecycleState,
        newState,
        reason: 'Same state re-confirmation',
      };
    }

    if (this.canTransition(currentState, newState)) {
      return {
        allowed: true,
        previousState: currentState as BaggageLifecycleState,
        newState,
      };
    }

    return {
      allowed: false,
      previousState: currentState as BaggageLifecycleState,
      newState,
      reason: `Invalid transition from '${currentState}' to '${newState}' via '${eventType}'`,
    };
  }

  isTerminalState(state: string): boolean {
    const transitions = BAGGAGE_STATE_TRANSITIONS[state];
    return !transitions || transitions.length === 0;
  }

  getValidTransitions(state: string): readonly string[] {
    return BAGGAGE_STATE_TRANSITIONS[state] ?? [];
  }

  getInitialState(): BaggageLifecycleState {
    return 'created';
  }

  mapLegacyEventType(eventType: string): BaggageLifecycleState {
    const legacyMap: Record<string, BaggageLifecycleState> = {
      bag_accepted: 'accepted',
      bag_screened: 'screened',
      bag_loaded: 'loaded',
      bag_unloaded: 'unloaded',
      bag_transferred: 'transferred',
      bag_delivered: 'delivered',
      bag_missing: 'mishandled',
      bag_delayed: 'mishandled',
      bag_damaged: 'mishandled',
      bag_misrouted: 'mishandled',
      bag_recovered: 'found',
    };
    return legacyMap[eventType] ?? 'created';
  }
}

export const baggageStateMachine = new BaggageStateMachine();
