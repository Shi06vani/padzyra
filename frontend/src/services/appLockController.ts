export type AppLockState =
  | 'initializing'
  | 'unlocked'
  | 'locked'
  | 'authenticating'
  | 'authentication_failed'
  | 'disabled';

export interface StateTransitionEvent {
  from: AppLockState;
  to: AppLockState;
  reason?: string;
  timestamp: number;
}

export class AppLockController {
  private currentState: AppLockState = 'initializing';
  private transitionHistory: StateTransitionEvent[] = [];

  constructor(initialState: AppLockState = 'initializing') {
    this.currentState = initialState;
  }

  getState(): AppLockState {
    return this.currentState;
  }

  /**
   * Checks whether a proposed transition is valid according to the security state machine.
   */
  canTransitionTo(nextState: AppLockState): boolean {
    const current = this.currentState;

    if (current === nextState) return true;

    switch (current) {
      case 'initializing':
        // From initialization, can transition to disabled, locked, or unlocked
        return nextState === 'disabled' || nextState === 'locked' || nextState === 'unlocked';

      case 'disabled':
        // When disabled, can transition to locked or unlocked (when user enables it)
        return nextState === 'unlocked' || nextState === 'locked';

      case 'unlocked':
        // When unlocked, can lock (due to background/inactivity) or disable (user settings)
        return nextState === 'locked' || nextState === 'disabled';

      case 'locked':
        // When locked, can start authenticating or disable (e.g. emergency reset)
        return nextState === 'authenticating' || nextState === 'disabled' || nextState === 'unlocked';

      case 'authenticating':
        // While authenticating, can transition to unlocked, authentication_failed, or remain locked
        return (
          nextState === 'unlocked' ||
          nextState === 'authentication_failed' ||
          nextState === 'locked' ||
          nextState === 'disabled'
        );

      case 'authentication_failed':
        // From failure, user can retry (authenticating), remain locked, or unlock
        return nextState === 'authenticating' || nextState === 'locked' || nextState === 'disabled';

      default:
        return false;
    }
  }

  /**
   * Performs state transition if permitted. Throws or returns false if invalid.
   */
  transition(nextState: AppLockState, reason?: string): boolean {
    if (!this.canTransitionTo(nextState)) {
      return false;
    }

    const event: StateTransitionEvent = {
      from: this.currentState,
      to: nextState,
      reason,
      timestamp: Date.now(),
    };

    this.transitionHistory.push(event);
    this.currentState = nextState;
    return true;
  }

  getHistory(): StateTransitionEvent[] {
    return [...this.transitionHistory];
  }

  /**
   * Determines whether the app should transition to locked upon returning from background.
   */
  static shouldAutoLock(
    lastBackgroundTimestamp: number,
    timeoutSeconds: number,
    currentTimestamp: number = Date.now()
  ): boolean {
    if (!lastBackgroundTimestamp || lastBackgroundTimestamp <= 0) {
      return true;
    }

    // 0 seconds = immediate mode
    if (timeoutSeconds <= 0) {
      return true;
    }

    const elapsedMs = currentTimestamp - lastBackgroundTimestamp;
    const timeoutMs = timeoutSeconds * 1000;
    return elapsedMs >= timeoutMs;
  }
}
