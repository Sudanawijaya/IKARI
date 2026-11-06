import type { App } from 'locar';
export function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T>;
export function cameraReady(app: App): Promise<unknown>;
export function gpsHelp(error: unknown): string;
export function gpsPosition(): Promise<GeolocationPosition>;
