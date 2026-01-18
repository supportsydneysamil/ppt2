import { describe, it, expect } from 'vitest';
import { SessionState, BlackoutMode } from '../types';

// Session state reducer for testing
type SessionAction =
    | { type: 'SET_SLIDE_INDEX'; payload: { slideIndex: number } }
    | { type: 'SET_BLACKOUT'; payload: { blackoutMode: BlackoutMode } }
    | { type: 'RESET' };

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
    switch (action.type) {
        case 'SET_SLIDE_INDEX':
            return {
                ...state,
                slideIndex: action.payload.slideIndex,
                updatedAt: new Date().toISOString(),
            };
        case 'SET_BLACKOUT':
            return {
                ...state,
                blackoutMode: action.payload.blackoutMode,
                updatedAt: new Date().toISOString(),
            };
        case 'RESET':
            return {
                slideIndex: 0,
                blackoutMode: 'none',
                updatedAt: new Date().toISOString(),
            };
        default:
            return state;
    }
}

describe('Session State Reducer', () => {
    const initialState: SessionState = {
        slideIndex: 0,
        blackoutMode: 'none',
        updatedAt: '2024-01-01T00:00:00.000Z',
    };

    describe('SET_SLIDE_INDEX', () => {
        it('should update slide index', () => {
            const newState = sessionReducer(initialState, {
                type: 'SET_SLIDE_INDEX',
                payload: { slideIndex: 5 },
            });

            expect(newState.slideIndex).toBe(5);
            expect(newState.blackoutMode).toBe('none');
            expect(newState.updatedAt).not.toBe(initialState.updatedAt);
        });

        it('should allow index to be 0', () => {
            const stateWithIndex = { ...initialState, slideIndex: 3 };
            const newState = sessionReducer(stateWithIndex, {
                type: 'SET_SLIDE_INDEX',
                payload: { slideIndex: 0 },
            });

            expect(newState.slideIndex).toBe(0);
        });

        it('should preserve blackout mode when changing slide', () => {
            const stateWithBlackout: SessionState = {
                ...initialState,
                blackoutMode: 'black',
            };

            const newState = sessionReducer(stateWithBlackout, {
                type: 'SET_SLIDE_INDEX',
                payload: { slideIndex: 2 },
            });

            expect(newState.slideIndex).toBe(2);
            expect(newState.blackoutMode).toBe('black');
        });
    });

    describe('SET_BLACKOUT', () => {
        it('should set blackout to black', () => {
            const newState = sessionReducer(initialState, {
                type: 'SET_BLACKOUT',
                payload: { blackoutMode: 'black' },
            });

            expect(newState.blackoutMode).toBe('black');
            expect(newState.slideIndex).toBe(0);
        });

        it('should set blackout to white', () => {
            const newState = sessionReducer(initialState, {
                type: 'SET_BLACKOUT',
                payload: { blackoutMode: 'white' },
            });

            expect(newState.blackoutMode).toBe('white');
        });

        it('should set blackout to none', () => {
            const stateWithBlackout: SessionState = {
                ...initialState,
                blackoutMode: 'black',
            };

            const newState = sessionReducer(stateWithBlackout, {
                type: 'SET_BLACKOUT',
                payload: { blackoutMode: 'none' },
            });

            expect(newState.blackoutMode).toBe('none');
        });

        it('should preserve slide index when changing blackout', () => {
            const stateWithIndex = { ...initialState, slideIndex: 5 };

            const newState = sessionReducer(stateWithIndex, {
                type: 'SET_BLACKOUT',
                payload: { blackoutMode: 'black' },
            });

            expect(newState.slideIndex).toBe(5);
            expect(newState.blackoutMode).toBe('black');
        });
    });

    describe('RESET', () => {
        it('should reset to initial values', () => {
            const modifiedState: SessionState = {
                slideIndex: 10,
                blackoutMode: 'white',
                updatedAt: '2024-06-01T12:00:00.000Z',
            };

            const newState = sessionReducer(modifiedState, { type: 'RESET' });

            expect(newState.slideIndex).toBe(0);
            expect(newState.blackoutMode).toBe('none');
            expect(newState.updatedAt).not.toBe(modifiedState.updatedAt);
        });
    });

    describe('Multiple actions sequence', () => {
        it('should handle a sequence of actions correctly', () => {
            let state = initialState;

            // Go to slide 3
            state = sessionReducer(state, {
                type: 'SET_SLIDE_INDEX',
                payload: { slideIndex: 3 },
            });
            expect(state.slideIndex).toBe(3);

            // Enable blackout
            state = sessionReducer(state, {
                type: 'SET_BLACKOUT',
                payload: { blackoutMode: 'black' },
            });
            expect(state.blackoutMode).toBe('black');
            expect(state.slideIndex).toBe(3);

            // Go to next slide while in blackout
            state = sessionReducer(state, {
                type: 'SET_SLIDE_INDEX',
                payload: { slideIndex: 4 },
            });
            expect(state.slideIndex).toBe(4);
            expect(state.blackoutMode).toBe('black');

            // Disable blackout
            state = sessionReducer(state, {
                type: 'SET_BLACKOUT',
                payload: { blackoutMode: 'none' },
            });
            expect(state.blackoutMode).toBe('none');
            expect(state.slideIndex).toBe(4);

            // Reset
            state = sessionReducer(state, { type: 'RESET' });
            expect(state.slideIndex).toBe(0);
            expect(state.blackoutMode).toBe('none');
        });
    });
});
