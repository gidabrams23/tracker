export type Screen = 'home' | 'pushups' | 'floor' | 'settings' | 'workouts' | 'albums' | 'running';
export type Go = (screen: Screen) => void;
