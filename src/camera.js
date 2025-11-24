/**
 * Author: @devinjeon (Hyojun Jeon)
 * Copyright (c) 2025 devinjeon (Hyojun Jeon)
 */
import { CONFIG } from './config.js';

export class Camera {
    constructor(uiContainer) {
        this.uiContainer = uiContainer;
        this.state = "idle"; // 'idle', 'zooming', 'tracking', 'panning', 'zooming-out'
        this.target = null; // The participant object to zoom in on
        this.targetPriority = 0; // Priority of the current target
        this.timer = 0; // ms
        this.currentRequest = { target: null, priority: 0, reason: "" }; // The highest priority zoom request per tick
        this.zoomCooldownTimer = 0; // Cooldown timer for zooming before 70%
        this.lockTargetIndex = -1; // -1: inactive, 0~: index of targetWinners
        this.pendingZoomRequest = null; // Next camera request to switch to after zooming out
        this.pendingZoomRequest = null; // Next camera request to switch to after zooming out
        this.isSeventyPercentLockActive = false;
        this.minHoldTimer = 0;
    }

    reset(isHardReset) {
        this.state = "idle";
        this.target = null;
        this.targetPriority = 0;
        this.targetPriority = 0;
        this.timer = 0;
        this.zoomCooldownTimer = 0;
        this.minHoldTimer = 0;

        if (isHardReset) {
            this.lockTargetIndex = -1;
            this.isSeventyPercentLockActive = false;
            this.uiContainer.style.transition = "none";
        } else {
            this.uiContainer.style.transition = `transform ${CONFIG.ZOOM_OUT_DURATION / 1000}s ease-in-out`;
        }
        this.uiContainer.style.transform = "translate(0px, 0px) scale(1)";
    }

    requestZoom(target, priority, reason) {
        if (priority > this.currentRequest.priority) {
            this.currentRequest = { target, priority, reason };
        }
    }

    update(tickDuration, leadDuck, targetWinners, isRaceZoomEnabled) {
        // Reset current request at the start of update (handled by caller usually, but good to be safe or managed here if we move the reset here)
        // Actually, the caller (Game) resets currentRequest before checking logic. 
        // But since we moved state here, we should handle the reset of currentRequest at the end of the tick or start.
        // Let's assume the Game class calls `resetRequest()` at the start of the tick.

        const leadPosition = leadDuck ? leadDuck.position : 0;

        if (this.zoomCooldownTimer > 0) {
            this.zoomCooldownTimer -= tickDuration;
        }

        if (this.state === "idle") {
            if (this.pendingZoomRequest) {
                this.currentRequest = this.pendingZoomRequest;
                this.pendingZoomRequest = null;
            }

            if (!isRaceZoomEnabled) return;
            if (leadPosition < 70 && this.zoomCooldownTimer > 0) return;
            if (this.currentRequest.priority === 0) return;

            this.target = this.currentRequest.target;
            this.targetPriority = this.currentRequest.priority;
            this.state = "zooming";
            this.timer = CONFIG.ZOOM_DURATION;
            this.uiContainer.style.transition = `transform ${CONFIG.ZOOM_DURATION / 1000}s ease-in-out`;
            this.applyTransform();
            return;
        }

        if (this.state === "zooming" || this.state === "tracking") {
            const newRequestIsHigher = this.currentRequest.priority > this.targetPriority;

            // Only check for switch if we are tracking (stable) and hold time has passed
            if (this.state === "tracking") {
                if (this.minHoldTimer > 0) {
                    this.minHoldTimer -= tickDuration;
                }

                if (newRequestIsHigher && this.minHoldTimer <= 0) {
                    if (this.isSeventyPercentLockActive) {
                        // Special case for 70% lock override return or switch
                        // If we are overriding, we might want to pan back if possible, 
                        // but the requirement says "zoom in 200ms maintain -> move zoom"
                        // If we are just switching targets, we can pan.

                        this.target = this.currentRequest.target;
                        this.targetPriority = this.currentRequest.priority;
                        this.state = "panning";
                        this.timer = 500;
                        this.uiContainer.style.transition = `transform 0.5s ease-in-out`;
                        this.applyTransform();
                    } else {
                        this.target = this.currentRequest.target;
                        this.targetPriority = this.currentRequest.priority;
                        this.state = "panning";
                        this.timer = 500;
                        this.uiContainer.style.transition = `transform 0.5s ease-in-out`;
                        this.applyTransform();
                    }
                    return;
                }
            }

            if (this.state === "zooming") {
                this.timer -= tickDuration;
                if (this.timer <= 0) {
                    this.state = "tracking";
                    this.timer = this.targetPriority >= 110 ? CONFIG.LONG_TRACK_DURATION : CONFIG.SHORT_TRACK_DURATION;
                    this.minHoldTimer = CONFIG.MIN_ZOOM_HOLD_DURATION;
                    this.uiContainer.style.transition = "none";
                }
                // Do not allow switching while zooming
                this.applyTransform();
                return;
            }

            if (this.state === "tracking") {
                // Refresh timer if we are still targeting the same thing with high priority
                if (this.currentRequest.target === this.target && this.currentRequest.priority >= this.targetPriority) {
                    this.timer = Math.max(this.timer, this.targetPriority >= 110 ? CONFIG.LONG_TRACK_DURATION : CONFIG.SHORT_TRACK_DURATION);
                }

                this.timer -= tickDuration;

                if (this.target.state === "finished" || this.target.state === "stopped") {
                    let nextTarget = null;
                    if (this.isSeventyPercentLockActive) {
                        nextTarget = targetWinners.find(
                            (p) => p.state !== "finished" && p.state !== "stopped",
                        );
                    }

                    if (nextTarget) {
                        this.target = nextTarget;
                        this.targetPriority = 120;
                        this.state = "panning";
                        this.timer = 500;
                        this.uiContainer.style.transition = `transform 0.5s ease-in-out`;
                        this.applyTransform();
                    } else {
                        this.isSeventyPercentLockActive = false;
                        this.lockTargetIndex = -1;
                        this.state = "zooming-out";
                        this.timer = CONFIG.ZOOM_OUT_DURATION;
                        this.uiContainer.style.transition = `transform ${CONFIG.ZOOM_OUT_DURATION / 1000}s ease-in-out`;
                        this.uiContainer.style.transform = "translate(0px, 0px) scale(1)";
                    }
                } else if (this.timer <= 0) {
                    this.state = "zooming-out";
                    this.timer = CONFIG.ZOOM_OUT_DURATION;
                    this.uiContainer.style.transition = `transform ${CONFIG.ZOOM_OUT_DURATION / 1000}s ease-in-out`;
                    this.uiContainer.style.transform = "translate(0px, 0px) scale(1)";
                }
            }
            this.applyTransform();
            return;
        } else if (this.state === "panning") {
            this.timer -= tickDuration;
            if (this.timer <= 0) {
                this.state = "tracking";
                this.timer = this.targetPriority >= 110 ? CONFIG.LONG_TRACK_DURATION : CONFIG.SHORT_TRACK_DURATION;
                this.uiContainer.style.transition = "none";
            }
            return;
        }
        if (this.state === "zooming-out") {
            this.timer -= tickDuration;

            if (this.currentRequest.priority >= 120) {
                // If we are zooming out and a high priority request comes in, 
                // we generally want to finish zooming out to reset, OR we could intercept.
                // But for stability, let's finish zooming out unless it's critical.
                // Actually, if we are zooming out, we are usually resetting.
                // Let's stick to the plan: prevent switching during transitions.
                // So we do NOTHING here and let it finish zooming out.
            }

            if (this.timer <= 0) {
                if (!this.isSeventyPercentLockActive) {
                    this.lockTargetIndex = -1;
                }
                this.reset(false);
                if (leadPosition < 70) {
                    this.zoomCooldownTimer = CONFIG.ZOOM_COOLDOWN_DURATION;
                }
            }
            return;
        }
    }

    applyTransform() {
        if (!this.target) return;

        const trackRect = this.uiContainer.getBoundingClientRect();
        const duckRect = this.target.element.getBoundingClientRect();

        const containerCenterX = trackRect.width / 2;
        const containerCenterY = trackRect.height / 2;
        const duckRelativeX = duckRect.left - trackRect.left + duckRect.width / 2;
        const duckRelativeY = duckRect.top - trackRect.top + duckRect.height / 2;

        const translateX = containerCenterX - duckRelativeX;
        const translateY = containerCenterY - duckRelativeY;

        this.uiContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${CONFIG.IN_RACE_ZOOM_SCALE})`;
    }

    resetRequest() {
        this.currentRequest = { target: null, priority: 0, reason: "" };
    }
}
